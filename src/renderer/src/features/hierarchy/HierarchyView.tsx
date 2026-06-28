import React from 'react'
import { GitBranchPlus } from 'lucide-react'
import type { TimelineEvent } from '@shared/types'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'
import { promptText, confirmDialog } from '../../shared/ui/dialogs'
import { ZoomPan } from '../../shared/ui/ZoomPan'
import { Dendrogram } from '../timeline/Dendrogram'

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
  const asEvent = (n: { id: string; parentId: string | null; title: string }): TimelineEvent => ({
    id: n.id,
    parentId: n.parentId ?? null,
    title: n.title,
    note: '',
    order: 0
  })
  const childrenOf = (parentId: string | null): TimelineEvent[] =>
    h.nodes.filter((n) => (n.parentId ?? null) === (parentId ?? null)).map(asEvent)
  const top = childrenOf(null)

  const addNode = async (parentId: string | null): Promise<void> => {
    applyProject(
      await window.api.hierarchyNodes.add({ projectId, hierarchyId, parentId: parentId ?? null, title: 'Узел' })
    )
  }
  const editNode = async (ev: TimelineEvent): Promise<void> => {
    const title = await promptText({ title: 'Узел дерева', initial: ev.title })
    if (title && title !== ev.title)
      applyProject(await window.api.hierarchyNodes.update({ projectId, hierarchyId, nodeId: ev.id, title }))
  }
  const deleteNode = async (ev: TimelineEvent): Promise<void> => {
    if (!(await confirmDialog({ title: 'Удалить узел и его потомков?', danger: true }))) return
    applyProject(await window.api.hierarchyNodes.delete({ projectId, hierarchyId, nodeId: ev.id }))
  }

  return (
    <div className="timeline" data-tour="hierarchy">
      <div className="timeline-inner">
        <div className="timeline-head">
          <div>
            <div className="home-title">{h.title}</div>
            <div className="home-sub">Дерево · Ctrl+колесо — масштаб, перетаскивание — сдвиг</div>
          </div>
          <Button variant="soft" onClick={() => addNode(null)}>
            <GitBranchPlus size={16} /> Добавить корень
          </Button>
        </div>
        {h.nodes.length === 0 ? (
          <div className="timeline-empty dim">Дерево пустое. Нажмите «Добавить корень».</div>
        ) : (
          <ZoomPan>
            <Dendrogram
              events={top}
              childrenOf={childrenOf}
              onEdit={(ev) => void editNode(ev)}
              onAddChild={(ev) => void addNode(ev.id)}
              onDelete={(ev) => void deleteNode(ev)}
            />
          </ZoomPan>
        )}
      </div>
    </div>
  )
}
