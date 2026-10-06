/**
 * ESC/POS → structured document → HTML.
 *
 * Works on a JS string (one char = one byte, 0x00–0xFF for control args,
 * full Unicode for text). Going through TextEncoder would UTF-8-expand
 * bytes like `\xFF` into two bytes and break argument parsing.
 */

export type Align = "left" | "center" | "right"

export type TextStyle = {
  bold: boolean
  underline: boolean
  reverse: boolean
  widthMul: 1 | 2
  heightMul: 1 | 2
}

export type Segment = { text: string; style: TextStyle }

export type Node =
  | { kind: "line"; align: Align; segments: Segment[] }
  | { kind: "feed"; lines: number }
  | { kind: "cut"; partial: boolean }
  | {
      kind: "barcode"
      align: Align
      system: string
      data: string
      height: number
      width: number
      hri: "none" | "above" | "below" | "both"
    }

export type Diagnostic = {
  level: "warn" | "info"
  offset: number
  raw: string
  message: string
}

export type Token =
  | { type: "text"; start: number; end: number; text: string }
  | { type: "cmd"; start: number; end: number; name: string; raw: string; args: number[] }
  | { type: "data"; start: number; end: number; text: string; label: string }

export type ParseResult = {
  nodes: Node[]
  tokens: Token[]
  diagnostics: Diagnostic[]
}

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a
const CR = 0x0d
const HT = 0x09
const NUL = 0x00

const BARCODE_SYSTEMS: Record<number, string> = {
  0: "UPC-A", 1: "UPC-E", 2: "EAN13", 3: "EAN8", 4: "CODE39", 5: "ITF", 6: "CODABAR",
  65: "UPC-A", 66: "UPC-E", 67: "EAN13", 68: "EAN8", 69: "CODE39", 70: "ITF",
  71: "CODABAR", 72: "CODE93", 73: "CODE128", 74: "GS1-128", 75: "GS1 DataBar",
}

const defaultStyle = (): TextStyle => ({
  bold: false, underline: false, reverse: false, widthMul: 1, heightMul: 1,
})

const hex = (s: string) =>
  Array.from(s, (c) => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()).join(" ")

export type ParseOptions = {
  /** Re-decode text runs (e.g. latin1-mapped bytes → EUC-KR). Control bytes never pass through it. */
  decodeText?: (text: string) => string
}

export function parseEscPos(input: string, opts: ParseOptions = {}): ParseResult {
  const src = input.startsWith("EP") ? input.slice(2) : input
  const dec = opts.decodeText ?? ((t: string) => t)
  const nodes: Node[] = []
  const tokens: Token[] = []
  const diagnostics: Diagnostic[] = []

  let style = defaultStyle()
  let align: Align = "left"
  let barcodeHeight = 162
  let barcodeWidth = 3
  let hri: "none" | "above" | "below" | "both" = "none"

  let line: Extract<Node, { kind: "line" }> | null = null
  let textStart = -1
  let textBuf = ""

  const code = (i: number) => src.charCodeAt(i)

  const flushTextToken = () => {
    if (textBuf.length) {
      tokens.push({ type: "text", start: textStart, end: textStart + textBuf.length, text: dec(textBuf) })
      textBuf = ""
      textStart = -1
    }
  }

  const putText = (ch: string, at: number) => {
    if (!line) line = { kind: "line", align, segments: [] }
    const last = line.segments[line.segments.length - 1]
    if (last && sameStyle(last.style, style)) last.text += ch
    else line.segments.push({ text: ch, style: { ...style } })
    if (textStart < 0) textStart = at
    textBuf += ch
  }

  const pushLine = (l: Extract<Node, { kind: "line" }>) => {
    for (const seg of l.segments) seg.text = dec(seg.text)
    nodes.push(l)
  }

  const endLine = () => {
    if (line) pushLine(line)
    else nodes.push({ kind: "line", align, segments: [] })
    line = null
  }

  const flushLine = () => {
    if (line) {
      pushLine(line)
      line = null
    }
  }

  const cmd = (start: number, len: number, name: string, args: number[] = []) => {
    flushTextToken()
    tokens.push({ type: "cmd", start, end: start + len, name, raw: hex(src.slice(start, start + len)), args })
  }

  const warn = (offset: number, len: number, message: string, level: Diagnostic["level"] = "warn") => {
    diagnostics.push({ level, offset, raw: hex(src.slice(offset, offset + len)), message })
  }

  let i = 0
  while (i < src.length) {
    const b = code(i)

    if (b === ESC) {
      const c = code(i + 1)
      const n = code(i + 2)
      switch (c) {
        case 0x40: // ESC @ — initialize
          cmd(i, 2, "ESC @")
          style = defaultStyle()
          align = "left"
          i += 2
          break
        case 0x61: { // ESC a n — justification
          cmd(i, 3, "ESC a", [n])
          const v = n >= 48 ? n - 48 : n
          if (v === 0) align = "left"
          else if (v === 1) align = "center"
          else if (v === 2) align = "right"
          else warn(i, 3, `ESC a ${n}: 정렬 인수는 0·1·2(또는 48·49·50)만 유효. 프린터는 무시함 → 현재 정렬(${align}) 유지.`)
          if (line) warn(i, 3, "ESC a 가 줄 중간에 옴. 프린터는 줄 시작에서만 정렬을 적용함.", "info")
          i += 3
          break
        }
        case 0x21: // ESC ! n — print mode
          cmd(i, 3, "ESC !", [n])
          style = {
            ...style,
            bold: !!(n & 0x08),
            heightMul: n & 0x10 ? 2 : 1,
            widthMul: n & 0x20 ? 2 : 1,
            underline: !!(n & 0x80),
          }
          i += 3
          break
        case 0x45: // ESC E n — emphasis
          cmd(i, 3, "ESC E", [n])
          style = { ...style, bold: !!(n & 1) }
          i += 3
          break
        case 0x2d: // ESC - n — underline
          cmd(i, 3, "ESC -", [n])
          style = { ...style, underline: (n & 3) !== 0 }
          i += 3
          break
        case 0x64: // ESC d n — print and feed n lines
          cmd(i, 3, "ESC d", [n])
          flushLine()
          nodes.push({ kind: "feed", lines: n })
          i += 3
          break
        case 0x4a: // ESC J n — print and feed n dots
          cmd(i, 3, "ESC J", [n])
          flushLine()
          nodes.push({ kind: "feed", lines: Math.max(1, Math.round(n / 30)) })
          i += 3
          break
        case 0x69: // ESC i — full cut
        case 0x6d: // ESC m — partial cut
          cmd(i, 2, c === 0x69 ? "ESC i" : "ESC m")
          flushLine()
          nodes.push({ kind: "cut", partial: c === 0x6d })
          i += 2
          break
        case 0x74: // ESC t n — code page
          cmd(i, 3, "ESC t", [n])
          i += 3
          break
        case 0x4d: // ESC M n — font
          cmd(i, 3, "ESC M", [n])
          i += 3
          break
        case 0x32: // ESC 2 — default line spacing
          cmd(i, 2, "ESC 2")
          i += 2
          break
        case 0x33: // ESC 3 n — line spacing
          cmd(i, 3, "ESC 3", [n])
          i += 3
          break
        case 0x70: // ESC p m t1 t2 — drawer kick
          cmd(i, 5, "ESC p", [n, code(i + 3), code(i + 4)])
          i += 5
          break
        default:
          cmd(i, 2, "ESC ?")
          warn(i, 2, `알 수 없는 ESC 명령 (0x${c.toString(16).padStart(2, "0").toUpperCase()}). 2바이트 건너뜀.`)
          i += 2
      }
      continue
    }

    if (b === GS) {
      const c = code(i + 1)
      const n = code(i + 2)
      switch (c) {
        case 0x42: // GS B n — reverse
          cmd(i, 3, "GS B", [n])
          style = { ...style, reverse: n !== 0 }
          i += 3
          break
        case 0x21: // GS ! n — character size
          cmd(i, 3, "GS !", [n])
          style = {
            ...style,
            widthMul: (n >> 4) & 0x0f ? 2 : 1,
            heightMul: n & 0x0f ? 2 : 1,
          }
          i += 3
          break
        case 0x56: { // GS V m [n] — cut
          const long = n === 65 || n === 66
          cmd(i, long ? 4 : 3, "GS V", long ? [n, code(i + 3)] : [n])
          flushLine()
          nodes.push({ kind: "cut", partial: n === 1 || n === 49 || n === 66 })
          i += long ? 4 : 3
          break
        }
        case 0x68: // GS h n — barcode height
          cmd(i, 3, "GS h", [n])
          barcodeHeight = n
          i += 3
          break
        case 0x77: // GS w n — barcode width
          cmd(i, 3, "GS w", [n])
          barcodeWidth = n
          i += 3
          break
        case 0x48: // GS H n — HRI position
          cmd(i, 3, "GS H", [n])
          hri = (["none", "above", "below", "both"] as const)[n & 3]
          i += 3
          break
        case 0x66: // GS f n — HRI font
          cmd(i, 3, "GS f", [n])
          i += 3
          break
        case 0x6b: { // GS k m ... — barcode
          const m = n
          const system = BARCODE_SYSTEMS[m] ?? `m=${m}`
          let data = ""
          let len: number
          if (m < 65) {
            let j = i + 3
            while (j < src.length && code(j) !== NUL) j++
            data = src.slice(i + 3, j)
            len = j - i + 1
            cmd(i, 3, "GS k", [m])
            tokens.push({ type: "data", start: i + 3, end: j, text: dec(data), label: `${system} data` })
            if (j >= src.length) warn(i, 3, `GS k ${m}: 바코드 데이터 종료 NUL 없음.`)
            else tokens.push({ type: "cmd", start: j, end: j + 1, name: "NUL", raw: "00", args: [] })
          } else {
            const dlen = code(i + 3)
            data = src.slice(i + 4, i + 4 + dlen)
            len = 4 + dlen
            cmd(i, 4, "GS k", [m, dlen])
            tokens.push({ type: "data", start: i + 4, end: i + 4 + data.length, text: dec(data), label: `${system} data[${dlen}]` })
            const ctrl = Array.from(data).findIndex((ch) => ch.charCodeAt(0) < 0x20)
            if (data.length < dlen) {
              warn(i, 4, `GS k ${m}: 데이터 길이 ${dlen}바이트 선언, 실제 ${data.length}바이트. 프린터는 뒤 ${dlen - data.length}바이트를 바코드로 먹음.`)
            } else if (ctrl >= 0) {
              warn(i, 4, `GS k ${m}: 데이터 길이 ${dlen}바이트 선언, 페이로드 ${ctrl}바이트 뒤에 제어문자 포함. 뒤따르는 명령/텍스트가 바코드에 흡수됨. 선언 길이를 실제 데이터 길이에 맞출 것.`)
            }
          }
          flushLine()
          nodes.push({ kind: "barcode", align, system, data: dec(data), height: barcodeHeight, width: barcodeWidth, hri })
          i += len
          break
        }
        case 0x4c: // GS L nL nH
        case 0x57: // GS W nL nH
          cmd(i, 4, c === 0x4c ? "GS L" : "GS W", [n, code(i + 3)])
          i += 4
          break
        default:
          cmd(i, 2, "GS ?")
          warn(i, 2, `알 수 없는 GS 명령 (0x${c.toString(16).padStart(2, "0").toUpperCase()}). 2바이트 건너뜀.`)
          i += 2
      }
      continue
    }

    if (b === LF) {
      cmd(i, 1, "LF")
      endLine()
      i += 1
      continue
    }
    if (b === CR) {
      cmd(i, 1, "CR")
      i += 1
      continue
    }
    if (b === HT) {
      cmd(i, 1, "HT")
      putText("    ", i)
      i += 1
      continue
    }
    if (b < 0x20) {
      cmd(i, 1, `0x${b.toString(16).padStart(2, "0").toUpperCase()}`)
      warn(i, 1, `처리되지 않은 제어문자 0x${b.toString(16).padStart(2, "0").toUpperCase()}.`, "info")
      i += 1
      continue
    }

    putText(src[i], i)
    i += 1
  }

  flushTextToken()
  flushLine()
  return { nodes, tokens, diagnostics }
}

const sameStyle = (a: TextStyle, b: TextStyle) =>
  a.bold === b.bold && a.underline === b.underline && a.reverse === b.reverse &&
  a.widthMul === b.widthMul && a.heightMul === b.heightMul

/* ---------- Rendering ---------- */

export function renderReceipt(result: ParseResult, cols: number): HTMLElement {
  const paper = document.createElement("div")
  paper.className = "thermal"
  paper.style.setProperty("--cols", String(cols))

  for (const node of result.nodes) {
    switch (node.kind) {
      case "line": {
        const el = document.createElement("div")
        el.className = "thermal__line"
        el.dataset.align = node.align
        if (!node.segments.length) {
          el.classList.add("thermal__line--empty")
          el.textContent = " "
        }
        for (const seg of node.segments) {
          const span = document.createElement("span")
          span.textContent = seg.text
          span.className = "thermal__seg"
          if (seg.style.bold) span.classList.add("is-bold")
          if (seg.style.underline) span.classList.add("is-underline")
          if (seg.style.reverse) span.classList.add("is-reverse")
          if (seg.style.widthMul === 2) span.classList.add("is-wide")
          if (seg.style.heightMul === 2) span.classList.add("is-tall")
          el.appendChild(span)
        }
        paper.appendChild(el)
        break
      }
      case "feed": {
        const el = document.createElement("div")
        el.className = "thermal__feed"
        el.style.setProperty("--lines", String(Math.min(node.lines, 12)))
        el.setAttribute("aria-label", `feed ${node.lines} lines`)
        paper.appendChild(el)
        break
      }
      case "cut": {
        const el = document.createElement("div")
        el.className = "thermal__cut"
        el.dataset.partial = String(node.partial)
        el.innerHTML = `<span>${node.partial ? "partial cut" : "cut"}</span>`
        paper.appendChild(el)
        break
      }
      case "barcode": {
        const el = document.createElement("figure")
        el.className = "thermal__barcode"
        el.dataset.align = node.align
        if (node.hri === "above" || node.hri === "both") el.appendChild(hriEl(node.data))
        el.appendChild(barcodeSvg(node.data, node.height, node.width))
        if (node.hri === "below" || node.hri === "both") el.appendChild(hriEl(node.data))
        const cap = document.createElement("figcaption")
        cap.textContent = `${node.system} · ${node.data.length || 0}B · h${node.height} w${node.width}`
        el.appendChild(cap)
        paper.appendChild(el)
        break
      }
    }
  }
  return paper
}

const hriEl = (text: string) => {
  const d = document.createElement("div")
  d.className = "thermal__hri"
  d.textContent = text
  return d
}

/** Deterministic pseudo-barcode: 11 modules per char from its code bits. Not scannable — a visual stand-in. */
function barcodeSvg(data: string, height: number, widthMul: number): SVGElement {
  const modules: number[] = [1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0] // start-ish
  for (const ch of data || "?") {
    const c = ch.charCodeAt(0)
    for (let k = 0; k < 11; k++) modules.push((c >> (k % 8)) & 1 ? 1 : k % 3 === 0 ? 1 : 0)
  }
  modules.push(1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1)
  const unit = Math.max(1, Math.min(widthMul, 6)) * 0.6
  const w = modules.length * unit
  const h = Math.max(24, Math.min(height, 255)) * 0.35
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`)
  svg.setAttribute("width", String(w))
  svg.setAttribute("height", String(h))
  svg.setAttribute("role", "img")
  svg.setAttribute("aria-label", `barcode ${data}`)
  svg.setAttribute("shape-rendering", "crispEdges")
  let x = 0
  for (const m of modules) {
    if (m) {
      const r = document.createElementNS(ns, "rect")
      r.setAttribute("x", String(x))
      r.setAttribute("y", "0")
      r.setAttribute("width", String(unit))
      r.setAttribute("height", String(h))
      r.setAttribute("fill", "currentColor")
      svg.appendChild(r)
    }
    x += unit
  }
  return svg
}

/** Raw command view — control sequences as chips, text as-is. */
export function renderTokens(result: ParseResult): HTMLElement {
  const root = document.createElement("div")
  root.className = "raw"
  for (const t of result.tokens) {
    if (t.type === "text") {
      const span = document.createElement("span")
      span.className = "raw__text"
      span.textContent = t.text
      root.appendChild(span)
    } else if (t.type === "data") {
      const span = document.createElement("span")
      span.className = "raw__data"
      span.title = t.label
      span.textContent = t.text
      root.appendChild(span)
    } else {
      const chip = document.createElement("span")
      chip.className = "raw__cmd"
      chip.dataset.name = t.name
      chip.title = `offset ${t.start} · ${t.raw}`
      chip.textContent = t.args.length ? `${t.name} ${t.args.join(" ")}` : t.name
      root.appendChild(chip)
      if (t.name === "LF") root.appendChild(document.createElement("br"))
    }
  }
  return root
}
