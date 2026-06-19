import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { TimelineEvent } from '@shared/types'

/**
 * Дендрограмма (как турнирная сетка): дерево событий слева-направо с локтевыми
 * соединителями. Доп-вид таймлайна рядом с «рыбьей костью» (по просьбе заказчицы).
 */
interface DendrogramProps {
  /** События верхнего уровня (корни). */
  events: TimelineEvent[]
  childrenOf: (parentId: string) => TimelineEvent[]
  onEdit: (event: TimelineEvent) => void
  onAddChild: (event: TimelineEvent) => void
  onDelete: (event: TimelineEvent) => void
}

const NODE_W = 196
const NODE_H = 54
const COL_W = 252
const ROW_H = 76

interface Placed {
  event: TimelineEvent
  x: number
  y: number
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
      nodes.push({ event, x, y })
      return y
    }

    events.forEach((event) => layout(event, 0))
    const width = (maxDepth + 1) * COL_W + 24
    const height = Math.max(leaf, 1) * ROW_H + 16
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
              strokeWidth={2}
            />
          ))}
        </svg>
        {nodes.map(({ event, x, y }) => (
          <div
            key={event.id}
            className="dendro-node"
            style={{ left: x, top: y - NODE_H / 2, width: NODE_W }}
            title={event.note || undefined}
            onClick={() => onEdit(event)}
          >
            <span className="dendro-node-title truncate">{event.title}</span>
            <span className="dendro-node-actions">
              <button
                title="Добавить под-событие"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddChild(event)
                }}
              >
                <Plus size={13} />
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
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
