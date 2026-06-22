import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'

/**
 * Импорт .docx с сохранением форматирования (S-G7): прямой разбор OOXML
 * (word/document.xml + styles.xml) — шрифт, размер, начертание, цвет,
 * выравнивание, межстрочный интервал, красная строка, картинки.
 *
 * Возвращает HTML с инлайновыми стилями, которые редактор (TextStyle/FontSize/
 * FontFamily/TextAlign/LineHeight/ParagraphIndent) подхватывает при загрузке.
 * Точного совпадения числа страниц с Word нет (другой движок), но вид близкий.
 */
export type SaveDocxImage = (buffer: Buffer, ext: string) => Promise<string>

interface RunStyle {
  font?: string
  sizePt?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
}

const attr = (el: Element | null | undefined, name: string): string | null =>
  el ? el.getAttribute(name) : null

const child = (el: Element, tag: string): Element | null => {
  const list = el.getElementsByTagName(tag)
  return list.length ? (list.item(0) as Element) : null
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** half-points (w:sz) → pt (как в Word: «11pt» рендерится 1:1 с Word). */
const szToPt = (val: string | null): number | undefined =>
  val ? parseInt(val, 10) / 2 : undefined

/** twips (1/20 pt) → px. */
const twipsToPx = (val: string | null): number => (val ? (parseInt(val, 10) / 20) * (96 / 72) : 0)

const onOff = (el: Element | null): boolean => {
  if (!el) return false
  const v = el.getAttribute('w:val')
  return v !== '0' && v !== 'false' && v !== 'none'
}

interface DocDefaults extends RunStyle {
  lineHeight?: string
}

function parseDefaults(stylesXml?: string): DocDefaults {
  if (!stylesXml) return {}
  try {
    const doc = new DOMParser().parseFromString(stylesXml, 'text/xml')
    const rPr = child(doc.documentElement, 'w:rPrDefault')
    const rFonts = rPr ? child(rPr, 'w:rFonts') : null
    const sz = rPr ? child(rPr, 'w:sz') : null
    // межстрочный интервал по умолчанию (docDefaults → pPrDefault → spacing)
    let lineHeight: string | undefined
    const pPrDef = child(doc.documentElement, 'w:pPrDefault')
    const spacing = pPrDef ? child(pPrDef, 'w:spacing') : null
    const lineVal = attr(spacing, 'w:line')
    const lineRule = attr(spacing, 'w:lineRule')
    if (lineVal && (!lineRule || lineRule === 'auto')) lineHeight = (parseInt(lineVal, 10) / 240).toFixed(2)
    return {
      font: attr(rFonts, 'w:ascii') ?? undefined,
      sizePt: szToPt(attr(sz, 'w:val')),
      // Word по умолчанию рисует одинарным с небольшим запасом; если в стилях не
      // задано — берём 1.15 (это и убирает «77 страниц вместо 21»)
      lineHeight: lineHeight ?? '1.15'
    }
  } catch {
    return { lineHeight: '1.15' }
  }
}

function parseRels(relsXml?: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!relsXml) return map
  try {
    const doc = new DOMParser().parseFromString(relsXml, 'text/xml')
    const rels = doc.getElementsByTagName('Relationship')
    for (let i = 0; i < rels.length; i++) {
      const r = rels.item(i) as Element
      const id = r.getAttribute('Id')
      const target = r.getAttribute('Target')
      if (id && target) map.set(id, target)
    }
  } catch {
    /* ignore */
  }
  return map
}

function runStyle(r: Element, def: RunStyle): RunStyle {
  const rPr = child(r, 'w:rPr')
  if (!rPr) return { ...def }
  const rFonts = child(rPr, 'w:rFonts')
  const sz = child(rPr, 'w:sz')
  const color = child(rPr, 'w:color')
  const colorVal = attr(color, 'w:val')
  return {
    font: attr(rFonts, 'w:ascii') ?? def.font,
    sizePt: szToPt(attr(sz, 'w:val')) ?? def.sizePt,
    bold: onOff(child(rPr, 'w:b')),
    italic: onOff(child(rPr, 'w:i')),
    underline: !!child(rPr, 'w:u') && attr(child(rPr, 'w:u'), 'w:val') !== 'none',
    strike: onOff(child(rPr, 'w:strike')),
    color: colorVal && colorVal !== 'auto' ? `#${colorVal}` : undefined
  }
}

function wrapRun(text: string, st: RunStyle): string {
  if (!text) return ''
  let html = escapeHtml(text).replace(/\n/g, '<br>')
  if (st.bold) html = `<strong>${html}</strong>`
  if (st.italic) html = `<em>${html}</em>`
  if (st.underline) html = `<u>${html}</u>`
  if (st.strike) html = `<s>${html}</s>`
  const styles: string[] = []
  if (st.font) styles.push(`font-family: ${st.font}`)
  if (st.sizePt) styles.push(`font-size: ${st.sizePt}pt`)
  if (st.color) styles.push(`color: ${st.color}`)
  return styles.length ? `<span style="${styles.join('; ')}">${html}</span>` : html
}

export async function importDocxToHtml(buffer: Buffer, saveImage: SaveDocxImage): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const documentXml = await zip.file('word/document.xml')?.async('string')
  if (!documentXml) return ''
  const stylesXml = await zip.file('word/styles.xml')?.async('string')
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string')
  const def = parseDefaults(stylesXml)
  const rels = parseRels(relsXml)
  const doc = new DOMParser().parseFromString(documentXml, 'text/xml')
  const body = doc.getElementsByTagName('w:body').item(0) as Element | null
  if (!body) return ''

  // кэш картинок: rId → asset://
  const imageCache = new Map<string, string>()
  const resolveImage = async (rId: string): Promise<string | null> => {
    if (imageCache.has(rId)) return imageCache.get(rId) ?? null
    const target = rels.get(rId)
    if (!target) return null
    const path = `word/${target.replace(/^\//, '')}`
    const file = zip.file(path)
    if (!file) return null
    const buf = (await file.async('nodebuffer')) as Buffer
    const ext = `.${(target.split('.').pop() || 'png').toLowerCase()}`
    const url = await saveImage(buf, ext)
    imageCache.set(rId, url)
    return url
  }

  const out: string[] = []
  const paragraphs = body.getElementsByTagName('w:p')
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs.item(i) as Element
    // пропускаем абзацы, вложенные в другой <w:p> не бывает; но <w:p> в таблицах
    // обрабатываем как обычные абзацы (таблицы — упрощённо)
    const pPr = child(p, 'w:pPr')
    const pStyles: string[] = []
    if (pPr) {
      const jc = attr(child(pPr, 'w:jc'), 'w:val')
      if (jc) pStyles.push(`text-align: ${jc === 'both' ? 'justify' : jc}`)
      const ind = child(pPr, 'w:ind')
      const firstLine = twipsToPx(attr(ind, 'w:firstLine'))
      if (firstLine > 1) pStyles.push(`text-indent: ${(firstLine / 16).toFixed(2)}em`)
      const spacing = child(pPr, 'w:spacing')
      const lineVal = attr(spacing, 'w:line')
      const lineRule = attr(spacing, 'w:lineRule')
      if (lineVal && (!lineRule || lineRule === 'auto')) {
        pStyles.push(`line-height: ${(parseInt(lineVal, 10) / 240).toFixed(2)}`)
      }
    }
    // межстрочный по умолчанию, если у абзаца свой не задан — иначе наш 1.7 раздувает страницы
    if (def.lineHeight && !pStyles.some((s) => s.startsWith('line-height'))) {
      pStyles.push(`line-height: ${def.lineHeight}`)
    }

    // содержимое абзаца: runs (текст) + картинки
    const parts: string[] = []
    for (let n = 0; n < p.childNodes.length; n++) {
      const node = p.childNodes.item(n)
      if (node.nodeType !== 1) continue
      const el = node as Element
      const tag = el.tagName
      if (tag === 'w:r') {
        // картинка внутри run?
        const blips = el.getElementsByTagName('a:blip')
        if (blips.length) {
          const rId = (blips.item(0) as Element).getAttribute('r:embed')
          if (rId) {
            const url = await resolveImage(rId)
            if (url) parts.push(`<img src="${url}">`)
          }
          continue
        }
        const st = runStyle(el, def)
        const texts = el.getElementsByTagName('w:t')
        let txt = ''
        for (let t = 0; t < texts.length; t++) txt += texts.item(t)?.textContent ?? ''
        // переносы строк <w:br/>
        if (el.getElementsByTagName('w:br').length && !txt) parts.push('<br>')
        parts.push(wrapRun(txt, st))
      }
    }
    const inner = parts.join('')
    const styleAttr = pStyles.length ? ` style="${pStyles.join('; ')}"` : ''
    // пустой абзац — просто <p></p> (одна пустая строка). <br> внутри давал ДВЕ строки.
    out.push(`<p${styleAttr}>${inner}</p>`)
  }
  return out.join('')
}
