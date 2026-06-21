import React from 'react'
import { ChevronRight, ClipboardList, ImagePlus, Plus, Trash2, UserRound, X } from 'lucide-react'
import type { Character, CharacterField } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Input } from '../../shared/ui/components'
import { confirmDialog, promptText } from '../../shared/ui/dialogs'
import { TagEditor } from '../../shared/ui/TagEditor'
import { ColorPalette } from '../../shared/ui/ColorPalette'
import { AutoTextarea } from '../../shared/ui/AutoTextarea'
import { Collage } from '../../shared/ui/Collage'

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Индивидуальная страница персонажа (S-F9): аватар + имя/роль/папка/теги,
 * анкета (поля + применение шаблона) и галерея артов. Открывается отдельной
 * вкладкой по клику на карточку персонажа.
 */
export function CharacterPage({ characterId }: { characterId: string }): React.JSX.Element {
  const { current, applyProject, closeTab } = useStore()
  const character = current?.characters.find((c) => c.id === characterId)
  const projectId = current?.id ?? ''
  const folders = current?.characterFolders ?? []
  const templates = current?.templates ?? []

  const [name, setName] = React.useState(character?.name ?? '')
  const [role, setRole] = React.useState(character?.role ?? '')
  const [fields, setFields] = React.useState<CharacterField[]>(character?.fields ?? [])
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? '')
  const avatarInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!character) return
    setName(character.name)
    setRole(character.role)
    setFields(character.fields)
  }, [character])

  React.useEffect(() => {
    setTemplateId((cur) => (templates.some((t) => t.id === cur) ? cur : templates[0]?.id ?? ''))
  }, [templates])

  if (!current || !character) {
    return <div className="character-page-missing dim">Персонаж не найден</div>
  }

  const update = async (
    patch: Partial<Pick<Character, 'name' | 'role' | 'tags' | 'fields' | 'images' | 'avatarPath' | 'color' | 'templateId'>>
  ): Promise<void> => {
    applyProject(await window.api.characters.update({ projectId, characterId, patch }))
  }

  const setFolder = async (folderId: string | null): Promise<void> => {
    applyProject(await window.api.characters.setFolder({ projectId, characterId, folderId }))
  }

  const updateField = (id: string, patch: Partial<CharacterField>): void =>
    setFields((cur) => cur.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const addField = async (): Promise<void> => {
    const label = await promptText({ title: 'Название характеристики', placeholder: 'Например, биография' })
    if (!label) return
    const next = [...fields, { id: crypto.randomUUID(), label, value: '' }]
    setFields(next)
    await update({ fields: next })
  }

  const removeField = async (id: string): Promise<void> => {
    const next = fields.filter((f) => f.id !== id)
    setFields(next)
    await update({ fields: next })
  }

  const toggleField = (id: string): void =>
    setCollapsed((cur) => {
      const next = new Set(cur)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const applyTemplate = async (): Promise<void> => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    // T-F12: если анкета не пуста — спросим, заменить или дополнить
    let replace = false
    if (fields.length > 0) {
      replace = await confirmDialog({
        title: `Применить шаблон «${template.name}»?`,
        message: 'OK — заменить анкету полями шаблона (значения совпадающих полей сохранятся). Отмена — добавить недостающие поля.',
        confirmLabel: 'Заменить'
      })
    }
    const byLabel = new Map(fields.map((f) => [f.label.trim().toLowerCase(), f]))
    let next: CharacterField[]
    if (replace) {
      next = template.fieldLabels
        .filter((l) => l.trim())
        .map((label) => ({
          id: crypto.randomUUID(),
          label,
          value: byLabel.get(label.trim().toLowerCase())?.value ?? ''
        }))
    } else {
      const existing = new Set(fields.map((f) => f.label.trim().toLowerCase()))
      const added = template.fieldLabels
        .filter((l) => l.trim() && !existing.has(l.trim().toLowerCase()))
        .map((label) => ({ id: crypto.randomUUID(), label, value: '' }))
      next = [...fields, ...added]
    }
    setFields(next)
    await update({ fields: next, templateId: template.id })
  }

  const pickAvatar = async (file: File | undefined | null): Promise<void> => {
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await readAsDataUrl(file)
    const path = await window.api.assets.saveImage({ projectId, dataUrl })
    await update({ avatarPath: path })
  }

  const removeCharacter = async (): Promise<void> => {
    if (
      !(await confirmDialog({
        title: `Удалить персонажа «${character.name || 'Без имени'}»?`,
        message: 'Персонаж и вся его анкета будут удалены.',
        danger: true,
        confirmLabel: 'Удалить'
      }))
    )
      return
    applyProject(await window.api.characters.delete({ projectId, characterId }))
    closeTab(`character:${characterId}`)
  }

  const color = character.color ?? '#7aa2f7'

  return (
    <div className="character-page">
      <div className="character-page-inner">
        <header className="character-page-head">
          <div className="character-avatar-frame" style={{ borderColor: color }}>
            {character.avatarPath ? (
              <img src={character.avatarPath} alt={character.name} />
            ) : (
              <span className="character-avatar-empty" style={{ color }}>
                <UserRound size={44} />
              </span>
            )}
            <button
              className="character-avatar-edit"
              title="Загрузить фото"
              onClick={() => avatarInput.current?.click()}
            >
              <ImagePlus size={15} />
            </button>
            {character.avatarPath && (
              <button
                className="character-avatar-remove"
                title="Убрать фото"
                onClick={() => update({ avatarPath: null })}
              >
                <X size={14} />
              </button>
            )}
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                void pickAvatar(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>

          <div className="character-page-id">
            <Input
              className="character-page-name"
              value={name}
              placeholder="Имя персонажа"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() !== character.name && update({ name: name.trim() })}
            />
            <Input
              value={role}
              placeholder="Роль (например, главный герой)"
              onChange={(e) => setRole(e.target.value)}
              onBlur={() => role !== character.role && update({ role })}
            />
            <div className="character-page-meta">
              <select
                className="input"
                value={character.folderId ?? ''}
                onChange={(e) => setFolder(e.target.value || null)}
                title="Папка"
              >
                <option value="">Без папки</option>
                {folders
                  .slice()
                  .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
              </select>
              <ColorPalette value={color} title="Цвет карточки" onChange={(c) => update({ color: c })} />
              <Button variant="ghost" size="sm" icon title="Удалить персонажа" onClick={removeCharacter}>
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        </header>

        <div className="character-page-body">
          <div className="character-page-col">
        <div className="character-control">
          <span>Теги</span>
          <TagEditor tags={character.tags} placeholder="Добавить тег" onChange={(tags) => update({ tags })} />
        </div>

        <section className="character-page-section">
          <div className="character-page-section-head">
            <h3>Анкета</h3>
            {templates.length > 0 && (
              <div className="character-template-apply">
                <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button variant="soft" size="sm" onClick={applyTemplate}>
                  <ClipboardList size={15} /> Применить шаблон
                </Button>
              </div>
            )}
          </div>

          <div className="character-fields">
            {fields.map((field) => (
              <div className="character-field" key={field.id}>
                <div className="character-field-head">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon
                    title={collapsed.has(field.id) ? 'Развернуть' : 'Свернуть'}
                    onClick={() => toggleField(field.id)}
                  >
                    <ChevronRight
                      size={15}
                      className={collapsed.has(field.id) ? '' : 'character-field-chevron--open'}
                    />
                  </Button>
                  <Input
                    value={field.label}
                    aria-label="Название характеристики"
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    onBlur={() => update({ fields })}
                  />
                  <Button variant="ghost" size="sm" icon title="Удалить" onClick={() => removeField(field.id)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
                {!collapsed.has(field.id) && (
                  <AutoTextarea
                    className="input character-field-value"
                    value={field.value}
                    placeholder="Описание"
                    onChange={(e) => updateField(field.id, { value: e.target.value })}
                    onBlur={() => update({ fields })}
                  />
                )}
              </div>
            ))}
          </div>

          <Button variant="soft" size="sm" onClick={addField}>
            <Plus size={15} /> Добавить характеристику
          </Button>
        </section>
          </div>

          <div className="character-page-col">
        <section className="character-page-section">
          <div className="character-page-section-head">
            <h3>Галерея</h3>
          </div>
          <Collage
            projectId={projectId}
            images={character.images ?? []}
            onChange={(images) => update({ images })}
            emptyHint="Иллюстрации и концепт-арты персонажа. Перетащите сюда или нажмите «Добавить»."
          />
        </section>
          </div>
        </div>
      </div>
    </div>
  )
}
