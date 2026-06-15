import React from 'react'
import { Plus, Trash2, UserRound } from 'lucide-react'
import type { Character, CharacterField, Project } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Hashtags, Input } from '../../shared/ui/components'
import { confirmDialog, promptText } from '../../shared/ui/dialogs'

interface CharacterCardProps {
  character: Character
  projectId: string
  onProjectChange: (project: Project | null) => void
}

function CharacterCard({
  character,
  projectId,
  onProjectChange
}: CharacterCardProps): React.JSX.Element {
  const [name, setName] = React.useState(character.name)
  const [role, setRole] = React.useState(character.role)
  const [fields, setFields] = React.useState(character.fields)

  React.useEffect(() => {
    setName(character.name)
    setRole(character.role)
    setFields(character.fields)
  }, [character])

  const update = async (
    patch: Partial<Pick<Character, 'name' | 'role' | 'fields'>>
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

  return (
    <Card className="character-card">
      <div className="character-card-head">
        <div className="character-avatar">
          <UserRound size={24} />
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
        {/* TODO(senior): подключить TagEditor после T2 */}
        <Hashtags tags={character.tags} />
        {!character.tags.length && <span className="dim">Тегов пока нет</span>}
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
  if (!current) return <div />

  const addCharacter = async (): Promise<void> => {
    applyProject(await window.api.characters.add({ projectId: current.id, name: 'Новый персонаж' }))
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
          <Button variant="primary" onClick={addCharacter}>
            <Plus size={17} /> Добавить персонажа
          </Button>
        </div>

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
                onProjectChange={applyProject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
