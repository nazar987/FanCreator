import React from 'react'
import { Plus, Trash2, Tag, ChevronRight, ChevronDown } from 'lucide-react'
import { measureTextWidth } from '../../shared/measureText'

/**
 * Древовидная диаграмма (tree diagram): дерево слева-направо с локтевыми
 * соединителями и прямоугольными узлами. Узлы можно сворачивать (потомки
 * скрываются, но хранятся внутри) и подписывать связи между блоками.
 *
 * Расстояние между уровнями растягивается под самую длинную подпись на этом
 * уровне — поэтому подписи всегда лежат горизонтально на линии и ничего не
 * перекрывают.
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
const ROW_H = 92
const BASE_GAP = 90 // зазор между уровнями, когда подписей нет
const STUB = 26 // вывод от родителя до вертикальной «шины»
const LABEL_PAD = 24 // воздух вокруг подписи на линии
const LABEL_MAX = 230 // потолок ширины колонки под длинную подпись
const LABEL_FONT = '600 11px Inter, system-ui, sans-serif'

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

    // 1) предпроход: самая длинная подпись на каждом уровне (учитываем свёрнутость)
    const labelWByDepth: number[] = []
    const scan = (node: DendroNode, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth)
      if (node.edgeLabel) {
        labelWByDepth[depth] = Math.max(labelWByDepth[depth] ?? 0, measureTextWidth(node.edgeLabel, LABEL_FONT))
      }
      if (node.collapsed) return
      childrenOf(node.id).forEach((kid) => scan(kid, depth + 1))
    }
    events.forEach((event) => scan(event, 0))

    // 2) x-координаты колонок: зазор растягивается под подпись уровня
    const colX: number[] = [0]
    for (let d = 1; d <= maxDepth; d++) {
      const labelW = Math.min(labelWByDepth[d] ?? 0, LABEL_MAX)
      const gap = labelW > 0 ? Math.max(BASE_GAP, STUB + labelW + LABEL_PAD) : BASE_GAP
      colX[d] = colX[d - 1] + NODE_W + gap
    }

    // 3) раскладка: лист получает свой ряд, родитель центрируется по детям
    const layout = (event: DendroNode, depth: number): number => {
      const allKids = childrenOf(event.id)
      const hasChildren = allKids.length > 0
      const kids = event.collapsed ? [] : allKids
      const x = colX[depth]
      let y: number
      if (kids.length === 0) {
        y = leaf * ROW_H + ROW_H / 2
        leaf++
      } else {
        const childYs = kids.map((kid) => layout(kid, depth + 1))
        y = (childYs[0] + childYs[childYs.length - 1]) / 2
        kids.forEach((kid, idx) => {
          const x1 = x + NODE_W
          const x2 = colX[depth + 1]
          const midX = x1 + STUB // вертикальная «шина» рядом с родителем
          links.push({
            x1,
            y1: y,
            x2,
            y2: childYs[idx],
            midX,
            labelX: (midX + x2) / 2, // по центру длинного захода к ребёнку
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
    const width = colX[maxDepth] + NODE_W + 28
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
