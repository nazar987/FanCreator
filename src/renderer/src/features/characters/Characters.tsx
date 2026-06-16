import React from 'react'
import { ClipboardList, Plus, Trash2, UserRound } from 'lucide-react'
import type { Character, CharacterField, CharacterTemplate, Project } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Input } from '../../shared/ui/components'
import { confirmDialog, promptText } from '../../shared/ui/dialogs'
import { TagEditor } from '../../shared/ui/TagEditor'

interface CharacterCardProps {
  character: Character
  projectId: string
  templates: CharacterTemplate[]
  selected: boolean
  onToggleSelect: () => void
  onProjectChange: (project: Project | null) => void
}

function CharacterCard({
  character,
  projectId,
  templates,
  selected,
  onToggleSelect,
  onProjectChange
}: CharacterCardProps): React.JSX.Element {
  const [name, setName] = React.useState(character.name)
  const [role, setRole] = React.useState(character.role)
  const [fields, setFields] = React.useState(character.fields)
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(templates[0]?.id ?? '')

  React.useEffect(() => {
    setName(character.name)
    setRole(character.role)
    setFields(character.fields)
  }, [character])

  React.useEffect(() => {
    setSelectedTemplateId((current) =>
      templates.some((item) => item.id === current) ? current : templates[0]?.id ?? ''
    )
  }, [templates])

  const update = async (
    patch: Partial<Pick<Character, 'name' | 'role' | 'tags' | 'fields'>>
  ): Promise<void> => {
    onProjectChange(
      await window.api.characters.update({
        projectId,
        characterId: character.id,
        patch
      })
    )
  }

  const updateField = (fieldId: string, patch: Partial<CharacterField>): void => {
    setFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    )
  }

  const addField = async (): Promise<void> => {
    const label = await promptText({
      title: 'Название характеристики',
      placeholder: 'Например, биография'
    })
    if (!label) return
    const next = [...fields, { id: crypto.randomUUID(), label, value: '' }]
    setFields(next)
    await update({ fields: next })
  }

  const removeField = async (fieldId: string): Promise<void> => {
    const next = fields.filter((field) => field.id !== fieldId)
    setFields(next)
    await update({ fields: next })
  }

  const removeCharacter = async (): Promise<void> => {
    const confirmed = await confirmDialog({
      title: 'Удалить персонажа?',
      message: `Персонаж «${character.name}» и все его характеристики будут удалены.`,
      confirmLabel: 'Удалить',
      danger: true
    })
    if (!confirmed) return
    onProjectChange(await window.api.characters.delete({ projectId, characterId: character.id }))
  }

  const applyTemplate = async (): Promise<void> => {
    const template = templates.find((item) => item.id === selectedTemplateId)
    if (!template) return
    const existing = new Set(fields.map((field) => field.label.trim().toLowerCase()))
    const added = template.fieldLabels
      .filter((label) => label.trim() && !existing.has(label.trim().toLowerCase()))
      .map((label) => ({ id: crypto.randomUUID(), label, value: '' }))
    const next = [...fields, ...added]
    setFields(next)
    onProjectChange(
      await window.api.characters.update({
        projectId,
        characterId: character.id,
        patch: { fields: next, templateId: template.id }
      })
    )
  }

  return (
    <Card className={`character-card ${selected ? 'character-card--selected' : ''}`}>
      <div className="character-card-head">
        <div className="row" style={{ gap: 10 }}>
          <label className="character-select" title="Выбрать персонажа">
            <input type="checkbox" checked={selected} onChange={onToggleSelect} />
          </label>
          <div className="character-avatar">
            <UserRound size={24} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon
          title="Удалить персонажа"
          onClick={removeCharacter}
        >
          <Trash2 size={16} />
        </Button>
      </div>

      {templates.length > 0 && (
        <div className="character-template-apply">
          <select
            className="input"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
          >
            {templates.map((template) => (
              <option value={template.id} key={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Button variant="soft" size="sm" onClick={applyTemplate}>
            <ClipboardList size={15} /> Применить шаблон
          </Button>
        </div>
      )}

      <label className="character-control">
        <span>Имя</span>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const next = name.trim()
            if (next !== character.name) update({ name: next })
          }}
        />
      </label>

      <label className="character-control">
        <span>Роль</span>
        <Input
          value={role}
          placeholder="Например, главный герой"
          onChange={(event) => setRole(event.target.value)}
          onBlur={() => {
            if (role !== character.role) update({ role })
          }}
        />
      </label>

      <div className="character-control">
        <span>Теги</span>
        <TagEditor
          tags={character.tags}
          placeholder="Добавить тег"
          onChange={(tags) => update({ tags })}
        />
      </div>

      <div className="character-fields">
        {fields.map((field) => (
          <div className="character-field" key={field.id}>
            <div className="character-field-head">
              <Input
                value={field.label}
                aria-label="Название характеристики"
                onChange={(event) => updateField(field.id, { label: event.target.value })}
                onBlur={() => update({ fields })}
              />
              <Button
                variant="ghost"
                size="sm"
                icon
                title="Удалить характеристику"
                onClick={() => removeField(field.id)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
            <textarea
              className="input character-field-value"
              value={field.value}
              placeholder="Описание"
              onChange={(event) => updateField(field.id, { value: event.target.value })}
              onBlur={() => update({ fields })}
            />
          </div>
        ))}
      </div>

      <Button variant="soft" size="sm" onClick={addField}>
        <Plus size={15} /> Подробнее
      </Button>
    </Card>
  )
}

export function Characters(): React.JSX.Element {
  const { current, applyProject } = useStore()
  const [templatesOpen, setTemplatesOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [groupTemplateId, setGroupTemplateId] = React.useState('')

  // держим groupTemplateId валидным и сбрасываем выбор от удалённых персонажей
  React.useEffect(() => {
    const templates = current?.templates ?? []
    setGroupTemplateId((cur) =>
      templates.some((t) => t.id === cur) ? cur : templates[0]?.id ?? ''
    )
  }, [current?.templates])

  React.useEffect(() => {
    const ids = new Set((current?.characters ?? []).map((c) => c.id))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [current?.characters])

  if (!current) return <div />

  const addCharacter = async (): Promise<void> => {
    applyProject(await window.api.characters.add({ projectId: current.id, name: 'Новый персонаж' }))
  }

  const toggleSelect = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allSelected = current.characters.length > 0 && selected.size === current.characters.length
  const toggleAll = (): void =>
    setSelected(allSelected ? new Set() : new Set(current.characters.map((c) => c.id)))

  const applyToSelected = async (): Promise<void> => {
    if (!groupTemplateId || selected.size === 0) return
    applyProject(
      await window.api.characters.applyTemplate({
        projectId: current.id,
        templateId: groupTemplateId,
        characterIds: [...selected]
      })
    )
    setSelected(new Set())
  }

  return (
    <div className="characters">
      <div className="characters-inner">
        <div className="characters-head">
          <div>
            <div className="home-title" style={{ fontSize: 24 }}>
              Персонажи
            </div>
            <div className="home-sub">{current.characters.length} персонажей в проекте</div>
          </div>
          <div className="row">
            <Button variant="soft" onClick={() => setTemplatesOpen(true)}>
              <ClipboardList size={17} /> Шаблоны
            </Button>
            <Button variant="primary" onClick={addCharacter}>
              <Plus size={17} /> Добавить персонажа
            </Button>
          </div>
        </div>

        {current.characters.length > 0 && (
          <div className="characters-selectbar">
            <label className="character-select" title="Выбрать всех персонажей">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>Выбрать всех</span>
            </label>
            <div className="characters-select-state">
              <strong>{selected.size > 0 ? `Выбрано: ${selected.size}` : 'Ничего не выбрано'}</strong>
              <span className="dim">
                Выбор нужен, чтобы применить шаблон анкеты сразу к нескольким персонажам.
              </span>
              {current.templates.length === 0 && (
                <span className="dim">
                  Создайте шаблон во вкладке «Шаблоны», чтобы применять к группе.
                </span>
              )}
            </div>
            <div className="characters-select-actions">
              <select
                className="input"
                value={groupTemplateId}
                onChange={(e) => setGroupTemplateId(e.target.value)}
                disabled={current.templates.length === 0}
                title={current.templates.length === 0 ? 'Сначала создайте шаблон анкеты' : 'Шаблон для выбранных персонажей'}
              >
                {current.templates.length === 0 ? (
                  <option value="">Нет шаблонов</option>
                ) : (
                  current.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={applyToSelected}
                disabled={selected.size === 0 || current.templates.length === 0}
                title={
                  current.templates.length === 0
                    ? 'Сначала создайте шаблон анкеты'
                    : selected.size === 0
                      ? 'Выберите хотя бы одного персонажа'
                      : 'Применить шаблон к выбранным персонажам'
                }
              >
                <ClipboardList size={15} /> Применить к выбранным
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
              >
                Снять
              </Button>
            </div>
          </div>
        )}

        {current.characters.length === 0 ? (
          <div className="dim characters-empty">
            В этом проекте ещё нет персонажей. Добавьте первого, чтобы начать анкету.
          </div>
        ) : (
          <div className="characters-grid">
            {current.characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                projectId={current.id}
                templates={current.templates}
                selected={selected.has(character.id)}
                onToggleSelect={() => toggleSelect(character.id)}
                onProjectChange={applyProject}
              />
            ))}
          </div>
        )}
      </div>
      {templatesOpen && (
        <TemplateManager
          projectId={current.id}
          templates={current.templates}
          characters={current.characters}
          onProjectChange={applyProject}
          onClose={() => setTemplatesOpen(false)}
        />
      )}
    </div>
  )
}

interface TemplateManagerProps {
  projectId: string
  templates: CharacterTemplate[]
  characters: Character[]
  onProjectChange: (project: Project | null) => void
  onClose: () => void
}

function TemplateManager({
  projectId,
  templates,
  characters,
  onProjectChange,
  onClose
}: TemplateManagerProps): React.JSX.Element {
  const propagate = async (template: CharacterTemplate): Promise<void> => {
    onProjectChange(
      await window.api.characters.applyTemplate({
        projectId,
        templateId: template.id,
        characterIds: null
      })
    )
  }

  const addTemplate = async (): Promise<void> => {
    const name = await promptText({ title: 'Новый шаблон', placeholder: 'Название шаблона' })
    if (!name) return
    onProjectChange(await window.api.templates.add({ projectId, name }))
  }

  const renameTemplate = async (template: CharacterTemplate): Promise<void> => {
    const name = await promptText({ title: 'Переименовать шаблон', initial: template.name })
    if (!name || name === template.name) return
    onProjectChange(
      await window.api.templates.update({
        projectId,
        templateId: template.id,
        patch: { name }
      })
    )
  }

  const deleteTemplate = async (template: CharacterTemplate): Promise<void> => {
    const ok = await confirmDialog({
      title: `Удалить шаблон «${template.name}»?`,
      danger: true,
      confirmLabel: 'Удалить'
    })
    if (!ok) return
    onProjectChange(await window.api.templates.delete({ projectId, templateId: template.id }))
  }

  const updateLabels = async (
    template: CharacterTemplate,
    fieldLabels: string[]
  ): Promise<void> => {
    onProjectChange(
      await window.api.templates.update({
        projectId,
        templateId: template.id,
        patch: { fieldLabels }
      })
    )
  }

  const addFieldLabel = async (template: CharacterTemplate): Promise<void> => {
    const label = await promptText({ title: 'Поле шаблона', placeholder: 'Например, Биография' })
    if (!label) return
    await updateLabels(template, [...template.fieldLabels, label])
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal character-templates-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="character-templates-head">
          <h3>Шаблоны анкет</h3>
          <Button variant="primary" size="sm" onClick={addTemplate}>
            <Plus size={15} /> Создать
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="dim character-templates-empty">
            Шаблонов пока нет. Создайте первый и добавьте поля анкеты.
          </div>
        ) : (
          <div className="character-templates-list">
            {templates.map((template) => (
              <Card className="character-template-card" key={template.id}>
                <div className="character-template-title">
                  <button onClick={() => renameTemplate(template)}>{template.name}</button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    title="Удалить шаблон"
                    onClick={() => deleteTemplate(template)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>

                <div className="character-template-fields">
                  {template.fieldLabels.map((label, index) => (
                    <div className="character-template-field" key={`${label}:${index}`}>
                      <TemplateFieldInput
                        value={label}
                        onSave={(value) => {
                          const next = [...template.fieldLabels]
                          next[index] = value
                          updateLabels(template, next)
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        title="Удалить поле"
                        onClick={() =>
                          updateLabels(
                            template,
                            template.fieldLabels.filter((_, i) => i !== index)
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="character-template-actions">
                  <Button variant="soft" size="sm" onClick={() => addFieldLabel(template)}>
                    <Plus size={15} /> Добавить поле
                  </Button>
                  {(() => {
                    const bound = characters.filter((c) => c.templateId === template.id).length
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={bound === 0}
                        title="Добавить недостающие поля шаблона всем привязанным персонажам"
                        onClick={() => propagate(template)}
                      >
                        <ClipboardList size={15} /> Обновить привязанных ({bound})
                      </Button>
                    )
                  })()}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  )
}

function TemplateFieldInput({
  value,
  onSave
}: {
  value: string
  onSave: (value: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = React.useState(value)

  React.useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Input
      value={draft}
      aria-label="Название поля шаблона"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (next && next !== value) onSave(next)
        else setDraft(value)
      }}
    />
  )
}
