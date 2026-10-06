/** Builder blocks ⇄ escaped ESC/POS source. */

import type { Node, ParseResult, TextStyle } from "./escposParser"

export type Align = "left" | "center" | "right"

export type Block =
  | { kind: "init" }
  | { kind: "text"; text: string; align: Align; bold: boolean; double: boolean; underline: boolean; reverse: boolean }
  | { kind: "rule"; ch: string }
  | { kind: "feed"; lines: number }
  | { kind: "barcode"; data: string; align: Align; height: number; width: number; hri: 0 | 1 | 2 | 3 }
  | { kind: "cut"; partial: boolean }

export const BLOCK_LABEL: Record<Block["kind"], string> = {
  init: "초기화",
  text: "텍스트",
  rule: "구분선",
  feed: "피드",
  barcode: "바코드",
  cut: "커트",
}

export const newBlock = (kind: Block["kind"]): Block => {
  switch (kind) {
    case "init": return { kind }
    case "text": return { kind, text: "", align: "left", bold: false, double: false, underline: false, reverse: false }
    case "rule": return { kind, ch: "-" }
    case "feed": return { kind, lines: 2 }
    case "barcode": return { kind, data: "12345678", align: "center", height: 64, width: 2, hri: 2 }
    case "cut": return { kind, partial: true }
  }
}

const hx = (n: number) => "\\x" + Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase()
const ALIGN: Record<Align, string> = { left: hx(0), center: hx(1), right: hx(2) }
const ESC = "\\x1B"
const GS = "\\x1D"
const esc = (s: string) => s.replace(/\\/g, "\\\\")

/** Builder output always opens with ESC @ — the init block is implicit and pinned. */
export function serialize(blocks: Block[], cols: number): string {
  const out: string[] = [`${ESC}\\x40`]
  for (const b of blocks) {
    switch (b.kind) {
      case "init":
        out.push(`${ESC}\\x40`)
        break
      case "text": {
        let s = `${ESC}\\x61${ALIGN[b.align]}`
        if (b.bold) s += `${ESC}\\x45\\x01`
        if (b.double) s += `${ESC}\\x21\\x30`
        if (b.underline) s += `${ESC}\\x2D\\x01`
        if (b.reverse) s += `${GS}\\x42\\x01`
        const lines = b.text.split("\n")
        s += lines.map(esc).join("\\n\n") + "\\n"
        if (b.reverse) s += `${GS}\\x42\\x00`
        if (b.underline) s += `${ESC}\\x2D\\x00`
        if (b.double) s += `${ESC}\\x21\\x00`
        if (b.bold) s += `${ESC}\\x45\\x00`
        out.push(s)
        break
      }
      case "rule":
        out.push(esc((b.ch || "-")[0].repeat(cols)) + "\\n")
        break
      case "feed":
        out.push(`${ESC}\\x64${hx(b.lines)}`)
        break
      case "barcode": {
        const len = new TextEncoder().encode(b.data).length
        out.push(
          `${ESC}\\x61${ALIGN[b.align]}${GS}\\x68${hx(b.height)}${GS}\\x77${hx(b.width)}${GS}\\x48${hx(b.hri)}` +
            `${GS}\\x6B\\x49${hx(len)}${esc(b.data)}\\n`,
        )
        break
      }
      case "cut":
        out.push(`${GS}\\x56${hx(b.partial ? 1 : 0)}`)
        break
    }
  }
  return out.join("\n")
}

export const DEMO_RECEIPT_BLOCKS: Block[] = [
  { kind: "text", text: "카페 모카", align: "center", bold: false, double: true, underline: false, reverse: false },
  { kind: "text", text: "서울시 어딘가 12-3\nTel. 02-000-0000", align: "center", bold: false, double: false, underline: false, reverse: false },
  { kind: "rule", ch: "=" },
  { kind: "text", text: "일자  2025-07-17 14:08\nNo.   0042          POS-01", align: "left", bold: false, double: false, underline: false, reverse: false },
  { kind: "rule", ch: "-" },
  { kind: "text", text: "아메리카노      2    9,000\n카페라떼        1    5,500\n크루아상        1    4,200", align: "left", bold: false, double: false, underline: false, reverse: false },
  { kind: "rule", ch: "-" },
  { kind: "text", text: "합계                18,700", align: "left", bold: true, double: false, underline: false, reverse: false },
  { kind: "text", text: "부가세                 1,700", align: "left", bold: false, double: false, underline: false, reverse: false },
  { kind: "rule", ch: "-" },
  { kind: "text", text: "카드           18,700\n승인번호     12345678", align: "left", bold: false, double: false, underline: false, reverse: false },
  { kind: "feed", lines: 1 },
  { kind: "barcode", data: "2025071742", align: "center", height: 64, width: 2, hri: 2 },
  { kind: "feed", lines: 1 },
  { kind: "text", text: " 감사합니다 ", align: "center", bold: false, double: false, underline: false, reverse: true },
  { kind: "feed", lines: 3 },
  { kind: "cut", partial: true },
]

/* ---------- Reverse: parsed document → blocks (best effort) ---------- */

const RULE_CHARS = new Set(["-", "=", "*", "_"])

const styleOf = (st: TextStyle) => ({
  bold: st.bold,
  double: st.widthMul === 2 && st.heightMul === 2,
  underline: st.underline,
  reverse: st.reverse,
})

const sameTextStyle = (a: Extract<Block, { kind: "text" }>, b: ReturnType<typeof styleOf>, align: Align) =>
  a.align === align && a.bold === b.bold && a.double === b.double && a.underline === b.underline && a.reverse === b.reverse

/**
 * Converts a parse result into blocks. Lossy when a line mixes styles,
 * uses width-only / height-only sizing, or the stream has unknown commands.
 */
export function blocksFromParse(result: ParseResult, cols: number): { blocks: Block[]; lossy: string[] } {
  const blocks: Block[] = []
  const lossy = new Set<string>()
  let pendingEmpty = 0
  let afterBarcode = false

  const lastText = () => {
    const l = blocks[blocks.length - 1]
    return l?.kind === "text" ? l : null
  }

  const flushEmpty = () => {
    if (!pendingEmpty) return
    const t = lastText()
    if (t) t.text += "\n".repeat(pendingEmpty)
    else blocks.push({ kind: "text", text: "\n".repeat(pendingEmpty - 1), align: "left", bold: false, double: false, underline: false, reverse: false })
    pendingEmpty = 0
  }

  for (const n of result.nodes as Node[]) {
    if (n.kind === "line") {
      if (!n.segments.length) {
        // the LF that terminates a barcode is part of the barcode block, not an empty line
        if (afterBarcode) { afterBarcode = false; continue }
        pendingEmpty++
        continue
      }
      afterBarcode = false
      const text = n.segments.map((s) => s.text).join("")
      const first = n.segments[0].style
      if (n.segments.length > 1) lossy.add("한 줄 안에서 스타일이 바뀌는 구간은 첫 스타일로 통일")
      if ((first.widthMul === 2) !== (first.heightMul === 2)) lossy.add("폭·높이 중 하나만 2배인 글자는 일반 크기로")

      // rule?
      const ch = text[0]
      if (RULE_CHARS.has(ch) && text.length >= Math.min(cols, 16) && [...text].every((c) => c === ch) && !first.bold && !first.reverse) {
        flushEmpty()
        blocks.push({ kind: "rule", ch })
        continue
      }

      const st = styleOf(first)
      const prev = lastText()
      if (prev && pendingEmpty === 0 && sameTextStyle(prev, st, n.align)) {
        prev.text += "\n" + text
      } else {
        flushEmpty()
        blocks.push({ kind: "text", text, align: n.align, ...st })
      }
      continue
    }

    flushEmpty()
    afterBarcode = n.kind === "barcode"
    if (n.kind === "feed") blocks.push({ kind: "feed", lines: Math.max(1, Math.min(24, n.lines)) })
    else if (n.kind === "cut") blocks.push({ kind: "cut", partial: n.partial })
    else if (n.kind === "barcode") {
      if (n.system !== "CODE128") lossy.add(`${n.system} 바코드는 CODE128 로`)
      const hri = (["none", "above", "below", "both"] as const).indexOf(n.hri) as 0 | 1 | 2 | 3
      blocks.push({ kind: "barcode", data: n.data, align: n.align, height: n.height, width: n.width, hri: hri < 0 ? 0 : hri })
    }
  }
  flushEmpty()

  if (result.diagnostics.some((d) => d.level === "warn")) lossy.add("경고가 있던 명령은 버림 (Issues 탭 참고)")
  return { blocks, lossy: [...lossy] }
}
