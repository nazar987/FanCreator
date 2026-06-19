import React from 'react'
import { ImagePlus, X } from 'lucide-react'

interface ImageStripProps {
  projectId: string
  images: string[]
  onChange: (images: string[]) => void
  emptyHint?: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Полоска изображений-набросков (концепт-арты). Картинки сохраняются файлами
 * через assets.saveImage и хранятся как asset://-пути. Поддерживает выбор файла
 * и перетаскивание.
 */
export function ImageStrip({ projectId, images, onChange, emptyHint }: ImageStripProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [drag, setDrag] = React.useState(false)

  const addFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const saved: string[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const dataUrl = await readAsDataUrl(file)
        saved.push(await window.api.assets.saveImage({ projectId, dataUrl }))
      }
      if (saved.length) onChange([...images, ...saved])
    } finally {
      setBusy(false)
    }
  }

  const remove = (path: string): void => onChange(images.filter((p) => p !== path))

  return (
    <div
      className={`image-strip ${drag ? 'image-strip--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void addFiles(e.dataTransfer.files)
      }}
    >
      {images.map((src) => (
        <div className="image-strip-item" key={src}>
          <img src={src} alt="" loading="lazy" />
          <button className="image-strip-del" title="Удалить набросок" onClick={() => remove(src)}>
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        className="image-strip-add"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Добавить набросок / концепт-арт"
      >
        <ImagePlus size={18} />
        <span>{busy ? 'Загрузка…' : 'Добавить'}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {images.length === 0 && emptyHint && <span className="image-strip-hint dim">{emptyHint}</span>}
    </div>
  )
}
