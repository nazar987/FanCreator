import React from 'react'
import { ImagePlus } from 'lucide-react'

interface CoverArtProps {
  title: string
  coverPath: string | null
  onClick?: () => void
  /** Перетащили файл-картинку — приходит dataURL. */
  onDropImage?: (dataUrl: string) => void
  onPick?: () => void
}

export function CoverArt({
  title,
  coverPath,
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
      onClick={onClick}
      onDragOver={(e) => {
        if (!onDropImage) return
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="cover-disc" />
      <div className="cover-sleeve">
        {coverPath ? (
          <img src={coverPath} alt={title} draggable={false} />
        ) : (
          <div className="cover-fallback">
            <div className="cover-fallback-title">{title}</div>
          </div>
        )}
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
