import React from 'react'
import { GitFork, GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult
} from '@hello-pangea/dnd'
import type { HierarchyNode } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Input } from '../../shared/ui/components'
import { promptText } from '../../shared/ui/dialogs'

export function Hierarchy({ hierarchyId }: { hierarchyId: string }): React.JSX.Element {
  const { current, applyProject } = useStore()
  const hierarchy = current?.hierarchies.find((item) => item.id === hierarchyId)

  if (!current || !hierarchy) {
    return <div className="hierarchy-missing dim">Иерархия не найдена</div>
  }

  const childNodes = (parentId: string | null): HierarchyNode[] =>
    hierarchy.nodes.filter((node) => node.parentId === parentId)
  const nodeDropId = (parentId: string | null): string => `hierarchy-nodes:${parentId ?? 'root'}`
  const parseNodeDropId = (droppableId: string): string | null | undefined => {
    if (!droppableId.startsWith('hierarchy-nodes:')) return undefined
    const parentId = droppableId.slice('hierarchy-nodes:'.length)
    return parentId === 'root' ? null : parentId
  }

  const updateOrientation = async (orientation: 'vertical' | 'horizontal'): Promise<void> => {
    applyProject(
      await window.api.hierarchies.update({
        projectId: current.id,
        hierarchyId,
        patch: { orientation }
      })
    )
  }

  const addNode = async (parentId: string | null): Promise<void> => {
    const title = await promptText({
      title: parentId ? 'Новый подузел' : 'Новый узел',
      placeholder: 'Название'
    })
    if (!title) return
    applyProject(
      await window.api.hierarchyNodes.add({
        projectId: current.id,
        hierarchyId,
        parentId,
        title
      })
    )
  }

  const updateNode = async (node: HierarchyNode, title: string): Promise<void> => {
    const next = title.trim()
    if (!next || next === node.title) return
    applyProject(
      await window.api.hierarchyNodes.update({
        projectId: current.id,
        hierarchyId,
        nodeId: node.id,
        title: next
      })
    )
  }

  const deleteNode = async (node: HierarchyNode): Promise<void> => {
    applyProject(
      await window.api.hierarchyNodes.delete({
        projectId: current.id,
        hierarchyId,
        nodeId: node.id
      })
    )
  }

  const reorderNodes = async (result: DropResult): Promise<void> => {
    const { source, destination } = result
    if (!destination || source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return
    const parentId = parseNodeDropId(source.droppableId)
    if (parentId === undefined) return
    const order = childNodes(parentId).map((node) => node.id)
    const [moved] = order.splice(source.index, 1)
    order.splice(destination.index, 0, moved)
    applyProject(
      await window.api.hierarchyNodes.reorder({
        projectId: current.id,
        hierarchyId,
        parentId,
        order
      })
    )
  }

  const renderNode = (
    node: HierarchyNode,
    level: number,
    dragHandleProps?: DraggableProvidedDragHandleProps | null
  ): React.JSX.Element => {
    const children = childNodes(node.id)
    return (
      <div className="hierarchy-node-wrap" key={node.id}>
        <Card className="hierarchy-node" style={{ marginLeft: hierarchy.orientation === 'vertical' ? level * 28 : 0 }}>
          <span className="hierarchy-node-drag" title="Изменить порядок узла" {...dragHandleProps}>
            <GripVertical size={15} />
          </span>
          <Input
            defaultValue={node.title}
            aria-label="Название узла"
            onBlur={(event) => updateNode(node, event.currentTarget.value)}
          />
          <Button variant="soft" size="sm" onClick={() => addNode(node.id)}>
            <Plus size={14} /> Подузел
          </Button>
          <Button variant="ghost" size="sm" icon title="Удалить узел" onClick={() => deleteNode(node)}>
            <Trash2 size={14} />
          </Button>
        </Card>
        {children.length > 0 && (
          <div className={`hierarchy-children hierarchy-children--${hierarchy.orientation}`}>
            {renderNodeGroup(node.id, level + 1)}
          </div>
        )}
      </div>
    )
  }

  const renderNodeGroup = (parentId: string | null, level: number): React.JSX.Element => (
    <Droppable droppableId={nodeDropId(parentId)} type="hierarchy-node">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className="hierarchy-node-group">
          {childNodes(parentId).map((node, index) => (
            <Draggable draggableId={node.id} index={index} key={node.id}>
              {(dragProvided) => (
                <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                  {renderNode(node, level, dragProvided.dragHandleProps)}
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )

  return (
    <div className="hierarchy">
      <div className="hierarchy-inner">
        <div className="hierarchy-head">
          <div>
            <div className="home-title" style={{ fontSize: 24 }}>
              <GitFork size={22} /> {hierarchy.title}
            </div>
            <div className="home-sub">{hierarchy.nodes.length} узлов</div>
          </div>
          <div className="row">
            <div className="timeline-view-switch">
              <button
                className={hierarchy.orientation === 'vertical' ? 'is-active' : ''}
                onClick={() => updateOrientation('vertical')}
              >
                Вертикально
              </button>
              <button
                className={hierarchy.orientation === 'horizontal' ? 'is-active' : ''}
                onClick={() => updateOrientation('horizontal')}
              >
                Горизонтально
              </button>
            </div>
            <Button variant="primary" onClick={() => addNode(null)}>
              <Plus size={16} /> Узел
            </Button>
          </div>
        </div>

        {/* SENIOR: авто-раскладка + соединители */}
        {hierarchy.nodes.length === 0 ? (
          <div className="hierarchy-empty dim">Добавьте первый узел иерархии.</div>
        ) : (
          <DragDropContext onDragEnd={reorderNodes}>
            <div className={`hierarchy-tree hierarchy-tree--${hierarchy.orientation}`}>
              {renderNodeGroup(null, 0)}
            </div>
          </DragDropContext>
        )}
      </div>
    </div>
  )
}
