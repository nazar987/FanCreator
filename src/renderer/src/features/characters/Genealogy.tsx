import React from 'react'
import { Plus, Trash2, GitBranchPlus, Pencil, Tag, ChevronRight, ChevronDown, Palette } from 'lucide-react'
import type { Genealogy as GenealogyT, GenealogyNode } from '@shared/types'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'
import { promptText, confirmDialog } from '../../shared/ui/dialogs'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { openColorPicker } from '../../shared/ui/ColorPalette'
import { ZoomPan } from '../../shared/ui/ZoomPan'
import { measureTextWidth } from '../../shared/measureText'

// блок авто-размера: ширина растёт под полный текст до максимума, дальше перенос
const NODE_MIN_W = 150
const NODE_MAX_W = 320
const NODE_MIN_H = 56
const NODE_PAD_X = 30
const NODE_PAD_Y = 26
const LINE_H = 18
const DOT_W = 16 // место под цветную точку персонажа
const NODE_FONT = '600 13.5px Inter, system-ui, sans-serif'

const ROW_GAP = 26 // вертикальный зазор между блоками
const STUB = 26 // вывод от родителя до вертикальной «шины»
const LEAD_MIN = 42 // мин. горизонтальный заход к ребёнку
const LABEL_PAD = 24
const LABEL_MAX = 230
const LABEL_FONT = '600 11px Inter, system-ui, sans-serif'

const clamp = (min: number, v: number, max: number): number => Math.max(min, Math.min(v, max))

function nodeSize(text: string, hasDot: boolean): { w: number; h: number } {
  const t = text || 'Персонаж или текст…'
  const textW = measureTextWidth(t, NODE_FONT) + (hasDot ? DOT_W : 0)
  const w = clamp(NODE_MIN_W, textW + NODE_PAD_X, NODE_MAX_W)
  const lines = Math.max(1, Math.ceil(textW / (w - NODE_PAD_X)))
  const h = Math.max(NODE_MIN_H, lines * LINE_H + NODE_PAD_Y)
  return { w, h }
}

interface Placed {
  node: GenealogyNode
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
  child: GenealogyNode
  color?: string
}

/** Дерево родословной (сверху-вниз по поколениям, слева-направо как дендрограмма). */
function GenealogyTree({
  g,
  childrenOf,
  characterById,
  onAddChild,
  onEditNode,
  onEditText,
  onDelete,
  onToggleCollapse,
  onSetEdgeLabel,
  onSetColor,
  onOpenCharacter
}: {
  g: GenealogyT
  childrenOf: (parentId: string | null) => GenealogyNode[]
  characterById: (id: string) => { name: string; color?: string } | undefined
  onAddChild: (parentId: string | null) => void
  onEditNode: (node: GenealogyNode, e: React.MouseEvent) => void
  onEditText: (node: GenealogyNode, title: string) => void
  onDelete: (node: GenealogyNode) => void
  onToggleCollapse: (node: GenealogyNode) => void
  onSetEdgeLabel: (node: GenealogyNode, value: string) => void
  onSetColor: (node: GenealogyNode, color: string) => void
  onOpenCharacter: (characterId: string) => void
}): React.JSX.Element {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const cancelEditRef = React.useRef(false)
  const openCharacterTimerRef = React.useRef<number | null>(null)

  // инлайн-редактор подписи связи (как на доске, без всплывающего окна)
  const [editEdgeId, setEditEdgeId] = React.useState<string | null>(null)
  const [edgeDraft, setEdgeDraft] = React.useState('')
  const cancelEdgeRef = React.useRef(false)
  const startEdge = (node: GenealogyNode): void => {
    cancelEdgeRef.current = false
    setEdgeDraft(node.edgeLabel ?? '')
    setEditEdgeId(node.id)
  }
  const finishEdge = (node: GenealogyNode): void => {
    if (editEdgeId !== node.id) return
    if (!cancelEdgeRef.current) onSetEdgeLabel(node, edgeDraft.trim())
    cancelEdgeRef.current = false
    setEditEdgeId(null)
  }

  const startTextEdit = (node: GenealogyNode): void => {
    if (openCharacterTimerRef.current != null) {
      window.clearTimeout(openCharacterTimerRef.current)
      openCharacterTimerRef.current = null
    }
    cancelEditRef.current = false
    setEditingId(node.id)
    setDraft(node.title ?? '')
  }

  const finishTextEdit = (node: GenealogyNode): void => {
    if (editingId !== node.id) return
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      setEditingId(null)
      return
    }
    onEditText(node, draft.trim())
    setEditingId(null)
  }

  const cancelTextEdit = (): void => {
    cancelEditRef.current = true
    setEditingId(null)
  }

  const handleCharacterClick = (characterId: string | null | undefined): void => {
    if (!characterId) return
    if (openCharacterTimerRef.current != null) window.clearTimeout(openCharacterTimerRef.current)
    openCharacterTimerRef.current = window.setTimeout(() => {
      onOpenCharacter(characterId)
      openCharacterTimerRef.current = null
    }, 180)
  }

  React.useEffect(
    () => () => {
      if (openCharacterTimerRef.current != null) window.clearTimeout(openCharacterTimerRef.current)
    },
    []
  )

  const { nodes, links, width, height } = React.useMemo(() => {
    const placed: Placed[] = []
    const links: Link[] = []
    let maxDepth = 0
    const countDescendants = (id: string): number => {
      const kids = childrenOf(id)
      return kids.reduce((sum, kid) => sum + 1 + countDescendants(kid.id), 0)
    }
    const labelOf = (node: GenealogyNode): { text: string; hasDot: boolean } => {
      const ch = node.characterId ? characterById(node.characterId) : undefined
      return { text: ch?.name || node.title || '', hasDot: !!ch }
    }

    // 1) предпроход: размеры блоков, ширина колонок, длина подписей по уровням
    const sizeMap = new Map<string, { w: number; h: number }>()
    const colW: number[] = []
    const labelWByDepth: number[] = []
    const scan = (node: GenealogyNode, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth)
      const lbl = labelOf(node)
      const s = nodeSize(lbl.text, lbl.hasDot)
      sizeMap.set(node.id, s)
      colW[depth] = Math.max(colW[depth] ?? 0, s.w)
      if (node.edgeLabel) {
        labelWByDepth[depth] = Math.max(labelWByDepth[depth] ?? 0, measureTextWidth(node.edgeLabel, LABEL_FONT))
      }
      if (node.collapsed) return
      childrenOf(node.id).forEach((kid) => scan(kid, depth + 1))
    }
    childrenOf(null).forEach((n) => scan(n, 0))

    // 2) x-координаты колонок: ширина колонки + зазор под подпись уровня
    const colX: number[] = [0]
    for (let d = 1; d <= maxDepth; d++) {
      const labelW = Math.min(labelWByDepth[d] ?? 0, LABEL_MAX)
      const lead = labelW > 0 ? labelW + LABEL_PAD : LEAD_MIN
      colX[d] = colX[d - 1] + (colW[d - 1] ?? NODE_MIN_W) + STUB + lead
    }

    // 3) раскладка: вертикальный курсор по фактической высоте блоков.
    // Цвет наследуется от ближайшего предка (node.color || inheritedColor).
    let cursor = 0
    const layout = (node: GenealogyNode, depth: number, inheritedColor?: string): number => {
      const s = sizeMap.get(node.id) ?? nodeSize('', false)
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
          links.push({
            x1,
            y1: y,
            x2,
            y2: childYs[idx],
            midX,
            labelX: (midX + x2) / 2,
            labelY: childYs[idx],
            child: kid,
            color: kid.color || color
          })
        })
      }
      placed.push({
        node,
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
    childrenOf(null).forEach((n) => layout(n, 0))
    return {
      nodes: placed,
      links,
      width: colX[maxDepth] + (colW[maxDepth] ?? NODE_MIN_W) + 28,
      height: Math.max(cursor, NODE_MIN_H) + 12
    }
  }, [g, childrenOf, characterById])

  return (
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
        if (editEdgeId === l.child.id) {
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
                  cancelEdgeRef.current = true
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
            onClick={(e) => {
              e.stopPropagation()
              startEdge(l.child)
            }}
          >
            {l.child.edgeLabel}
          </button>
        ) : null
      })}
      {nodes.map(({ node, x, y, w, h, depth, hasChildren, hiddenCount, color }) => {
        const ch = node.characterId ? characterById(node.characterId) : undefined
        const label = ch?.name || node.title || ''
        const isEditing = editingId === node.id
        const nodeStyle: React.CSSProperties = { left: x, top: y - h / 2, width: w, minHeight: h }
        if (color) {
          nodeStyle.borderColor = color
          nodeStyle.boxShadow = `0 0 0 2px ${color} inset`
          nodeStyle.background = `linear-gradient(160deg, color-mix(in srgb, ${color} 38%, var(--surface-2, var(--panel-solid))), color-mix(in srgb, ${color} 22%, var(--surface-2, var(--panel-solid))))`
        }
        return (
          <div
            key={node.id}
            className={`dendro-node genealogy-node ${depth === 0 ? 'dendro-node--root' : ''} ${
              node.collapsed ? 'dendro-node--collapsed' : ''
            }`}
            style={nodeStyle}
            onDoubleClick={(e) => {
              e.stopPropagation()
              startTextEdit(node)
            }}
          >
            {isEditing ? (
              <input
                className="genealogy-node-input"
                value={draft}
                autoFocus
                placeholder="Персонаж или текст..."
                onChange={(event) => setDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={() => finishTextEdit(node)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') cancelTextEdit()
                }}
              />
            ) : (
            <div
              className={`genealogy-node-label ${ch ? 'is-character' : ''}`}
              onClick={() => handleCharacterClick(ch ? node.characterId : null)}
              title={ch ? 'Открыть персонажа' : undefined}
            >
              {ch && <span className="genealogy-dot" style={{ background: ch.color ?? '#7aa2f7' }} />}
              {label ? (
                <span className="genealogy-node-name">{label}</span>
              ) : (
                <span className="dendro-node-placeholder">Персонаж или текст…</span>
              )}
            </div>
            )}
            {hasChildren && (
              <button
                className="dendro-node-collapse"
                title={node.collapsed ? `Развернуть (скрыто: ${hiddenCount})` : 'Свернуть узел'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleCollapse(node)
                }}
              >
                {node.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                {node.collapsed && <span className="dendro-node-count">{hiddenCount}</span>}
              </button>
            )}
            <div className="dendro-node-actions">
              <button title="Добавить потомка" onClick={(e) => { e.stopPropagation(); onAddChild(node.id) }}>
                <Plus size={13} />
              </button>
              {depth > 0 && (
                <button title="Подписать связь с родителем" onClick={(e) => { e.stopPropagation(); startEdge(node) }}>
                  <Tag size={12} />
                </button>
              )}
              <button
                title="Цвет узла"
                onClick={(e) => {
                  e.stopPropagation()
                  openColorPicker({
                    value: color,
                    title: 'Цвет узла',
                    onChange: (c) => onSetColor(node, c),
                    onClear: () => onSetColor(node, ''),
                    clearLabel: 'Как у родителя'
                  })
                }}
              >
                <Palette size={12} />
              </button>
              <button title="Изменить" onClick={(e) => { e.stopPropagation(); onEditNode(node, e) }}>
                <Pencil size={12} />
              </button>
              <button title="Удалить" onClick={(e) => { e.stopPropagation(); onDelete(node) }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Менеджер родословных внутри раздела «Персонажи». */
export function Genealogy(): React.JSX.Element {
  const { current, applyProject, openTab, genealogyTargetId, genealogyNonce } = useStore()
  const project = current
  const [activeId, setActiveId] = React.useState<string | null>(null)

  // открытие конкретной родословной из дерева слева
  React.useEffect(() => {
    if (genealogyNonce > 0 && genealogyTargetId) setActiveId(genealogyTargetId)
  }, [genealogyNonce, genealogyTargetId])

  const list = React.useMemo(
    () => [...(project?.genealogies ?? [])].sort((a, b) => a.order - b.order),
    [project]
  )
  const active = list.find((x) => x.id === activeId) ?? list[0]

  if (!project) return <div className="dim">Проект не открыт</div>

  const apply = (p: Awaited<ReturnType<typeof window.api.genealogies.add>>): void => {
    if (p) applyProject(p)
  }

  const addGenealogy = async (): Promise<void> => {
    const title = await promptText({ title: 'Новая родословная', placeholder: 'Например: род Морейн' })
    if (!title) return
    const p = await window.api.genealogies.add({ projectId: project.id, title })
    apply(p)
    setActiveId(p?.genealogies[p.genealogies.length - 1]?.id ?? null)
  }
  const renameGenealogy = async (g: GenealogyT): Promise<void> => {
    const title = await promptText({ title: 'Переименовать родословную', initial: g.title })
    if (!title || title === g.title) return
    apply(await window.api.genealogies.rename({ projectId: project.id, genealogyId: g.id, title }))
  }
  const deleteGenealogy = async (g: GenealogyT): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить родословную «${g.title}»?`, danger: true }))) return
    apply(await window.api.genealogies.delete({ projectId: project.id, genealogyId: g.id }))
    setActiveId(null)
  }

  const childrenOf = (parentId: string | null): GenealogyNode[] =>
    (active?.nodes ?? [])
      .filter((n) => (n.parentId ?? null) === (parentId ?? null))
      .sort((a, b) => a.order - b.order)
  const characterById = (id: string): { name: string; color?: string } | undefined => {
    const c = project.characters.find((x) => x.id === id)
    return c ? { name: c.name || 'Без имени', color: c.color } : undefined
  }

  const addNode = async (parentId: string | null): Promise<void> => {
    if (!active) return
    apply(await window.api.genealogyNodes.add({ projectId: project.id, genealogyId: active.id, parentId }))
  }
  const updateNode = async (node: GenealogyNode, patch: Partial<GenealogyNode>): Promise<void> => {
    if (!active) return
    apply(
      await window.api.genealogyNodes.update({
        projectId: project.id,
        genealogyId: active.id,
        nodeId: node.id,
        patch
      })
    )
  }
  const deleteNode = async (node: GenealogyNode): Promise<void> => {
    if (!active) return
    if (!(await confirmDialog({ title: 'Удалить узел и его потомков?', danger: true }))) return
    apply(await window.api.genealogyNodes.delete({ projectId: project.id, genealogyId: active.id, nodeId: node.id }))
  }
  // меню узла: привязать персонажа (как вики-ссылка) / задать текст / убрать привязку
  const editNode = (node: GenealogyNode, e: React.MouseEvent): void => {
    const charItems = project.characters.map((c) => ({
      label: c.name || 'Без имени',
      onClick: () => void updateNode(node, { characterId: c.id, title: '' })
    }))
    openContextMenu(e, [
      { type: 'label', label: 'Привязать персонажа' } as never,
      ...(charItems.length ? charItems : [{ type: 'label', label: 'Нет персонажей' } as never]),
      { type: 'sep' } as never,
      {
        label: 'Свой текст…',
        onClick: async () => {
          const title = await promptText({ title: 'Текст узла', initial: node.title ?? '' })
          if (title != null) void updateNode(node, { title, characterId: null })
        }
      },
      ...(node.characterId
        ? [{ label: 'Убрать привязку', onClick: () => void updateNode(node, { characterId: null }) }]
        : [])
    ])
  }
  const editNodeText = (node: GenealogyNode, title: string): void => {
    void updateNode(node, { title, characterId: null })
  }
  const toggleCollapse = (node: GenealogyNode): void => {
    void updateNode(node, { collapsed: !node.collapsed })
  }
  const setEdgeLabel = (node: GenealogyNode, edgeLabel: string): void => {
    void updateNode(node, { edgeLabel })
  }
  const setColor = (node: GenealogyNode, color: string): void => {
    void updateNode(node, { color })
  }
  const openCharacter = (characterId: string): void => {
    const c = project.characters.find((x) => x.id === characterId)
    if (c) openTab({ id: `character:${c.id}`, kind: 'character', title: c.name || 'Без имени', characterId: c.id })
  }

  return (
    <div className="genealogy genealogy--canvas">
      <div className="genealogy-bar">
        <div className="genealogy-tabs">
          {list.map((g) => (
            <button
              key={g.id}
              className={`genealogy-tab ${active?.id === g.id ? 'is-active' : ''}`}
              onClick={() => setActiveId(g.id)}
              onContextMenu={(e) =>
                openContextMenu(e, [
                  { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameGenealogy(g) },
                  { label: 'Удалить', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteGenealogy(g) }
                ])
              }
            >
              {g.title}
            </button>
          ))}
        </div>
        <Button variant="soft" onClick={addGenealogy}>
          <Plus size={16} /> Родословная
        </Button>
      </div>

      {!active ? (
        <div className="genealogy-empty dim">
          Родословных пока нет. Создайте первую — это семейное древо с привязкой персонажей.
        </div>
      ) : (
        <>
          <div className="genealogy-toolbar">
            <Button variant="soft" onClick={() => addNode(null)}>
              <GitBranchPlus size={16} /> Добавить корень
            </Button>
            <span className="dim genealogy-hint">
              Двойной клик по узлу — привязать персонажа или вписать текст. Ctrl+колесо — масштаб.
            </span>
          </div>
          {active.nodes.length === 0 ? (
            <div className="genealogy-empty dim">Пустое древо. Нажмите «Добавить корень».</div>
          ) : (
            <ZoomPan className="genealogy-canvas" storageKey={`fancreator.zoompan.${project.id}.${active.id}`}>
              <GenealogyTree
                g={active}
                childrenOf={childrenOf}
                characterById={characterById}
                onAddChild={(parentId) => void addNode(parentId)}
                onEditNode={editNode}
                onEditText={editNodeText}
                onDelete={(node) => void deleteNode(node)}
                onToggleCollapse={toggleCollapse}
                onSetEdgeLabel={setEdgeLabel}
                onSetColor={setColor}
                onOpenCharacter={openCharacter}
              />
            </ZoomPan>
          )}
        </>
      )}
    </div>
  )
}
