import React from 'react'
import { X } from 'lucide-react'

interface TagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagEditor({ tags, onChange, placeholder }: TagEditorProps): React.JSX.Element {
  const [value, setValue] = React.useState('')

  const removeTag = (tag: string): void => {
    onChange(tags.filter((item) => item !== tag))
  }

  const addTag = (): void => {
    const tag = value.trim().replace(/^#+/, '').trim()
    setValue('')
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
  }

  return (
    <div className="tag-editor">
      {tags.map((tag) => (
        <span className="tag-chip" key={tag}>
          #{tag}
          <button type="button" title={`Удалить тег ${tag}`} onClick={() => removeTag(tag)}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            addTag()
          }
          if (event.key === 'Backspace' && !value && tags.length > 0) {
            removeTag(tags[tags.length - 1])
          }
        }}
      />
    </div>
  )
}
