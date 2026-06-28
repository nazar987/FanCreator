import React from 'react'
import { Plus, Trash2, GitBranchPlus, Pencil } from 'lucide-react'
import type { Genealogy as GenealogyT, GenealogyNode } from '@shared/types'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'
import { promptText, confirmDialog } from '../../shared/ui/dialogs'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { ZoomPan } from '../../shared/ui/ZoomPan'

const NODE_W = 200
const NODE_H = 62
const COL_W = 290
const ROW_H = 90

interface Placed {
  node: GenealogyNode
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

/** Дерево родословной (сверху-вниз по поколениям, слева-направо как дендрограмма). */
function GenealogyTree({
  g,
  childrenOf,
  characterById,
  onAddChild,
  onEditNode,
  onDelete,
  onOpenCharacter
}: {
  g: GenealogyT
  childrenOf: (parentId: string | null) => GenealogyNode[]
  characterById: (id: string) => { name: string; color?: string } | undefined
  onAddChild: (parentId: string | null) => void
  onEditNode: (node: GenealogyNode, e: React.MouseEvent) => void
  onDelete: (node: GenealogyNode) => void
  onOpenCharacter: (characterId: string) => void
}): React.JSX.Element {
  const { nodes, links, width, height } = React.useMemo(() => {
    const placed: Placed[] = []
    const links: Link[] = []
    let leaf = 0
    let maxDepth = 0
    const layout = (node: GenealogyNode, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth)
      const kids = childrenOf(node.id)
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
      placed.push({ node, x, y, depth })
      return y
    }
    childrenOf(null).forEach((n) => layout(n, 0))
    return {
      nodes: placed,
      links,
      width: (maxDepth + 1) * COL_W + 28,
      height: Math.max(leaf, 1) * ROW_H + 20
    }
  }, [g, childrenOf])

  return (
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
      {nodes.map(({ node, x, y, depth }) => {
        const ch = node.characterId ? characterById(node.characterId) : undefined
        const label = ch?.name || node.title || ''
        return (
          <div
            key={node.id}
            className={`dendro-node genealogy-node ${depth === 0 ? 'dendro-node--root' : ''}`}
            style={{ left: x, top: y - NODE_H / 2, width: NODE_W, minHeight: NODE_H }}
            onDoubleClick={(e) => onEditNode(node, e)}
          >
            <div
              className={`genealogy-node-label ${ch ? 'is-character' : ''}`}
              onClick={() => ch && node.characterId && onOpenCharacter(node.characterId)}
              title={ch ? 'Открыть персонажа' : undefined}
            >
              {ch && <span className="genealogy-dot" style={{ background: ch.color ?? '#7aa2f7' }} />}
              {label ? (
                <span className="truncate">{label}</span>
              ) : (
                <span className="dendro-node-placeholder">Персонаж или текст…</span>
              )}
            </div>
            <div className="dendro-node-actions">
              <button title="Добавить потомка" onClick={(e) => { e.stopPropagation(); onAddChild(node.id) }}>
                <Plus size={13} />
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
            <ZoomPan className="genealogy-canvas">
              <GenealogyTree
                g={active}
                childrenOf={childrenOf}
                characterById={characterById}
                onAddChild={(parentId) => void addNode(parentId)}
                onEditNode={editNode}
                onDelete={(node) => void deleteNode(node)}
                onOpenCharacter={openCharacter}
              />
            </ZoomPan>
          )}
        </>
      )}
    </div>
  )
}
