import React from 'react'
import { ChevronRight, ClipboardList, Folder as FolderIcon, FolderPlus, Plus, Trash2, UserRound } from 'lucide-react'
import type { Character, CharacterField, CharacterFolder, CharacterTemplate, Project } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Input } from '../../shared/ui/components'
import { confirmDialog, promptText } from '../../shared/ui/dialogs'
import { TagEditor } from '../../shared/ui/TagEditor'
import { ColorPalette } from '../../shared/ui/ColorPalette'
import { AutoTextarea } from '../../shared/ui/AutoTextarea'
import { ImageStrip } from '../../shared/ui/ImageStrip'
import { plural } from '../../shared/plural'

/** Плоский список папок с отступами по глубине — для выпадающего «переместить». */
function flattenFolders(folders: CharacterFolder[]): { folder: CharacterFolder; depth: number }[] {
  const out: { folder: CharacterFolder; depth: number }[] = []
  const walk = (parentId: string | null, depth: number): void => {
    folders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((folder) => {
        out.push({ folder, depth })
        walk(folder.id, depth + 1)
      })
  }
  walk(null, 0)
  return out
}

interface CharacterCardProps {
  character: Character
  projectId: string
  templates: CharacterTemplate[]
  folderOptions: { folder: CharacterFolder; depth: number }[]
  selected: boolean
  onToggleSelect: () => void
  onProjectChange: (project: Project | null) => void
}

function CharacterCard({
  character,
  projectId,
  templates,
  folderOptions,
  selected,
  onToggleSelect,
  onProjectChange
}: CharacterCardProps): React.JSX.Element {
  const [name, setName] = React.useState(character.name)
  const [role, setRole] = React.useState(character.role)
  const [fields, setFields] = React.useState(character.fields)
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(templates[0]?.id ?? '')
  const [collapsedFields, setCollapsedFields] = React.useState<Set<string>>(new Set())

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
    patch: Partial<Pick<Character, 'name' | 'role' | 'tags' | 'fields' | 'images'>>
  ): Promise<void> => {
    onProjectChange(await window.api.characters.update({ projectId, characterId: character.id, patch }))
  }

  const setFolder = async (folderId: string | null): Promise<void> => {
    onProjectChange(await window.api.characters.setFolder({ projectId, characterId: character.id, folderId }))
  }

  const updateField = (fieldId: string, patch: Partial<CharacterField>): void => {
    setFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    )
  }

  const addField = async (): Promise<void> => {
    const label = await promptText({ title: 'Название характеристики', placeholder: 'Например, биография' })
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

  const toggleField = (fieldId: string): void => {
    setCollapsedFields((current) => {
      const next = new Set(current)
      next.has(fieldId) ? next.delete(fieldId) : next.add(fieldId)
      return next
    })
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
    const replace = fields.length > 0 && await confirmDialog({
      title: `Заменить анкету шаблоном «${template.name}»?`,
      message: 'При замене останутся только поля шаблона. Значения полей с совпадающими названиями сохранятся. Отмена добавит только недостающие поля.',
      confirmLabel: 'Заменить'
    })
    const byLabel = new Map(fields.map((field) => [field.label.trim().toLowerCase(), field]))
    const templateLabels = template.fieldLabels.filter((label) => label.trim())
    const next = replace
      ? templateLabels.map((label) => {
          const existing = byLabel.get(label.trim().toLowerCase())
          return existing ? { ...existing, label } : { id: crypto.randomUUID(), label, value: '' }
        })
      : [
          ...fields,
          ...templateLabels
            .filter((label) => !byLabel.has(label.trim().toLowerCase()))
            .map((label) => ({ id: crypto.randomUUID(), label, value: '' }))
        ]
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
        <Button variant="ghost" size="sm" icon title="Удалить персонажа" onClick={removeCharacter}>
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
          placeholder="Имя персонажа"
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

      <label className="character-control">
        <span>Папка</span>
        <select
          className="input"
          value={character.folderId ?? ''}
          onChange={(event) => setFolder(event.target.value || null)}
        >
          <option value="">Без папки</option>
          {folderOptions.map(({ folder, depth }) => (
            <option key={folder.id} value={folder.id}>
              {'— '.repeat(depth)}
              {folder.title}
            </option>
          ))}
        </select>
      </label>

      <div className="character-control">
        <span>Теги</span>
        <TagEditor tags={character.tags} placeholder="Добавить тег" onChange={(tags) => update({ tags })} />
      </div>

      <div className="character-control">
        <span>Наброски / концепт-арт</span>
        <ImageStrip
          projectId={projectId}
          images={character.images ?? []}
          onChange={(images) => update({ images })}
          emptyHint="Перетащите картинку или нажмите «Добавить»."
        />
      </div>

      <div className="character-fields">
        {fields.map((field) => (
          <div className="character-field" key={field.id}>
            <div className="character-field-head">
              <Button
                variant="ghost"
                size="sm"
                icon
                title={collapsedFields.has(field.id) ? 'Развернуть описание' : 'Свернуть описание'}
                aria-expanded={!collapsedFields.has(field.id)}
                onClick={() => toggleField(field.id)}
              >
                <ChevronRight size={15} className={collapsedFields.has(field.id) ? '' : 'character-field-chevron--open'} />
              </Button>
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
            {!collapsedFields.has(field.id) && (
              <AutoTextarea
                className="input character-field-value"
                value={field.value}
                placeholder="Описание"
                onChange={(event) => updateField(field.id, { value: event.target.value })}
                onBlur={() => update({ fields })}
              />
            )}
          </div>
        ))}
      </div>

      <Button variant="soft" size="sm" onClick={addField}>
        <Plus size={15} /> Подробнее
      </Button>
    </Card>
  )
}

interface FolderPanelProps {
  folder: CharacterFolder
  projectId: string
  onProjectChange: (project: Project | null) => void
  onDelete: () => void
}

/** Карточка папки: описание и изображения для дополнительного контекста. */
function FolderPanel({ folder, projectId, onProjectChange, onDelete }: FolderPanelProps): React.JSX.Element {
  const [description, setDescription] = React.useState(folder.description ?? '')

  React.useEffect(() => {
    setDescription(folder.description ?? '')
  }, [folder.id, folder.description])

  const patch = async (
    next: Partial<Pick<CharacterFolder, 'title' | 'description' | 'color' | 'images'>>
  ): Promise<void> => {
    onProjectChange(await window.api.characterFolders.update({ projectId, folderId: folder.id, patch: next }))
  }

  const rename = async (): Promise<void> => {
    const title = await promptText({ title: 'Переименовать папку', initial: folder.title })
    if (!title || title === folder.title) return
    await patch({ title })
  }

  return (
    <Card className="folder-panel">
      <div className="folder-panel-head">
        <span className="folder-panel-icon" style={{ color: folder.color ?? '#7aa2f7' }}>
          <FolderIcon size={22} fill="currentColor" />
        </span>
        <button className="folder-panel-title" onClick={rename} title="Переименовать">
          {folder.title}
        </button>
        <ColorPalette
          value={folder.color ?? '#7aa2f7'}
          title="Цвет папки"
          onChange={(color) => patch({ color })}
        />
        <Button variant="ghost" size="sm" icon title="Удалить папку" onClick={onDelete}>
          <Trash2 size={16} />
        </Button>
      </div>

      <label className="character-control">
        <span>Описание</span>
        <AutoTextarea
          className="input"
          value={description}
          placeholder="Опишите назначение, атмосферу или особенности…"
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            if (description !== (folder.description ?? '')) patch({ description })
          }}
        />
      </label>

      <div className="character-control">
        <span>Изображения</span>
        <ImageStrip
          projectId={projectId}
          images={folder.images ?? []}
          onChange={(images) => patch({ images })}
          emptyHint="Референсы, карты, схемы или другие изображения."
        />
      </div>
    </Card>
  )
}

export function Characters(): React.JSX.Element {
  const { current, applyProject, openTab } = useStore()
  const [templatesOpen, setTemplatesOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [groupTemplateId, setGroupTemplateId] = React.useState('')
  const [folderId, setFolderId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const templates = current?.templates ?? []
    setGroupTemplateId((cur) => (templates.some((t) => t.id === cur) ? cur : templates[0]?.id ?? ''))
  }, [current?.templates])

  React.useEffect(() => {
    const ids = new Set((current?.characters ?? []).map((c) => c.id))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [current?.characters])

  // если текущая папка удалена — возвращаемся в корень
  React.useEffect(() => {
    const folders = current?.characterFolders ?? []
    if (folderId && !folders.some((f) => f.id === folderId)) setFolderId(null)
  }, [current?.characterFolders, folderId])

  if (!current) return <div />

  const folders = current.characterFolders ?? []
  const selectedFolder = folders.find((f) => f.id === folderId) ?? null
  const childFolders = folders
    .filter((f) => (f.parentId ?? null) === folderId)
    .sort((a, b) => a.order - b.order)
  const folderCharacters = current.characters.filter((c) => (c.folderId ?? null) === folderId)
  const flatFolders = flattenFolders(folders)

  const folderPath = (): CharacterFolder[] => {
    const path: CharacterFolder[] = []
    const visited = new Set<string>()
    let cursor = selectedFolder
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id)
      path.unshift(cursor)
      cursor = folders.find((f) => f.id === cursor?.parentId) ?? null
    }
    return path
  }

  const descendantIds = (rootId: string): Set<string> => {
    const ids = new Set<string>([rootId])
    let changed = true
    while (changed) {
      changed = false
      for (const folder of folders) {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id)
          changed = true
        }
      }
    }
    return ids
  }

  const charCountInFolder = (id: string): number => {
    const ids = descendantIds(id)
    return current.characters.filter((c) => c.folderId && ids.has(c.folderId)).length
  }

  const openCharacter = (c: Character): void =>
    openTab({ id: `character:${c.id}`, kind: 'character', title: c.name || 'Без имени', characterId: c.id })

  const addCharacter = async (): Promise<void> => {
    const p = await window.api.characters.add({ projectId: current.id, folderId })
    applyProject(p)
    const created = p?.characters.at(-1)
    if (created) openCharacter(created)
  }

  const addFolder = async (): Promise<void> => {
    const title = await promptText({
      title: selectedFolder ? 'Новая подпапка' : 'Новая папка',
      placeholder: 'Например, Мордор'
    })
    if (!title) return
    applyProject(
      await window.api.characterFolders.add({ projectId: current.id, title, parentId: folderId })
    )
  }

  const deleteFolder = async (folder: CharacterFolder): Promise<void> => {
    if (
      !(await confirmDialog({
        title: `Удалить папку «${folder.title}»?`,
        message: 'Папка удалится вместе с подпапками и персонажами внутри безвозвратно.',
        danger: true,
        confirmLabel: 'Удалить'
      }))
    )
      return
    const parent = folder.parentId ?? null
    applyProject(await window.api.characterFolders.delete({ projectId: current.id, folderId: folder.id }))
    setFolderId(parent)
  }

  const toggleSelect = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const visibleIds = folderCharacters.map((c) => c.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleAll = (): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })

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
    <div className="characters" data-tour="characters">
      <div className="characters-inner">
        <div className="characters-head">
          <div>
            <div className="home-title">
              Персонажи
            </div>
            <div className="home-sub">
              {plural(current.characters.length, 'персонаж', 'персонажа', 'персонажей')} ·{' '}
              {plural(folders.length, 'папка', 'папки', 'папок')}
            </div>
          </div>
          <div className="row">
            <Button variant="soft" onClick={() => setTemplatesOpen(true)}>
              <ClipboardList size={17} /> Шаблоны
            </Button>
            <Button variant="soft" onClick={addFolder}>
              <FolderPlus size={17} /> {selectedFolder ? 'Подпапка' : 'Папка'}
            </Button>
            <Button variant="primary" onClick={addCharacter}>
              <Plus size={17} /> Добавить персонажа
            </Button>
          </div>
        </div>

        <div className="library-breadcrumbs characters-breadcrumbs" aria-label="Путь к папке">
          <button className={!selectedFolder ? 'is-current' : ''} onClick={() => setFolderId(null)}>
            Все персонажи
          </button>
          {folderPath().map((folder, index, path) => (
            <React.Fragment key={folder.id}>
              <ChevronRight size={14} />
              <button
                className={index === path.length - 1 ? 'is-current' : ''}
                onClick={() => setFolderId(folder.id)}
              >
                {folder.title}
              </button>
            </React.Fragment>
          ))}
        </div>

        {selectedFolder && (
          <FolderPanel
            key={selectedFolder.id}
            folder={selectedFolder}
            projectId={current.id}
            onProjectChange={applyProject}
            onDelete={() => deleteFolder(selectedFolder)}
          />
        )}

        {childFolders.length > 0 && (
          <section className="characters-section">
            <h2>{selectedFolder ? 'Подпапки' : 'Папки'}</h2>
            <div className="library-folder-grid">
              {childFolders.map((folder) => (
                <div
                  className="library-folder-card"
                  role="button"
                  tabIndex={0}
                  key={folder.id}
                  onClick={() => setFolderId(folder.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setFolderId(folder.id)
                  }}
                >
                  <span className="library-folder-icon" style={{ color: folder.color ?? '#7aa2f7' }}>
                    <FolderIcon size={30} fill="currentColor" />
                  </span>
                  <span className="library-folder-copy">
                    <strong>{folder.title}</strong>
                    <small>{plural(charCountInFolder(folder.id), 'персонаж', 'персонажа', 'персонажей')}</small>
                  </span>
                  <ChevronRight size={17} className="library-folder-arrow" />
                </div>
              ))}
            </div>
          </section>
        )}

        {folderCharacters.length > 0 && (
          <div className="characters-selectbar">
            <label className="character-select" title="Выбрать персонажей этой папки">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>Выбрать всех</span>
            </label>
            <div className="characters-select-state">
              <strong>{selected.size > 0 ? `Выбрано: ${selected.size}` : 'Ничего не выбрано'}</strong>
              <span className="dim">Выбор нужен, чтобы применить шаблон анкеты сразу к нескольким.</span>
              {current.templates.length === 0 && (
                <span className="dim">Создайте шаблон во вкладке «Шаблоны», чтобы применять к группе.</span>
              )}
            </div>
            <div className="characters-select-actions">
              <select
                className="input"
                value={groupTemplateId}
                onChange={(e) => setGroupTemplateId(e.target.value)}
                disabled={current.templates.length === 0}
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
              >
                <ClipboardList size={15} /> Применить к выбранным
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                Снять
              </Button>
            </div>
          </div>
        )}

        {folderCharacters.length === 0 ? (
          <div className="dim characters-empty">
            {selectedFolder
              ? 'В этой папке пока нет персонажей. Добавьте первого кнопкой «Добавить персонажа».'
              : childFolders.length > 0
                ? 'Персонажи без папки появятся здесь. Откройте папку слева, чтобы увидеть её героев.'
                : 'В этом проекте ещё нет персонажей. Добавьте первого, чтобы начать анкету.'}
          </div>
        ) : (
          <div className="characters-tiles">
            {folderCharacters.map((character) => (
              <div
                className="character-tile"
                key={character.id}
                role="button"
                tabIndex={0}
                onClick={() => openCharacter(character)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openCharacter(character)
                }}
              >
                <label
                  className="character-tile-select"
                  title="Выбрать персонажа"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(character.id)}
                    onChange={() => toggleSelect(character.id)}
                  />
                </label>
                <div className="character-tile-avatar" style={{ borderColor: character.color ?? '#7aa2f7' }}>
                  {character.avatarPath ? (
                    <img src={character.avatarPath} alt={character.name} />
                  ) : (
                    <UserRound size={30} style={{ color: character.color ?? '#7aa2f7' }} />
                  )}
                </div>
                <div className="character-tile-name truncate">{character.name || 'Без имени'}</div>
                {character.role && <div className="character-tile-role truncate">{character.role}</div>}
              </div>
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
      await window.api.characters.applyTemplate({ projectId, templateId: template.id, characterIds: null })
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
    onProjectChange(await window.api.templates.update({ projectId, templateId: template.id, patch: { name } }))
  }

  const deleteTemplate = async (template: CharacterTemplate): Promise<void> => {
    const ok = await confirmDialog({ title: `Удалить шаблон «${template.name}»?`, danger: true, confirmLabel: 'Удалить' })
    if (!ok) return
    onProjectChange(await window.api.templates.delete({ projectId, templateId: template.id }))
  }

  const updateLabels = async (template: CharacterTemplate, fieldLabels: string[]): Promise<void> => {
    onProjectChange(
      await window.api.templates.update({ projectId, templateId: template.id, patch: { fieldLabels } })
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
                  <Button variant="ghost" size="sm" icon title="Удалить шаблон" onClick={() => deleteTemplate(template)}>
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
                        onClick={() => updateLabels(template, template.fieldLabels.filter((_, i) => i !== index))}
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
