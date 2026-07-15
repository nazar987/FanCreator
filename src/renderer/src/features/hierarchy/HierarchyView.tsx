import React from 'react'
import { GitBranchPlus } from 'lucide-react'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'
import { confirmDialog } from '../../shared/ui/dialogs'
import { ZoomPan } from '../../shared/ui/ZoomPan'
import type { HierarchyNode } from '@shared/types'
import { Dendrogram, type DendroNode } from '../timeline/Dendrogram'

/**
 * Дерево — самостоятельный раздел (вынесен из таймлайна). Использует данные
 * Hierarchy (узлы id/parentId/title) и переиспользует раскладку Dendrogram в
 * ZoomPan. Открывается отдельной вкладкой, как доска/таймлайн.
 */
export function HierarchyView({ hierarchyId }: { hierarchyId: string }): React.JSX.Element {
  const { current, applyProject } = useStore()
  const h = current?.hierarchies?.find((x) => x.id === hierarchyId)
  if (!current || !h) return <div className="timeline-missing dim">Дерево не найдено</div>
  const projectId = current.id

  // адаптируем узлы дерева под форму, которую рисует Dendrogram
  const asEvent = (n: HierarchyNode): DendroNode => ({
    id: n.id,
    parentId: n.parentId ?? null,
    title: n.title,
    note: '',
    collapsed: n.collapsed,
    edgeLabel: n.edgeLabel,
    color: n.color
  })
  const childrenOf = (parentId: string | null): DendroNode[] =>
    h.nodes.filter((n) => (n.parentId ?? null) === (parentId ?? null)).map(asEvent)
  const top = childrenOf(null)

  const addNode = async (parentId: string | null): Promise<void> => {
    // пустой узел (без текста «Узел») — пользователь сразу пишет своё
    applyProject(
      await window.api.hierarchyNodes.add({ projectId, hierarchyId, parentId: parentId ?? null, title: '' })
    )
  }
  const setTitle = async (ev: DendroNode, title: string): Promise<void> => {
    if (title === ev.title) return
    applyProject(await window.api.hierarchyNodes.update({ projectId, hierarchyId, nodeId: ev.id, patch: { title } }))
  }
  const deleteNode = async (ev: DendroNode): Promise<void> => {
    if (!(await confirmDialog({ title: 'Удалить узел и его потомков?', danger: true }))) return
    applyProject(await window.api.hierarchyNodes.delete({ projectId, hierarchyId, nodeId: ev.id }))
  }
  const toggleCollapse = async (ev: DendroNode): Promise<void> => {
    applyProject(
      await window.api.hierarchyNodes.update({
        projectId,
        hierarchyId,
        nodeId: ev.id,
        patch: { collapsed: !ev.collapsed }
      })
    )
  }
  const setEdgeLabel = async (ev: DendroNode, edgeLabel: string): Promise<void> => {
    applyProject(
      await window.api.hierarchyNodes.update({ projectId, hierarchyId, nodeId: ev.id, patch: { edgeLabel } })
    )
  }
  const setColor = async (ev: DendroNode, color: string): Promise<void> => {
    applyProject(await window.api.hierarchyNodes.update({ projectId, hierarchyId, nodeId: ev.id, patch: { color } }))
  }

  return (
    <div className="timeline timeline--canvas" data-tour="hierarchy">
      <div className="timeline-inner">
        <div className="timeline-head">
          <div>
            <div className="home-title">{h.title}</div>
            <div className="home-sub">Дерево · Ctrl+колесо — масштаб, зажатая ЛКМ — сдвиг</div>
          </div>
          <Button variant="soft" onClick={() => addNode(null)}>
            <GitBranchPlus size={16} /> Добавить корень
          </Button>
        </div>
        {h.nodes.length === 0 ? (
          <div className="timeline-empty dim">Дерево пустое. Нажмите «Добавить корень».</div>
        ) : (
          <ZoomPan storageKey={`fancreator.zoompan.${projectId}.${hierarchyId}`}>
            <Dendrogram
              events={top}
              childrenOf={childrenOf}
              onSetTitle={(ev, title) => void setTitle(ev, title)}
              onAddChild={(ev) => void addNode(ev.id)}
              onDelete={(ev) => void deleteNode(ev)}
              onToggleCollapse={(ev) => void toggleCollapse(ev)}
              onSetEdgeLabel={(ev, value) => void setEdgeLabel(ev, value)}
              onSetColor={(ev, color) => void setColor(ev, color)}
            />
          </ZoomPan>
        )}
      </div>
    </div>
  )
}
