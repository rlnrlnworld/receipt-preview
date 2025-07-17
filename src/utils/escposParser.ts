type StyleState = {
  align: 'left' | 'center' | 'right'
  bold: boolean
  doubleSize: boolean
}

export function parseEscPosToHtml(buffer: Uint8Array): HTMLElement {
  const container = document.createElement('div')
  container.style.fontFamily = `monospace`
  container.style.background = '#fff'
  container.style.padding = '16px'
  container.style.width = '380px'
  container.style.border = '1px solid #ccc'
  container.style.whiteSpace = 'pre-wrap'

  let i = 0
  const decoder = new TextDecoder("utf-8");
  let byteBuffer: number[] = [];
  let style: StyleState = {
    align: 'left',
    bold: false,
    doubleSize: false,
  }

  const flush = () => {
    if (!byteBuffer.length) return;
    const line = document.createElement('div');
    const text = decoder.decode(new Uint8Array(byteBuffer));
    line.textContent = text;
    line.style.textAlign = style.align;
    line.style.fontWeight = style.bold ? 'bold' : 'normal';
    line.style.fontSize = style.doubleSize ? '1.5em' : '1em';
    container.appendChild(line);
    byteBuffer = [];
  }

  while (i < buffer.length) {
    const byte = buffer[i]

    if (byte === 0x1B && buffer[i + 1] === 0x40) {
      // ESC @ → reset
      flush()
      style = { align: 'left', bold: false, doubleSize: false }
      i += 2
    } else if (byte === 0x1B && buffer[i + 1] === 0x61) {
      // ESC a n → alignment
      flush()
      const n = buffer[i + 2]
      style.align = n === 1 ? 'center' : 'left'
      i += 3
    } else if (byte === 0x1B && buffer[i + 1] === 0x21) {
      // ESC ! n → font style
      flush()
      const n = buffer[i + 2]
      style.bold = !!(n & 0x08)
      style.doubleSize = !!(n & 0x30)
      i += 3
    } else if (byte === 0x0A) {
      // LF
      flush()
      i += 1
    } else {
      // 일반 텍스트
      byteBuffer.push(byte);
      i += 1;
    }
  }

  flush()
  return container
}