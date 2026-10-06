import "./tokens.css"
import "./style.css"
import { parseEscPos, renderReceipt, renderTokens, type ParseResult } from "./utils/escposParser"
import { decodeInput, type InputFormat, type TextEncoding } from "./utils/decodeInput"
import { BLOCK_LABEL, DEMO_RECEIPT_BLOCKS, blocksFromParse, newBlock, serialize, type Align, type Block } from "./utils/blocks"

/* ---------- Demos (direct mode) ---------- */

const DEMO_BASIC = String.raw`\x1B\x40
\x1B\x61\x01\x1B\x21\x30Hello ESC/POS\n
\x1B\x40
--------------------------------\n
\x1B\x61\x00Left aligned\n
\x1B\x61\x02Right aligned\n
\x1B\x45\x01Bold on\x1B\x45\x00 bold off\n
\x1D\x42\x01 reverse \x1D\x42\x00\n
\x1B\x61\x01\x1D\x68\x50\x1D\x77\x02\x1D\x48\x02\x1D\x6B\x49\x0812345678\n
\x1B\x64\x03\x1D\x56\x01`

const REFERENCE: [string, string][] = [
  ["ESC @", "초기화 (스타일·정렬 리셋)"],
  ["ESC a n", "정렬 0=좌 1=중 2=우"],
  ["ESC ! n", "모드 비트: 08 굵게 · 10 2배높이 · 20 2배폭 · 80 밑줄"],
  ["ESC E n", "굵게 on/off"],
  ["ESC - n", "밑줄 0/1/2"],
  ["ESC d n", "n줄 피드"],
  ["ESC J n", "n도트 피드"],
  ["ESC i / ESC m", "전체 / 부분 커트"],
  ["GS V m [n]", "커트 (0·48 전체, 1·49 부분, 65/66 피드 후)"],
  ["GS B n", "흑백 반전"],
  ["GS ! n", "글자 크기 (상위 4bit 폭, 하위 4bit 높이)"],
  ["GS h n", "바코드 높이"],
  ["GS w n", "바코드 모듈 폭 2–6"],
  ["GS H n", "HRI 위치 0 없음 1 위 2 아래 3 양쪽"],
  ["GS k m d… NUL", "바코드 (m < 65, NUL 종료)"],
  ["GS k m n d…", "바코드 (m ≥ 65, 길이 n)"],
  ["ESC t / M / 2 / 3 / p", "코드페이지·폰트·행간·드로어 — 인식만, 렌더 영향 없음"],
]

/* ---------- Icons (16px, stroke 1.5) ---------- */

const ICON: Record<string, string> = {
  text: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  rule: '<path d="M3 12h18"/>',
  feed: '<path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14"/>',
  barcode: '<path d="M4 5v14M8 5v14M11 5v14M15 5v14M18 5v14M21 5v14"/>',
  cut: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5 20 18M8 16.5 20 6"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  double: '<path d="M4 18 9 6l5 12M6 14h6M15 18l3-7 3 7"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  reverse: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 4h8v16H4z" fill="currentColor" stroke="none"/>',
  arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  warn: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M10.3 4.6a2 2 0 0 1 3.4 0l7.6 13.1A2 2 0 0 1 19.6 20.7H4.4a2 2 0 0 1-1.7-3zM12 9a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0-1-1m0 7.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4"/>',
  info: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 7a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1m0-3.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 5.5A1.5 1.5 0 0 0 18.5 4H13a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/>',
}
const icon = (name: keyof typeof ICON) =>
  `<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

/* ---------- State ---------- */

type State = {
  mode: "direct" | "build"
  source: string
  blocks: Block[]
  format: InputFormat
  encoding: TextEncoding
  cols: 32 | 42 | 48
  tab: "preview" | "raw" | "issues"
}

const STARTER_BLOCKS: Block[] = [
  { kind: "text", text: "내용을 입력하세요", align: "center", bold: false, double: false, underline: false, reverse: false },
]

const DEFAULT: State = {
  mode: "build",
  source: serialize(STARTER_BLOCKS, 32),
  blocks: structuredClone(STARTER_BLOCKS),
  format: "escaped",
  encoding: "utf-8",
  cols: 32,
  tab: "preview",
}
const STORAGE_KEY = "escpos-preview:state:v5"

const loadState = (): State => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      const blocks = Array.isArray(saved.blocks) ? saved.blocks.filter((b) => b.kind !== "init") : structuredClone(STARTER_BLOCKS)
      return { ...structuredClone(DEFAULT), ...saved, blocks }
    }
  } catch { /* storage unavailable */ }
  return structuredClone(DEFAULT)
}
const saveState = (s: State) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

let state = loadState()

/* ---------- DOM ---------- */

const app = document.querySelector<HTMLDivElement>("#app")!
app.innerHTML = `
  <header class="bar">
    <div class="bar__brand">
      <span class="bar__mark" aria-hidden="true"></span>
      <h1 class="bar__title">ESC/POS Preview</h1>
    </div>
    <div class="bar__controls">
      <div class="bar__group" role="group" aria-label="데모">
        <span class="bar__label">데모</span>
        <button type="button" class="btn btn--ghost btn--sm" data-demo="basic">기본</button>
        <button type="button" class="btn btn--ghost btn--sm" data-demo="receipt">영수증</button>
      </div>
      <button type="button" class="btn btn--ghost btn--sm" id="reset" title="입력 내용을 비움">초기화</button>
      <div class="seg" role="radiogroup" aria-label="용지 폭">
        ${([32, 42, 48] as const)
          .map((c) => `<button type="button" class="seg__btn" role="radio" data-cols="${c}" aria-checked="false">${c}<small>col</small></button>`)
          .join("")}
      </div>
      <button type="button" class="btn btn--ghost btn--sm btn--icon" id="open-ref" aria-haspopup="dialog" aria-controls="ref-dialog" title="지원 명령어">${icon("book")}<span>명령어</span></button>
    </div>
  </header>

  <dialog class="dialog" id="ref-dialog" aria-labelledby="ref-title">
    <div class="dialog__head">
      <h2 class="dialog__title" id="ref-title">지원 명령어 <span class="dialog__count">${REFERENCE.length}</span></h2>
      <button type="button" class="tool" id="close-ref" aria-label="닫기">${icon("close")}</button>
    </div>
    <dl class="ref__list">
      ${REFERENCE.map(([k, v]) => `<div class="ref__row"><dt><code>${k}</code></dt><dd>${v}</dd></div>`).join("")}
    </dl>
    <p class="dialog__foot">인식만 하고 렌더에 반영 안 되는 명령은 Tokens 탭에서 칩으로 확인 가능. 알 수 없는 명령은 Issues 탭에 기록됨.</p>
  </dialog>

  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>

  <main class="stage">
    <aside class="panel" aria-label="명령어 입력">
      <div class="panel__modes">
        <div class="modes" role="tablist" aria-label="입력 방식">
          <button type="button" class="mode" role="tab" data-mode="build" aria-selected="false">조립</button>
          <button type="button" class="mode" role="tab" data-mode="direct" aria-selected="false">직접 입력</button>
        </div>
      </div>

      <!-- Build mode -->
      <section class="panel__block builder" data-only-mode="build" role="tabpanel" aria-label="블록 조립">
        <div class="blk blk--pinned" aria-label="초기화 블록 (고정)">
          <div class="blk__head">
            <span class="blk__kind">초기화</span>
            <span class="blk__note">ESC @ · 항상 맨 앞</span>
          </div>
        </div>
        <ol class="blocks" id="blocks"></ol>
        <div class="addbar" role="group" aria-label="블록 추가">
          ${(["text", "rule", "feed", "barcode", "cut"] as const)
            .map((k) => `<button type="button" class="addbar__btn" data-add="${k}">${icon(k)}<span>${BLOCK_LABEL[k]}</span></button>`)
            .join("")}
        </div>
      </section>

      <!-- Direct mode -->
      <section class="panel__block editor" data-only-mode="direct" role="tabpanel" aria-label="직접 입력">
        <div class="editor__head">
          <div class="seg seg--sm" role="radiogroup" aria-label="입력 형식">
            <button type="button" class="seg__btn" role="radio" data-format="escaped" aria-checked="false">\\x1B 이스케이프</button>
            <button type="button" class="seg__btn" role="radio" data-format="hex" aria-checked="false">hex</button>
          </div>
          <select class="select" id="encoding" aria-label="텍스트 인코딩 (hex 전용)">
            <option value="utf-8">UTF-8</option>
            <option value="euc-kr">EUC-KR / CP949</option>
          </select>
        </div>
        <textarea class="editor__area" id="source" spellcheck="false" autocomplete="off" autocapitalize="off"
          aria-label="ESC/POS 명령어" placeholder="\\x1B\\x40\\x1B\\x61\\x01Hello\\n"></textarea>
        <p class="editor__hint" id="hint"></p>
      </section>

    </aside>

    <section class="view" aria-label="출력 미리보기">
      <div class="view__head">
        <div class="tabs" role="tablist" aria-label="보기">
          <button type="button" class="tab" role="tab" data-tab="preview" aria-selected="false">Preview</button>
          <button type="button" class="tab" role="tab" data-tab="raw" aria-selected="false">Tokens</button>
          <button type="button" class="tab" role="tab" data-tab="issues" aria-selected="false">Issues <span class="tab__count" id="issue-count">0</span></button>
        </div>
        <div class="view__actions">
          <span class="view__meta" id="byte-count"></span>
          <button type="button" class="btn btn--primary" id="copy">Copy hex</button>
        </div>
      </div>
      <div class="view__body" id="view-body" role="tabpanel"></div>
    </section>
  </main>
`

const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!
const $$ = <T extends HTMLElement>(sel: string) => Array.from(app.querySelectorAll<T>(sel))

const source = $<HTMLTextAreaElement>("#source")
const hint = $<HTMLParagraphElement>("#hint")
const toastEl = $<HTMLDivElement>("#toast")
const encoding = $<HTMLSelectElement>("#encoding")
const blocksEl = $<HTMLOListElement>("#blocks")
const viewBody = $<HTMLDivElement>("#view-body")
const issueCount = $<HTMLSpanElement>("#issue-count")
const byteCount = $<HTMLSpanElement>("#byte-count")
const copyBtn = $<HTMLButtonElement>("#copy")

let lastResult: ParseResult | null = null
let lastBytes: Uint8Array = new Uint8Array()

/* ---------- Block list ---------- */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const seg = (name: string, value: string | number, opts: [string | number, string][]) =>
  `<div class="seg seg--sm" role="radiogroup" aria-label="${name}">${opts
    .map(([v, l]) => `<button type="button" class="seg__btn" role="radio" data-opt="${name}" data-val="${v}" aria-checked="${String(v) === String(value)}">${l}</button>`)
    .join("")}</div>`

const toggle = (name: keyof typeof ICON, on: boolean, title: string) =>
  `<button type="button" class="tog" data-tog="${name}" aria-pressed="${on}" title="${title}" aria-label="${title}">${icon(name)}</button>`

const ALIGN_OPTS: [Align, string][] = [["left", "좌"], ["center", "중"], ["right", "우"]]

const blockBody = (b: Block): string => {
  switch (b.kind) {
    case "init":
      return `<p class="blk__note">ESC @ — 스타일·정렬 리셋. 보통 맨 앞에 하나.</p>`
    case "text":
      return `
        <textarea class="blk__text" data-field="text" rows="${Math.min(6, Math.max(1, b.text.split("\n").length))}" spellcheck="false" placeholder="한 줄에 한 행">${escapeHtml(b.text)}</textarea>
        <div class="blk__opts">
          ${seg("align", b.align, ALIGN_OPTS)}
          <div class="togs" role="group" aria-label="스타일">
            ${toggle("bold", b.bold, "굵게 · ESC E")}
            ${toggle("double", b.double, "2배 크기 · ESC ! 0x30")}
            ${toggle("underline", b.underline, "밑줄 · ESC -")}
            ${toggle("reverse", b.reverse, "흑백 반전 · GS B")}
          </div>
        </div>`
    case "rule":
      return `<div class="blk__opts">${seg("ch", b.ch, [["-", "- - -"], ["=", "= = ="], ["*", "* * *"], ["_", "_ _ _"]])}<span class="blk__note">용지 폭만큼 반복</span></div>`
    case "feed":
      return `<div class="blk__opts"><label class="num"><input class="num__input" data-field="lines" type="number" min="1" max="24" value="${b.lines}" aria-label="피드 줄 수" /><span>줄</span></label><span class="blk__note">ESC d n</span></div>`
    case "barcode":
      return `
        <input class="blk__input" data-field="data" type="text" value="${escapeHtml(b.data)}" spellcheck="false" aria-label="바코드 데이터" placeholder="데이터" />
        <div class="blk__opts">
          ${seg("align", b.align, ALIGN_OPTS)}
          <label class="num"><span>높이</span><input class="num__input" data-field="height" type="number" min="1" max="255" value="${b.height}" aria-label="바코드 높이" /></label>
          <label class="num"><span>폭</span>${seg("width", b.width, [[2, "2"], [3, "3"], [4, "4"]])}</label>
        </div>
        <div class="blk__opts">
          <span class="blk__note">HRI</span>${seg("hri", b.hri, [[0, "없음"], [1, "위"], [2, "아래"], [3, "양쪽"]])}
          <span class="blk__note">CODE128</span>
        </div>`
    case "cut":
      return `<div class="blk__opts">${seg("partial", String(b.partial), [["false", "전체"], ["true", "부분"]])}<span class="blk__note">GS V</span></div>`
  }
}

const renderBlocks = () => {
  blocksEl.replaceChildren()
  if (!state.blocks.length) {
    blocksEl.innerHTML = `<li class="blocks__empty">초기화만 있음. 아래에서 블록 추가.</li>`
    return
  }
  state.blocks.forEach((b, i) => {
    const li = document.createElement("li")
    li.className = "blk"
    li.dataset.idx = String(i)
    li.dataset.kind = b.kind
    li.innerHTML = `
      <div class="blk__head">
        <span class="blk__kind">${icon(b.kind)}${BLOCK_LABEL[b.kind]}</span>
        <div class="blk__tools">
          <button type="button" class="tool" data-act="up" aria-label="위로" title="위로" ${i === 0 ? "disabled" : ""}>${icon("up")}</button>
          <button type="button" class="tool" data-act="down" aria-label="아래로" title="아래로" ${i === state.blocks.length - 1 ? "disabled" : ""}>${icon("down")}</button>
          <button type="button" class="tool" data-act="dup" aria-label="복제" title="복제">${icon("copy")}</button>
          <button type="button" class="tool tool--danger" data-act="del" aria-label="삭제" title="삭제">${icon("trash")}</button>
        </div>
      </div>
      <div class="blk__body">${blockBody(b)}</div>`
    blocksEl.appendChild(li)
  })
}

/* ---------- Sync & render ---------- */

const syncControls = () => {
  if (source.value !== state.source) source.value = state.source
  encoding.value = state.encoding
  encoding.disabled = state.format !== "hex"
  for (const b of $$<HTMLButtonElement>("[data-cols]")) b.setAttribute("aria-checked", String(Number(b.dataset.cols) === state.cols))
  for (const b of $$<HTMLButtonElement>("[data-format]")) b.setAttribute("aria-checked", String(b.dataset.format === state.format))
  for (const b of $$<HTMLButtonElement>("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === state.tab))
  for (const b of $$<HTMLButtonElement>("[data-mode]")) b.setAttribute("aria-selected", String(b.dataset.mode === state.mode))
  for (const el of $$<HTMLElement>("[data-only-mode]")) el.hidden = el.dataset.onlyMode !== state.mode
}

const currentSource = () => (state.mode === "build" ? serialize(state.blocks, state.cols) : state.source)
const currentFormat = (): InputFormat => (state.mode === "build" ? "escaped" : state.format)

const render = () => {
  const decoded = decodeInput(currentSource(), currentFormat(), state.encoding)
  lastBytes = decoded.bytes
  lastResult = parseEscPos(decoded.text, { decodeText: decoded.decodeText })

  hint.textContent = decoded.note
  hint.dataset.level = decoded.error ? "warn" : "info"

  const warnings = lastResult.diagnostics.filter((d) => d.level === "warn").length
  issueCount.textContent = String(lastResult.diagnostics.length)
  issueCount.dataset.level = warnings ? "warn" : lastResult.diagnostics.length ? "info" : "none"
  byteCount.textContent = `${decoded.bytes.length} B · ${lastResult.nodes.length} nodes${state.mode === "build" ? ` · ${state.blocks.length} blocks` : ""}`

  viewBody.replaceChildren()
  viewBody.dataset.tab = state.tab
  if (state.tab === "preview") viewBody.appendChild(renderReceipt(lastResult, state.cols))
  else if (state.tab === "raw") viewBody.appendChild(renderTokens(lastResult))
  else viewBody.appendChild(renderIssues(lastResult))

  saveState(state)
}

const renderIssues = (r: ParseResult) => {
  const wrap = document.createElement("div")
  wrap.className = "issues"
  if (!r.diagnostics.length) {
    wrap.innerHTML = `<p class="issues__empty">모든 명령을 해석했음. 경고 없음.</p>`
    return wrap
  }
  const list = document.createElement("ol")
  list.className = "issues__list"
  for (const d of r.diagnostics) {
    const li = document.createElement("li")
    li.className = "issue"
    li.dataset.level = d.level
    li.innerHTML = `
      <span class="issue__level">${d.level}</span>
      <span class="issue__offset">@${d.offset}</span>
      <code class="issue__raw">${d.raw}</code>
      <p class="issue__msg"></p>`
    li.querySelector(".issue__msg")!.textContent = d.message
    list.appendChild(li)
  }
  wrap.appendChild(list)
  return wrap
}

/* ---------- Events: direct editor ---------- */

let timer = 0
const scheduleRender = () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 80)
}

source.addEventListener("input", () => {
  state.source = source.value
  scheduleRender()
})

source.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return
  e.preventDefault()
  const { selectionStart: s, selectionEnd: en } = source
  source.setRangeText("\\t", s, en, "end")
  state.source = source.value
  scheduleRender()
})

encoding.addEventListener("change", () => {
  state.encoding = encoding.value as TextEncoding
  render()
})

/* ---------- Events: builder ---------- */

const blockAt = (el: HTMLElement) => {
  const li = el.closest<HTMLLIElement>(".blk")
  if (!li) return null
  const idx = Number(li.dataset.idx)
  return { li, idx, block: state.blocks[idx] }
}

blocksEl.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement | HTMLTextAreaElement
  const field = t.dataset.field
  const hit = blockAt(t)
  if (!field || !hit) return
  const b = hit.block as Record<string, unknown>
  b[field] = t.type === "number" ? Number(t.value) || 0 : t.value
  if (t instanceof HTMLTextAreaElement) t.rows = Math.min(6, Math.max(1, t.value.split("\n").length))
  scheduleRender()
})

blocksEl.addEventListener("click", (e) => {
  const target = e.target as HTMLElement
  const hit = blockAt(target)
  if (!hit) return

  const opt = target.closest<HTMLElement>("[data-opt]")
  if (opt) {
    const name = opt.dataset.opt!
    const raw = opt.dataset.val!
    const b = hit.block as Record<string, unknown>
    const cur = b[name]
    b[name] = typeof cur === "number" ? Number(raw) : typeof cur === "boolean" ? raw === "true" : raw
    for (const sib of opt.parentElement!.querySelectorAll("[data-opt]")) sib.setAttribute("aria-checked", String(sib === opt))
    render()
    return
  }

  const tog = target.closest<HTMLElement>("[data-tog]")
  if (tog) {
    const name = tog.dataset.tog!
    const b = hit.block as Record<string, unknown>
    b[name] = !b[name]
    tog.setAttribute("aria-pressed", String(b[name]))
    render()
    return
  }

  const act = target.closest<HTMLElement>("[data-act]")?.dataset.act
  if (!act) return
  const { idx } = hit
  const arr = state.blocks
  if (act === "up" && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  else if (act === "down" && idx < arr.length - 1) [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]
  else if (act === "dup") arr.splice(idx + 1, 0, structuredClone(arr[idx]))
  else if (act === "del") arr.splice(idx, 1)
  renderBlocks()
  render()
  const focusIdx = act === "up" ? idx - 1 : act === "down" ? idx + 1 : act === "dup" ? idx + 1 : Math.min(idx, arr.length - 1)
  blocksEl.querySelector<HTMLElement>(`.blk[data-idx="${focusIdx}"] [data-act="${act === "del" ? "del" : act}"]`)?.focus()
})

/* ---------- Toast ---------- */

let toastTimer = 0
const toast = (message: string, level: "info" | "warn" = "info") => {
  window.clearTimeout(toastTimer)
  toastEl.innerHTML = `${icon(level)}<span class="toast__text"></span>`
  toastEl.querySelector(".toast__text")!.textContent = message
  toastEl.dataset.level = level
  toastEl.hidden = false
  toastEl.classList.remove("is-in")
  void toastEl.offsetWidth
  toastEl.classList.add("is-in")
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove("is-in")
    toastTimer = window.setTimeout(() => { toastEl.hidden = true }, 200)
  }, 3000)
}

/* ---------- Mode switch: one content, two editors ---------- */

const switchMode = (next: State["mode"]) => {
  if (next === state.mode) return
  if (next === "direct") {
    state.source = serialize(state.blocks, state.cols)
    state.format = "escaped"
  } else {
    const unchanged = state.source === serialize(state.blocks, state.cols)
    if (!unchanged) {
      const decoded = decodeInput(state.source, state.format, state.encoding)
      const parsed = parseEscPos(decoded.text, { decodeText: decoded.decodeText })
      const { blocks, lossy } = blocksFromParse(parsed, state.cols)
      state.blocks = blocks
      if (state.format === "hex") lossy.unshift("hex 입력을 블록으로 변환")
      if (lossy.length) toast("블록으로 변환되지 않는 명령이 있습니다.", "warn")
    }
    renderBlocks()
  }
  state.mode = next
}

/* ---------- Reference dialog ---------- */

const refDialog = $<HTMLDialogElement>("#ref-dialog")
$("#open-ref").addEventListener("click", () => refDialog.showModal())
$("#close-ref").addEventListener("click", () => refDialog.close())
refDialog.addEventListener("click", (e) => {
  if (e.target === refDialog) refDialog.close() // backdrop
})

/* ---------- Events: shared ---------- */

$("#reset").addEventListener("click", () => {
  state.blocks = []
  state.source = state.mode === "build" ? serialize([], state.cols) : ""
  renderBlocks()
  syncControls()
  render()
  if (state.mode === "build") blocksEl.nextElementSibling?.querySelector<HTMLElement>("[data-add]")?.focus()
  else source.focus()
})

app.addEventListener("click", (e) => {
  const target = e.target as HTMLElement

  const add = target.closest<HTMLElement>("[data-add]")
  if (add) {
    state.blocks.push(newBlock(add.dataset.add as Block["kind"]))
    renderBlocks()
    render()
    const last = blocksEl.querySelector<HTMLElement>(`.blk[data-idx="${state.blocks.length - 1}"]`)
    last?.scrollIntoView({ block: "nearest" })
    last?.querySelector<HTMLElement>("[data-field]")?.focus()
    return
  }

  const demo = target.closest<HTMLElement>("[data-demo]")
  if (demo) {
    if (demo.dataset.demo === "receipt") {
      state.blocks = structuredClone(DEMO_RECEIPT_BLOCKS)
      state.source = serialize(state.blocks, state.cols)
    } else {
      state.source = DEMO_BASIC
      const parsed = parseEscPos(decodeInput(DEMO_BASIC, "escaped", "utf-8").text)
      state.blocks = blocksFromParse(parsed, state.cols).blocks
    }
    state.format = "escaped"
    renderBlocks()
    syncControls()
    render()
    return
  }

  const el = target.closest<HTMLElement>("[data-cols],[data-tab],[data-format],[data-mode]")
  if (!el) return
  if (el.dataset.cols) state.cols = Number(el.dataset.cols) as State["cols"]
  if (el.dataset.tab) state.tab = el.dataset.tab as State["tab"]
  if (el.dataset.format) state.format = el.dataset.format as InputFormat
  if (el.dataset.mode) switchMode(el.dataset.mode as State["mode"])
  syncControls()
  render()
})

copyBtn.addEventListener("click", async () => {
  if (!lastResult) return
  const hex = Array.from(lastBytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ")
  try {
    await navigator.clipboard.writeText(hex)
    copyBtn.dataset.state = "success"
    copyBtn.textContent = "Copied"
  } catch {
    copyBtn.dataset.state = "error"
    copyBtn.textContent = "Clipboard blocked"
  }
  window.setTimeout(() => {
    copyBtn.dataset.state = ""
    copyBtn.textContent = "Copy hex"
  }, 1400)
})

renderBlocks()
syncControls()
render()
