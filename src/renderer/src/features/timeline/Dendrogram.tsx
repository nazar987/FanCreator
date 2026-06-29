import React from 'react'
import { Plus, Trash2, Tag, ChevronRight, ChevronDown } from 'lucide-react'

/**
 * Древовидная диаграмма (tree diagram): дерево слева-направо с локтевыми
 * соединителями и прямоугольными узлами. Узлы можно сворачивать (потомки
 * скрываются, но хранятся внутри) и подписывать связи между блоками.
 */
export interface DendroNode {
  id: string
  parentId?: string | null
  title: string
  note?: string
  /** Узел свёрнут — потомки скрыты, но хранятся. */
  collapsed?: boolean
  /** Подпись на связи от родителя к этому узлу. */
  edgeLabel?: string
}

interface DendrogramProps {
  /** Узлы верхнего уровня (корни). */
  events: DendroNode[]
  childrenOf: (parentId: string) => DendroNode[]
  onEdit: (event: DendroNode) => void
  onAddChild: (event: DendroNode) => void
  onDelete: (event: DendroNode) => void
  /** Свернуть/развернуть узел (скрыть потомков, сохранив их). */
  onToggleCollapse?: (event: DendroNode) => void
  /** Подписать связь «родитель → этот узел». */
  onEditEdgeLabel?: (event: DendroNode) => void
}

const NODE_W = 210
const NODE_H = 68
const COL_W = 300
const ROW_H = 92

interface Placed {
  event: DendroNode
  x: number
  y: number
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
  /** Точка для подписи связи (на горизонтальном отрезке у потомка). */
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
  onEditEdgeLabel
}: DendrogramProps): React.JSX.Element {
  const { nodes, links, width, height } = React.useMemo(() => {
    const nodes: Placed[] = []
    const links: Link[] = []
    let leaf = 0
    let maxDepth = 0

    // всего потомков в поддереве (для бейджа на свёрнутом узле)
    const countDescendants = (id: string): number => {
      const kids = childrenOf(id)
      return kids.reduce((sum, kid) => sum + 1 + countDescendants(kid.id), 0)
    }

    // tidy-tree: лист получает свой ряд, родитель центрируется по детям
    const layout = (event: DendroNode, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth)
      const allKids = childrenOf(event.id)
      const hasChildren = allKids.length > 0
      const kids = event.collapsed ? [] : allKids
      const x = depth * COL_W
      let y: number
      if (kids.length === 0) {
        y = leaf * ROW_H + ROW_H / 2
        leaf++
      } else {
        const childYs = kids.map((kid) => layout(kid, depth + 1))
        y = (childYs[0] + childYs[childYs.length - 1]) / 2
        kids.forEach((kid, idx) => {
          const x2 = (depth + 1) * COL_W
          const midX = x + NODE_W + (COL_W - NODE_W) / 2
          links.push({
            x1: x + NODE_W,
            y1: y,
            x2,
            y2: childYs[idx],
            midX,
            labelX: midX,
            labelY: childYs[idx],
            child: kid
          })
        })
      }
      nodes.push({
        event,
        x,
        y,
        depth,
        hasChildren,
        hiddenCount: event.collapsed && hasChildren ? countDescendants(event.id) : 0
      })
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
        {links.map((l) =>
          l.child.edgeLabel ? (
            <button
              key={`lbl-${l.child.id}`}
              className="dendro-edge-label"
              style={{ left: l.labelX, top: l.labelY }}
              title="Изменить подпись связи"
              onClick={() => onEditEdgeLabel?.(l.child)}
            >
              {l.child.edgeLabel}
            </button>
          ) : null
        )}
        {nodes.map(({ event, x, y, depth, hasChildren, hiddenCount }) => (
          <div
            key={event.id}
            className={`dendro-node ${depth === 0 ? 'dendro-node--root' : ''} ${
              event.collapsed ? 'dendro-node--collapsed' : ''
            }`}
            style={{ left: x, top: y - NODE_H / 2, width: NODE_W, minHeight: NODE_H }}
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
              {depth > 0 && onEditEdgeLabel && (
                <button
                  title="Подписать связь с родителем"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditEdgeLabel(event)
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
