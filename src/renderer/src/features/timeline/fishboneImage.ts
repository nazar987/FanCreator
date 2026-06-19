import type { TimelineEvent } from '@shared/types'

/**
 * Строит автономный SVG схемы «рыбья кость» (все надписи — нативный SVG, без HTML)
 * и растрит его в PNG dataURL. Используется для экспорта схемы на доску (S-I).
 * Цвета захардкожены (снимок не зависит от темы).
 */

const C = {
  bg: '#14161f',
  edge: '#2a2e3f',
  spine: '#8b8cf0',
  text: '#eef0f6',
  dim: '#9aa0b4',
  node: '#1c2030',
  accent: '#8b8cf0'
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function buildSvg(
  title: string,
  events: TimelineEvent[],
  childrenOf: (parentId: string) => TimelineEvent[]
): { svg: string; width: number; height: number } {
  const STEP = 220
  const START_X = 90
  const SPINE_Y = 240
  const REACH = 150
  const NODE_W = 180
  const NODE_H = 64
  const SUB_LEN = 60
  const width = START_X + events.length * STEP + 300
  const height = 500
  const endX = START_X + events.length * STEP + 40

  const bones = events
    .map((ev, i) => {
      const footX = START_X + (i + 1) * STEP - STEP / 2
      const up = i % 2 === 0
      const nodeCX = footX - 34
      const nodeCY = up ? SPINE_Y - REACH : SPINE_Y + REACH
      const nx = nodeCX - NODE_W / 2
      const ny = nodeCY - NODE_H / 2
      // под-кости вдоль главной кости
      const kids = childrenOf(ev.id)
      const subs = kids
        .map((kid, k) => {
          const t = (k + 1) / (kids.length + 1)
          const px = footX + t * (nodeCX - footX)
          const py = SPINE_Y + t * (nodeCY - SPINE_Y)
          return `
        <line x1="${px}" y1="${py}" x2="${px + SUB_LEN}" y2="${py}" stroke="${C.edge}" stroke-width="1.5"/>
        <text x="${px + SUB_LEN + 6}" y="${py + 4}" font-family="Manrope, sans-serif" font-size="12" fill="${C.dim}">${esc(clip(kid.title, 18))}</text>`
        })
        .join('')
      return `
        <line x1="${footX}" y1="${SPINE_Y}" x2="${nodeCX}" y2="${nodeCY}" stroke="${C.edge}" stroke-width="2"/>
        ${subs}
        <rect x="${nx}" y="${ny}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="${C.node}" stroke="${C.edge}"/>
        <circle cx="${nx}" cy="${ny}" r="11" fill="${C.accent}"/>
        <text x="${nx}" y="${ny + 4}" text-anchor="middle" font-family="Manrope, sans-serif" font-size="12" font-weight="700" fill="#14161f">${i + 1}</text>
        <text x="${nx + 12}" y="${ny + 26}" font-family="Manrope, sans-serif" font-size="13" font-weight="700" fill="${C.text}">${esc(clip(ev.title, 22))}</text>
        <text x="${nx + 12}" y="${ny + 46}" font-family="Manrope, sans-serif" font-size="11" fill="${C.dim}">${esc(clip(ev.note, 26))}</text>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="${C.bg}"/>
    <defs>
      <marker id="fh" markerWidth="14" markerHeight="14" refX="10" refY="6" orient="auto">
        <path d="M0,0 L12,6 L0,12 Z" fill="${C.spine}"/>
      </marker>
    </defs>
    <line x1="${START_X - 30}" y1="${SPINE_Y}" x2="${endX}" y2="${SPINE_Y}" stroke="${C.spine}" stroke-width="4" marker-end="url(#fh)"/>
    <text x="${endX + 8}" y="${SPINE_Y + 5}" font-family="Manrope, sans-serif" font-size="16" font-weight="800" fill="${C.spine}">${esc(clip(title, 22))}</text>
    ${bones}
  </svg>`
  return { svg, width, height }
}

export function buildFishboneImage(
  title: string,
  events: TimelineEvent[],
  childrenOf: (parentId: string) => TimelineEvent[] = () => []
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { svg, width, height } = buildSvg(title, events, childrenOf)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/png'), width, height })
    }
    img.onerror = () => reject(new Error('svg render failed'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}
