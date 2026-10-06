export type InputFormat = "escaped" | "hex"
export type TextEncoding = "utf-8" | "euc-kr"

export type Decoded = {
  /** One char per byte for control bytes; text already decoded (escaped) or latin1-mapped (hex). */
  text: string
  bytes: Uint8Array
  /** Applied by the parser to text runs — identity for escaped input. */
  decodeText?: (latin1: string) => string
  note: string
  error: boolean
}

const utf8 = new TextEncoder()

/** `\x1B` · `\e` · `\n` · `\t` · `\r` · `\0` · `\\` · `\uHHHH`. Literal newlines are layout only and dropped. */
export function unescape(src: string): { text: string; bad: number } {
  let out = ""
  let bad = 0
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === "\n" || ch === "\r") continue
    if (ch !== "\\") { out += ch; continue }
    const n = src[i + 1]
    if (n === undefined) { bad++; break }
    switch (n) {
      case "x": {
        const h = src.slice(i + 2, i + 4)
        if (/^[0-9a-fA-F]{2}$/.test(h)) { out += String.fromCharCode(parseInt(h, 16)); i += 3 }
        else { bad++; i += 1 }
        break
      }
      case "u": {
        const h = src.slice(i + 2, i + 6)
        if (/^[0-9a-fA-F]{4}$/.test(h)) { out += String.fromCharCode(parseInt(h, 16)); i += 5 }
        else { bad++; i += 1 }
        break
      }
      case "n": out += "\n"; i++; break
      case "t": out += "\t"; i++; break
      case "r": out += "\r"; i++; break
      case "0": out += "\0"; i++; break
      case "e": out += "\x1b"; i++; break
      case "\\": out += "\\"; i++; break
      default: bad++; out += n; i++
    }
  }
  return { text: out, bad }
}

/** JS string → wire bytes: U+0000–U+00FF as single bytes (control args), everything else UTF-8. */
function stringToBytes(s: string): Uint8Array {
  const parts: number[] = []
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (c <= 0xff) parts.push(c)
    else parts.push(...utf8.encode(ch))
  }
  return Uint8Array.from(parts)
}

export function decodeInput(src: string, format: InputFormat, encoding: TextEncoding): Decoded {
  if (format === "escaped") {
    const { text, bad } = unescape(src)
    const bytes = stringToBytes(text)
    return {
      text,
      bytes,
      note: bad
        ? `잘못된 이스케이프 ${bad}개 — 그대로 통과시킴. 줄바꿈은 \\n 으로, 실제 개행은 무시됨.`
        : "줄바꿈은 \\n 으로 입력. 실제 개행은 가독성용으로 무시됨. 비ASCII 문자는 UTF-8 로 계산.",
      error: bad > 0,
    }
  }

  const clean = src.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "")
  const odd = clean.length % 2 === 1
  const hexStr = odd ? clean.slice(0, -1) : clean
  const bytes = new Uint8Array(hexStr.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16)

  let text = ""
  for (const b of bytes) text += String.fromCharCode(b)

  const decoder = new TextDecoder(encoding, { fatal: false })
  const decodeText = (latin1: string) => {
    const raw = Uint8Array.from(latin1, (c) => c.charCodeAt(0))
    return decoder.decode(raw)
  }

  const stripped = src.replace(/0x/gi, "").replace(/[\s,:;-]/g, "").length - clean.length
  const notes: string[] = [`${bytes.length} B · 텍스트는 ${encoding.toUpperCase()} 로 디코드.`]
  if (odd) notes.push("홀수 자릿수 — 마지막 니블 버림.")
  if (stripped > 0) notes.push(`hex 아닌 문자 ${stripped}개 제거.`)
  return { text, bytes, decodeText, note: notes.join(" "), error: odd || stripped > 0 }
}
