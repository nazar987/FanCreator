import React from 'react'
import { Plus, Trash2, Tag, ChevronRight, ChevronDown, Palette } from 'lucide-react'
import { measureTextWidth } from '../../shared/measureText'
import { openColorPicker } from '../../shared/ui/ColorPalette'

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
  color?: string
}

interface DendrogramProps {
  events: DendroNode[]
  childrenOf: (parentId: string) => DendroNode[]
  /** Сохранить название узла (инлайн-редактор, как на доске). */
  onSetTitle: (event: DendroNode, title: string) => void
  onAddChild: (event: DendroNode) => void
  onDelete: (event: DendroNode) => void
  onToggleCollapse?: (event: DendroNode) => void
  /** Сохранить подпись связи «родитель → этот узел» (инлайн-редактор). */
  onSetEdgeLabel?: (event: DendroNode, value: string) => void
  onSetColor?: (event: DendroNode, color: string) => void
}

// блок авто-размера: ширина растёт под текст до максимума, дальше — перенос строк
const NODE_MIN_W = 150
const NODE_MAX_W = 340
const NODE_MIN_H = 56
const NODE_PAD_X = 30 // суммарные горизонтальные поля внутри блока
const NODE_PAD_Y = 26
const NODE_FONT = '600 13.5px Inter, system-ui, sans-serif'

const ROW_GAP = 26 // вертикальный зазор между блоками
const ROOT_GAP = 34 // доп. воздух между независимыми деревьями (корнями)
const STUB = 26 // вывод от родителя до вертикальной «шины»
const LEAD_MIN = 42 // мин. горизонтальный заход к ребёнку
const LABEL_PAD = 24
const LABEL_MAX = 230
const LABEL_FONT = '600 11px Inter, system-ui, sans-serif'

const clamp = (min: number, v: number, max: number): number => Math.max(min, Math.min(v, max))

/** Найти узел по id во всём дереве (events — только корни). */
function findInTree(
  roots: DendroNode[],
  childrenOf: (parentId: string) => DendroNode[],
  id: string
): DendroNode | null {
  const stack = [...roots]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === id) return n
    stack.push(...childrenOf(n.id))
  }
  return null
}

/**
 * Высоту текста меряем РЕАЛЬНОЙ вёрсткой (скрытый div с теми же стилями, что
 * .dendro-node-text): прежняя оценка «ширина ÷ строки» промахивалась на переносах
 * длинных слов, и блоки с большим текстом наезжали на соседей снизу.
 */
let measurer: HTMLDivElement | null = null
function measureTextHeight(text: string, width: number): number {
  if (!measurer) {
    measurer = document.createElement('div')
    const s = measurer.style
    s.position = 'absolute'
    s.left = '-99999px'
    s.top = '0'
    s.visibility = 'hidden'
    s.font = NODE_FONT
    s.lineHeight = '1.3'
    s.whiteSpace = 'pre-wrap'
    s.overflowWrap = 'anywhere'
    s.wordBreak = 'break-word'
    s.textAlign = 'center'
    document.body.appendChild(measurer)
  }
  measurer.style.width = `${width}px`
  measurer.textContent = text
  return measurer.offsetHeight
}

function nodeSize(text: string): { w: number; h: number } {
  const t = text || 'Название…'
  // ширина — по самой длинной СТРОКЕ (текст узла может быть многострочным)
  const textW = Math.max(...t.split('\n').map((line) => measureTextWidth(line, NODE_FONT)))
  const w = clamp(NODE_MIN_W, textW + NODE_PAD_X, NODE_MAX_W)
  const h = Math.max(NODE_MIN_H, measureTextHeight(t, w - NODE_PAD_X) + NODE_PAD_Y)
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
  color?: string
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
  color?: string
}

export function Dendrogram({
  events,
  childrenOf,
  onSetTitle,
  onAddChild,
  onDelete,
  onToggleCollapse,
  onSetEdgeLabel,
  onSetColor
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

  // инлайн-редактор НАЗВАНИЯ узла (как на доске, без всплывающего окна)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [titleDraft, setTitleDraft] = React.useState('')
  const cancelTitle = React.useRef(false)
  const startEdit = (node: DendroNode): void => {
    cancelTitle.current = false
    setTitleDraft(node.title ?? '')
    setEditId(node.id)
  }
  const finishEdit = (node: DendroNode): void => {
    if (editId !== node.id) return
    if (!cancelTitle.current) onSetTitle(node, titleDraft.trim())
    cancelTitle.current = false
    setEditId(null)
  }

  // Черновик НЕ теряется при переключении вкладки: blur при размонтировании React
  // не шлёт, поэтому сохраняем сами в cleanup-эффекте (фидбэк: «написала текст,
  // сразу переключила вкладку — всё исчезло»).
  const editingRef = React.useRef<{ node: DendroNode; draft: string } | null>(null)
  const editingNode = editId ? (events.find((e) => e.id === editId) ?? findInTree(events, childrenOf, editId)) : null
  editingRef.current = editingNode ? { node: editingNode, draft: titleDraft } : null
  const onSetTitleRef = React.useRef(onSetTitle)
  onSetTitleRef.current = onSetTitle
  React.useEffect(
    () => () => {
      const e = editingRef.current
      if (e && e.draft.trim() !== (e.node.title ?? '').trim()) onSetTitleRef.current(e.node, e.draft.trim())
    },
    []
  )

  const { nodes, links, width, height } = React.useMemo(() => {
    const nodes: Placed[] = []
    const links: Link[] = []
    let cursor = 0
    let width = 0

    // Во время набора раскладка считается от ЧЕРНОВИКА редактируемого узла:
    // ячейка растёт по ширине и высоте прямо при вводе, соседи раздвигаются
    // (раньше textarea вылезала поверх нижних узлов до сохранения).
    const titleOf = (node: DendroNode): string => (node.id === editId ? titleDraft : node.title)

    const countDescendants = (id: string): number => {
      const kids = childrenOf(id)
      return kids.reduce((sum, kid) => sum + 1 + countDescendants(kid.id), 0)
    }

    // Каждый корень раскладывается НЕЗАВИСИМО: свои ширины колонок и зазоры под
    // подписи. Иначе длинный текст в одном дереве раздвигал колонки всех
    // остальных деревьев на листе (фидбэк: «удлиняю белую ячейку — уезжают и жёлтые»).
    for (const root of events) {
      let maxDepth = 0
      const sizeMap = new Map<string, { w: number; h: number }>()
      const colW: number[] = []
      const labelWByDepth: number[] = []

      // 1) предпроход: размеры блоков, ширина колонок, длина подписей по уровням
      const scan = (node: DendroNode, depth: number): void => {
        maxDepth = Math.max(maxDepth, depth)
        const s = nodeSize(titleOf(node))
        sizeMap.set(node.id, s)
        colW[depth] = Math.max(colW[depth] ?? 0, s.w)
        if (node.edgeLabel) {
          labelWByDepth[depth] = Math.max(labelWByDepth[depth] ?? 0, measureTextWidth(node.edgeLabel, LABEL_FONT))
        }
        if (node.collapsed) return
        childrenOf(node.id).forEach((kid) => scan(kid, depth + 1))
      }
      scan(root, 0)

      // 2) x-координаты колонок: ширина колонки + зазор под подпись уровня
      const colX: number[] = [0]
      for (let d = 1; d <= maxDepth; d++) {
        const labelW = Math.min(labelWByDepth[d] ?? 0, LABEL_MAX)
        const lead = labelW > 0 ? labelW + LABEL_PAD : LEAD_MIN
        colX[d] = colX[d - 1] + (colW[d - 1] ?? NODE_MIN_W) + STUB + lead
      }

      // 3) раскладка: вертикальный курсор по фактической высоте блоков
      const layout = (node: DendroNode, depth: number, inheritedColor?: string): number => {
        const s = sizeMap.get(node.id) ?? nodeSize(titleOf(node))
        const color = node.color || inheritedColor
        const allKids = childrenOf(node.id)
        const hasChildren = allKids.length > 0
        const kids = node.collapsed ? [] : allKids
        const x = colX[depth]
        let y: number
        if (kids.length === 0) {
          y = cursor + s.h / 2
          cursor += s.h + ROW_GAP
        } else {
          const childYs = kids.map((kid) => layout(kid, depth + 1, color))
          y = (childYs[0] + childYs[childYs.length - 1]) / 2
          const x1 = x + s.w
          const midX = x1 + STUB
          const x2 = colX[depth + 1]
          kids.forEach((kid, idx) => {
            const childColor = kid.color || color
            links.push({
              x1,
              y1: y,
              x2,
              y2: childYs[idx],
              midX,
              labelX: (midX + x2) / 2,
              labelY: childYs[idx],
              child: kid,
              color: childColor
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
          hiddenCount: node.collapsed && hasChildren ? countDescendants(node.id) : 0,
          color
        })
        return y
      }
      layout(root, 0)
      cursor += ROOT_GAP // воздух между деревьями
      width = Math.max(width, colX[maxDepth] + (colW[maxDepth] ?? NODE_MIN_W) + 28)
    }

    const height = Math.max(cursor, NODE_MIN_H) + 12
    return { nodes, links, width, height }
  }, [events, childrenOf, editId, titleDraft])

  return (
    <div className="dendro-scroll">
      <div className="dendro" style={{ width, height }}>
        <svg className="dendro-svg" width={width} height={height}>
          {links.map((l, i) => (
            <path
              key={i}
              d={`M ${l.x1} ${l.y1} H ${l.midX} V ${l.y2} H ${l.x2}`}
              fill="none"
              stroke={l.color || 'var(--stroke-strong)'}
              strokeWidth={l.color ? 2 : 1.5}
              opacity={l.color ? 0.78 : undefined}
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
              style={{ left: l.labelX, top: l.labelY, color: l.color }}
              title="Изменить подпись связи"
              onClick={() => startEdge(l.child)}
            >
              {l.child.edgeLabel}
            </button>
          ) : null
        })}
        {nodes.map(({ event, x, y, w, h, depth, hasChildren, hiddenCount, color }) => {
          const nodeStyle: React.CSSProperties = { left: x, top: y - h / 2, width: w, minHeight: h }
          if (color) {
            nodeStyle.borderColor = color
            // только внутренняя обводка: цветная тень-свечение под узлом смотрелась
            // «странным световым пятном» на тёмном фоне (фидбэк v2.1.2)
            nodeStyle.boxShadow = `0 0 0 2px ${color} inset`
            nodeStyle.background = `linear-gradient(160deg, color-mix(in srgb, ${color} 38%, var(--surface-2, var(--panel-solid))), color-mix(in srgb, ${color} 22%, var(--surface-2, var(--panel-solid))))`
          }

          return (
            <div
            key={event.id}
            className={`dendro-node ${depth === 0 ? 'dendro-node--root' : ''} ${
              event.collapsed ? 'dendro-node--collapsed' : ''
            }`}
            style={nodeStyle}
            title={event.note || undefined}
            onDoubleClick={(e) => {
              e.stopPropagation()
              startEdit(event)
            }}
          >
            {editId === event.id ? (
              // многострочный ввод (как в стикерах на доске): Enter — новая строка,
              // Ctrl+Enter — сохранить, Esc — отмена, клик вне — сохранить
              <textarea
                className="dendro-node-input"
                value={titleDraft}
                autoFocus
                rows={1}
                placeholder="Название…"
                ref={(el) => {
                  if (!el) return
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }}
                onChange={(e) => {
                  setTitleDraft(e.target.value)
                  e.currentTarget.style.height = 'auto'
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                }}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => finishEdit(event)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    cancelTitle.current = true
                    e.currentTarget.blur()
                  }
                }}
              />
            ) : (
              <div className="dendro-node-text">
                {event.title || <span className="dendro-node-placeholder">Название…</span>}
              </div>
            )}
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
              {onSetColor && (
                <button
                  title="Цвет узла"
                  onClick={(e) => {
                    e.stopPropagation()
                    openColorPicker({
                      value: color,
                      title: 'Цвет узла',
                      onChange: (c) => onSetColor(event, c),
                      onClear: () => onSetColor(event, ''),
                      clearLabel: 'Как у родителя'
                    })
                  }}
                >
                  <Palette size={12} />
                </button>
              )}
              <button
                title="Переименовать"
                className="dendro-node-edit"
                onClick={(e) => {
                  e.stopPropagation()
                  startEdit(event)
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
          )
        })}
      </div>
    </div>
  )
}
