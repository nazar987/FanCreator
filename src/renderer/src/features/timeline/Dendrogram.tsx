import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { TimelineEvent } from '@shared/types'

/**
 * Древовидная диаграмма (tree diagram): дерево событий слева-направо с прямыми
 * локтевыми соединителями и прямоугольными узлами. Доп-вид таймлайна.
 */
interface DendrogramProps {
  /** События верхнего уровня (корни). */
  events: TimelineEvent[]
  childrenOf: (parentId: string) => TimelineEvent[]
  onEdit: (event: TimelineEvent) => void
  onAddChild: (event: TimelineEvent) => void
  onDelete: (event: TimelineEvent) => void
}

const NODE_W = 210
const NODE_H = 68
const COL_W = 300
const ROW_H = 92

interface Placed {
  event: TimelineEvent
  x: number
  y: number
  depth: number
}
interface Link {
  x1: number
  y1: number
  x2: number
  y2: number
  midX: number
}

export function Dendrogram({
  events,
  childrenOf,
  onEdit,
  onAddChild,
  onDelete
}: DendrogramProps): React.JSX.Element {
  const { nodes, links, width, height } = React.useMemo(() => {
    const nodes: Placed[] = []
    const links: Link[] = []
    let leaf = 0
    let maxDepth = 0

    // tidy-tree: лист получает свой ряд, родитель центрируется по детям
    const layout = (event: TimelineEvent, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth)
      const kids = childrenOf(event.id)
      const x = depth * COL_W
      let y: number
      if (kids.length === 0) {
        y = leaf * ROW_H + ROW_H / 2
        leaf++
      } else {
        const childYs = kids.map((kid) => layout(kid, depth + 1))
        y = (childYs[0] + childYs[childYs.length - 1]) / 2
        kids.forEach((_, idx) => {
          links.push({
            x1: x + NODE_W,
            y1: y,
            x2: (depth + 1) * COL_W,
            y2: childYs[idx],
            midX: x + NODE_W + (COL_W - NODE_W) / 2
          })
        })
      }
      nodes.push({ event, x, y, depth })
      return y
    }

    events.forEach((event) => layout(event, 0))
    const width = (maxDepth + 1) * COL_W + 28
    const height = Math.max(leaf, 1) * ROW_H + 20
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
        {nodes.map(({ event, x, y, depth }) => (
          <div
            key={event.id}
            className={`dendro-node ${depth === 0 ? 'dendro-node--root' : ''}`}
            style={{ left: x, top: y - NODE_H / 2, width: NODE_W, minHeight: NODE_H }}
            title={event.note || undefined}
            onDoubleClick={() => onEdit(event)}
          >
            <div className="dendro-node-text">
              {event.title || <span className="dendro-node-placeholder">Название…</span>}
            </div>
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
