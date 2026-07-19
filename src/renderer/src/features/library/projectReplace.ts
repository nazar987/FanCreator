import { generateText, type JSONContent } from '@tiptap/core'
import type { Chapter, Project } from '@shared/types'
import { buildExtensions } from '../editor/extensions'

export interface ReplaceOptions {
  caseSensitive: boolean
  wholeWord: boolean
}

export interface ProjectReplaceHit {
  id: string
  storyId: string
  storyTitle: string
  chapterId: string
  chapterTitle: string
  count: number
  snippet: { before: string; match: string; after: string }
}

export interface ChapterReplacePatch {
  content: unknown
  plainText: string
  count: number
}

/** Открытые редакторы обязаны перезагрузить документ заменённых глав —
 * иначе их безусловный save() при размонтировании затрёт замену старым текстом. */
export const CHAPTERS_REPLACED_EVENT = 'fancreator:chapters-replaced'

export interface ChaptersReplacedDetail {
  projectId: string
  changes: { storyId: string; chapterId: string; content: unknown }[]
}

interface TextMatch {
  count: number
  firstIndex: number
  firstText: string
}

const textExtensions = buildExtensions({
  onOpenInternalLink: () => undefined,
  wikiTargetExists: () => true
})

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function matcher(query: string, options: ReplaceOptions): RegExp {
  const escaped = escapeRegex(query)
  const source = options.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
    : escaped
  return new RegExp(source, options.caseSensitive ? 'gu' : 'giu')
}

function inspectText(text: string, query: string, options: ReplaceOptions): TextMatch | null {
  const matches = [...text.matchAll(matcher(query, options))]
  const first = matches[0]
  if (!first || first.index === undefined) return null
  return { count: matches.length, firstIndex: first.index, firstText: first[0] }
}

function makeSnippet(text: string, match: TextMatch): ProjectReplaceHit['snippet'] {
  const radius = 54
  const start = Math.max(0, match.firstIndex - radius)
  const end = Math.min(text.length, match.firstIndex + match.firstText.length + radius)
  return {
    before: `${start > 0 ? '…' : ''}${text.slice(start, match.firstIndex)}`,
    match: match.firstText,
    after: `${text.slice(match.firstIndex + match.firstText.length, end)}${end < text.length ? '…' : ''}`
  }
}

function isHtmlContent(content: unknown): content is { html: string } {
  return (
    typeof content === 'object' &&
    content !== null &&
    'html' in content &&
    typeof (content as { html?: unknown }).html === 'string'
  )
}

function visitPmTextNodes(
  value: unknown,
  visitor: (node: Record<string, unknown>, text: string) => void
): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => visitPmTextNodes(item, visitor))
    return
  }
  const node = value as Record<string, unknown>
  if (node.type === 'text' && typeof node.text === 'string') visitor(node, node.text)
  if (Array.isArray(node.content)) visitPmTextNodes(node.content, visitor)
}

function htmlTextNodes(doc: Document): Text[] {
  const nodes: Text[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node as Text
    if (!text.parentElement?.closest('script, style, noscript, template')) nodes.push(text)
    node = walker.nextNode()
  }
  return nodes
}

function scanContent(
  content: unknown,
  query: string,
  options: ReplaceOptions
): { count: number; snippet: ProjectReplaceHit['snippet'] } | null {
  let count = 0
  let snippet: ProjectReplaceHit['snippet'] | null = null

  if (isHtmlContent(content)) {
    const doc = new DOMParser().parseFromString(content.html, 'text/html')
    for (const node of htmlTextNodes(doc)) {
      const found = inspectText(node.data, query, options)
      if (!found) continue
      count += found.count
      snippet ??= makeSnippet(node.data, found)
    }
  } else {
    visitPmTextNodes(content, (_node, text) => {
      const found = inspectText(text, query, options)
      if (!found) return
      count += found.count
      snippet ??= makeSnippet(text, found)
    })
  }

  return count > 0 && snippet ? { count, snippet } : null
}

export function findProjectReplaceHits(
  project: Project,
  query: string,
  options: ReplaceOptions
): ProjectReplaceHit[] {
  if (!query) return []
  const hits: ProjectReplaceHit[] = []
  for (const story of project.stories) {
    if (story.deletedAt) continue
    for (const chapter of story.chapters) {
      if (chapter.deletedAt || !chapter.content) continue
      const result = scanContent(chapter.content, query, options)
      if (!result) continue
      hits.push({
        id: `${story.id}:${chapter.id}`,
        storyId: story.id,
        storyTitle: story.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title || 'Без названия',
        count: result.count,
        snippet: result.snippet
      })
    }
  }
  return hits
}

function replaceLiteral(
  text: string,
  query: string,
  replacement: string,
  options: ReplaceOptions
): { text: string; count: number } {
  const count = [...text.matchAll(matcher(query, options))].length
  if (count === 0) return { text, count: 0 }
  return { text: text.replace(matcher(query, options), () => replacement), count }
}

function replacePmContent(
  content: unknown,
  query: string,
  replacement: string,
  options: ReplaceOptions
): { content: unknown; count: number } {
  let count = 0
  const walk = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(walk)
    const node = value as Record<string, unknown>
    if (node.type === 'text' && typeof node.text === 'string') {
      const result = replaceLiteral(node.text, query, replacement, options)
      count += result.count
      return result.count ? { ...node, text: result.text } : node
    }
    if (!Array.isArray(node.content)) return node
    return { ...node, content: node.content.map(walk) }
  }
  return { content: walk(content), count }
}

const blockTags = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN',
  'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'UL'
])

function htmlPlainText(root: HTMLElement): string {
  let output = ''
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      output += node.textContent ?? ''
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      output += '\n'
      return
    }
    const block = blockTags.has(node.tagName)
    if (block && output && !output.endsWith('\n')) output += '\n'
    node.childNodes.forEach(visit)
    if (block && !output.endsWith('\n')) output += '\n'
  }
  root.childNodes.forEach(visit)
  return output
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fallbackPmPlainText(content: unknown): string {
  const parts: string[] = []
  visitPmTextNodes(content, (_node, text) => parts.push(text))
  return parts.join(' ').trim()
}

export function replaceChapterContent(
  chapter: Chapter,
  query: string,
  replacement: string,
  options: ReplaceOptions
): ChapterReplacePatch | null {
  if (!query || !chapter.content) return null

  if (isHtmlContent(chapter.content)) {
    const doc = new DOMParser().parseFromString(chapter.content.html, 'text/html')
    let count = 0
    for (const node of htmlTextNodes(doc)) {
      const result = replaceLiteral(node.data, query, replacement, options)
      if (!result.count) continue
      node.data = result.text
      count += result.count
    }
    return count
      ? { content: { html: doc.body.innerHTML }, plainText: htmlPlainText(doc.body), count }
      : null
  }

  const result = replacePmContent(chapter.content, query, replacement, options)
  if (!result.count) return null
  let plainText: string
  try {
    plainText = generateText(result.content as JSONContent, textExtensions)
  } catch {
    plainText = fallbackPmPlainText(result.content)
  }
  return { content: result.content, plainText, count: result.count }
}
