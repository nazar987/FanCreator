import React from 'react'
import { Plus, Trash2, Tag, ChevronRight, ChevronDown } from 'lucide-react'
import { measureTextWidth } from '../../shared/measureText'

/**
 * Древовидная диаграмма (tree diagram): дерево слева-направо с локтевыми
 * соединителями. Блоки авто-растягиваются под полный текст (ширина и высота),
 * узлы можно сворачивать (потомки скрываются, но хранятся), а связи —
 * подписывать прямо на месте (инлайн, как на доске).
 */
export interface DendroNode {
  id: string
  parentId?: string | null
  title: string
  note?: string
  collapsed?: boolean
  edgeLabel?: string
}

interface DendrogramProps {
  events: DendroNode[]
  childrenOf: (parentId: string) => DendroNode[]
  onEdit: (event: DendroNode) => void
  onAddChild: (event: DendroNode) => void
  onDelete: (event: DendroNode) => void
  onToggleCollapse?: (event: DendroNode) => void
  /** Сохранить подпись связи «родитель → этот узел» (инлайн-редактор). */
  onSetEdgeLabel?: (event: DendroNode, value: string) => void
}

// блок авто-размера: ширина растёт под текст до максимума, дальше — перенос строк
const NODE_MIN_W = 150
const NODE_MAX_W = 340
const NODE_MIN_H = 56
const NODE_PAD_X = 30 // суммарные горизонтальные поля внутри блока
const NODE_PAD_Y = 26
const LINE_H = 18
const NODE_FONT = '600 13.5px Inter, system-ui, sans-serif'

const ROW_GAP = 26 // вертикальный зазор между блоками
const STUB = 26 // вывод от родителя до вертикальной «шины»
const LEAD_MIN = 42 // мин. горизонтальный заход к ребёнку
const LABEL_PAD = 24
const LABEL_MAX = 230
const LABEL_FONT = '600 11px Inter, system-ui, sans-serif'

const clamp = (min: number, v: number, max: number): number => Math.max(min, Math.min(v, max))

function nodeSize(text: string): { w: number; h: number } {
  const t = text || 'Название…'
  const textW = measureTextWidth(t, NODE_FONT)
  const w = clamp(NODE_MIN_W, textW + NODE_PAD_X, NODE_MAX_W)
  const lines = Math.max(1, Math.ceil(textW / (w - NODE_PAD_X)))
  const h = Math.max(NODE_MIN_H, lines * LINE_H + NODE_PAD_Y)
  return { w, h }
}

interface Placed {
  event: DendroNode
  x: number
  y: number
  w: number
  h: number
  depth: number
  hasChildren: boolean
  hiddenCount: number
}
interface Link {
  x1: number
  y1: number
  x2: number
  y2: number
  midX: number
  labelX: number
  labelY: number
  child: DendroNode
}

export function Dendrogram({
  events,
  childrenOf,
  onEdit,
  onAddChild,
  onDelete,
  onToggleCollapse,
  onSetEdgeLabel
}: DendrogramProps): React.JSX.Element {
  const [editEdgeId, setEditEdgeId] = React.useState<string | null>(null)
  const [edgeDraft, setEdgeDraft] = React.useState('')
  const cancelEdge = React.useRef(false)

  const startEdge = (node: DendroNode): void => {
    cancelEdge.current = false
    setEdgeDraft(node.edgeLabel ?? '')
    setEditEdgeId(node.id)
  }
  const finishEdge = (node: DendroNode): void => {
    if (editEdgeId !== node.id) return
    if (!cancelEdge.current) onSetEdgeLabel?.(node, edgeDraft.trim())
    cancelEdge.current = false
    setEditEdgeId(null)
  }

  const { nodes, links, width, height } = React.useMemo(() => {
    const nodes: Placed[] = []
    const links: Link[] = []
    let maxDepth = 0

    const countDescendants = (id: string): number => {
      const kids = childrenOf(id)
      return kids.reduce((sum, kid) => sum + 1 + countDescendants(kid.id), 0)
    }

    // 1) предпроход: размеры блоков, ширина колонок, длина подписей по уровням
    const sizeMap = new Map<string, { w: number; h: number }>()
    const colW: number[] = []
    const labelWByDepth: number[] = []
    const scan = (node: DendroNode, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth)
      const s = nodeSize(node.title)
      sizeMap.set(node.id, s)
      colW[depth] = Math.max(colW[depth] ?? 0, s.w)
      if (node.edgeLabel) {
        labelWByDepth[depth] = Math.max(labelWByDepth[depth] ?? 0, measureTextWidth(node.edgeLabel, LABEL_FONT))
      }
      if (node.collapsed) return
      childrenOf(node.id).forEach((kid) => scan(kid, depth + 1))
    }
    events.forEach((event) => scan(event, 0))

    // 2) x-координаты колонок: ширина колонки + зазор под подпись уровня
    const colX: number[] = [0]
    for (let d = 1; d <= maxDepth; d++) {
      const labelW = Math.min(labelWByDepth[d] ?? 0, LABEL_MAX)
      const lead = labelW > 0 ? labelW + LABEL_PAD : LEAD_MIN
      colX[d] = colX[d - 1] + (colW[d - 1] ?? NODE_MIN_W) + STUB + lead
    }

    // 3) раскладка: вертикальный курсор по фактической высоте блоков
    let cursor = 0
    const layout = (node: DendroNode, depth: number): number => {
      const s = sizeMap.get(node.id) ?? nodeSize(node.title)
      const allKids = childrenOf(node.id)
      const hasChildren = allKids.length > 0
      const kids = node.collapsed ? [] : allKids
      const x = colX[depth]
      let y: number
      if (kids.length === 0) {
        y = cursor + s.h / 2
        cursor += s.h + ROW_GAP
      } else {
        const childYs = kids.map((kid) => layout(kid, depth + 1))
        y = (childYs[0] + childYs[childYs.length - 1]) / 2
        const x1 = x + s.w
        const midX = x1 + STUB
        const x2 = colX[depth + 1]
        kids.forEach((kid, idx) => {
          links.push({
            x1,
            y1: y,
            x2,
            y2: childYs[idx],
            midX,
            labelX: (midX + x2) / 2,
            labelY: childYs[idx],
            child: kid
          })
        })
      }
      nodes.push({
        event: node,
        x,
        y,
        w: s.w,
        h: s.h,
        depth,
        hasChildren,
        hiddenCount: node.collapsed && hasChildren ? countDescendants(node.id) : 0
      })
      return y
    }
    events.forEach((event) => layout(event, 0))

    const width = colX[maxDepth] + (colW[maxDepth] ?? NODE_MIN_W) + 28
    const height = Math.max(cursor, NODE_MIN_H) + 12
    return { nodes, links, width, height }
  }, [events, childrenOf])

  return (
    <div className="dendro-scroll">
      <div className="dendro" style={{ width, height }}>
        <svg className="dendro-svg" width={width} height={height}>
          {links.map((l, i) => (
            <path
              key={i}
              d={`M ${l.x1} ${l.y1} H ${l.midX} V ${l.y2} H ${l.x2}`}
              fill="none"
              stroke="var(--stroke-strong)"
              strokeWidth={1.5}
              shapeRendering="crispEdges"
            />
          ))}
        </svg>
        {links.map((l) => {
          const editing = editEdgeId === l.child.id
          if (editing) {
            return (
              <input
                key={`lbl-${l.child.id}`}
                className="dendro-edge-input"
                style={{ left: l.labelX, top: l.labelY, width: clamp(90, edgeDraft.length * 8 + 26, 260) }}
                value={edgeDraft}
                autoFocus
                placeholder="подпись…"
                onChange={(e) => setEdgeDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => finishEdge(l.child)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    cancelEdge.current = true
                    e.currentTarget.blur()
                  }
                }}
              />
            )
          }
          return l.child.edgeLabel ? (
            <button
              key={`lbl-${l.child.id}`}
              className="dendro-edge-label"
              style={{ left: l.labelX, top: l.labelY }}
              title="Изменить подпись связи"
              onClick={() => startEdge(l.child)}
            >
              {l.child.edgeLabel}
            </button>
          ) : null
        })}
        {nodes.map(({ event, x, y, w, h, depth, hasChildren, hiddenCount }) => (
          <div
            key={event.id}
            className={`dendro-node ${depth === 0 ? 'dendro-node--root' : ''} ${
              event.collapsed ? 'dendro-node--collapsed' : ''
            }`}
            style={{ left: x, top: y - h / 2, width: w, minHeight: h }}
            title={event.note || undefined}
            onDoubleClick={() => onEdit(event)}
          >
            <div className="dendro-node-text">
              {event.title || <span className="dendro-node-placeholder">Название…</span>}
            </div>
            {hasChildren && onToggleCollapse && (
              <button
                className="dendro-node-collapse"
                title={event.collapsed ? `Развернуть (скрыто: ${hiddenCount})` : 'Свернуть узел'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleCollapse(event)
                }}
              >
                {event.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                {event.collapsed && <span className="dendro-node-count">{hiddenCount}</span>}
              </button>
            )}
            <div className="dendro-node-actions">
              <button
                title="Добавить дочерний узел"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddChild(event)
                }}
              >
                <Plus size={13} />
              </button>
              {depth > 0 && onSetEdgeLabel && (
                <button
                  title="Подписать связь с родителем"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdge(event)
                  }}
                >
                  <Tag size={12} />
                </button>
              )}
              <button
                title="Переименовать"
                className="dendro-node-edit"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(event)
                }}
              >
                ✎
              </button>
              <button
                title="Удалить"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(event)
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
