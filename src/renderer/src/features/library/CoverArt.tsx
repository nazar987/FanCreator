import React from 'react'
import { ImagePlus } from 'lucide-react'

interface CoverArtProps {
  title: string
  coverPath: string | null
  color?: string
  onClick?: () => void
  /** Перетащили файл-картинку — приходит dataURL. */
  onDropImage?: (dataUrl: string) => void
  onPick?: () => void
}

function coverTextColor(color: string): string {
  const normalized = color.replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'var(--text)'
  const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  )
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luminance > 0.2 ? 'var(--paper-text)' : 'var(--text)'
}

export function CoverArt({
  title,
  coverPath,
  color = '#8b8cf0',
  onClick,
  onDropImage,
  onPick
}: CoverArtProps): React.JSX.Element {
  const [drag, setDrag] = React.useState(false)

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/') || !onDropImage) return
    const reader = new FileReader()
    reader.onload = () => onDropImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div
      className={`cover ${drag ? 'drag-over' : ''}`}
      style={{ '--cover-color': color, '--cover-text': coverTextColor(color) } as React.CSSProperties}
      onClick={onClick}
      onDragOver={(e) => {
        if (!onDropImage) return
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="cover-book">
        <div className="cover-pages" />
        <div className="cover-page-flip" />
        <div className="cover-sleeve">
          {coverPath ? (
            <img src={coverPath} alt={title} draggable={false} />
          ) : (
            <div className="cover-fallback">
              <div className="cover-fallback-title">{title}</div>
            </div>
          )}
        </div>
      </div>
      {onPick && (
        <button
          className="btn btn--soft btn--sm cover-upload"
          onClick={(e) => {
            e.stopPropagation()
            onPick()
          }}
          title="Загрузить обложку"
        >
          <ImagePlus size={14} /> Обложка
        </button>
      )}
    </div>
  )
}
