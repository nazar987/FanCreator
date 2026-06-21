import React from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from 'lucide-react'

interface CollageProps {
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
 * Коллаж изображений в стиле Pinterest (masonry): разные по высоте картинки в
 * колонках, плавный ховер, полноэкранный просмотр по клику. Используется в
 * галерее персонажа (S-F9 / визуальное улучшение).
 */
export function Collage({ projectId, images, onChange, emptyHint }: CollageProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [drag, setDrag] = React.useState(false)
  const [viewIndex, setViewIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (viewIndex === null) return
    if (!images[viewIndex]) {
      setViewIndex(null)
      return
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setViewIndex(null)
      if (e.key === 'ArrowLeft') setViewIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
      if (e.key === 'ArrowRight') setViewIndex((i) => (i === null ? null : (i + 1) % images.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images, viewIndex])

  const addFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const saved: string[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        saved.push(await window.api.assets.saveImage({ projectId, dataUrl: await readAsDataUrl(file) }))
      }
      if (saved.length) onChange([...images, ...saved])
    } finally {
      setBusy(false)
    }
  }

  const remove = (src: string): void => onChange(images.filter((p) => p !== src))

  return (
    <div
      className={`collage ${drag ? 'collage--drag' : ''}`}
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
      <div className="collage-toolbar">
        <button className="collage-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus size={15} /> {busy ? 'Загрузка…' : 'Добавить'}
        </button>
        <span className="collage-hint dim">{images.length > 0 ? `${images.length} в коллаже` : (emptyHint ?? 'Перетащите картинки сюда')}</span>
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
      </div>

      {images.length > 0 ? (
        <div className="collage-grid">
          {images.map((src, index) => (
            <figure className="collage-item" key={src} onClick={() => setViewIndex(index)}>
              <img src={src} alt="" loading="lazy" />
              <button
                className="collage-del"
                title="Удалить"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(src)
                }}
              >
                <Trash2 size={14} />
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <div className="collage-empty" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={26} />
          <span>{emptyHint ?? 'Добавьте иллюстрации и концепт-арты'}</span>
        </div>
      )}

      {viewIndex !== null && images[viewIndex] && createPortal(
        <div className="image-lightbox" role="dialog" aria-modal="true" onClick={() => setViewIndex(null)}>
          <button className="image-lightbox-close" title="Закрыть" onClick={() => setViewIndex(null)}>
            <X size={22} />
          </button>
          {images.length > 1 && (
            <button
              className="image-lightbox-nav image-lightbox-nav--prev"
              title="Предыдущее"
              onClick={(e) => {
                e.stopPropagation()
                setViewIndex((viewIndex - 1 + images.length) % images.length)
              }}
            >
              <ChevronLeft size={28} />
            </button>
          )}
          <img src={images[viewIndex]} alt="" onClick={(e) => e.stopPropagation()} />
          {images.length > 1 && (
            <button
              className="image-lightbox-nav image-lightbox-nav--next"
              title="Следующее"
              onClick={(e) => {
                e.stopPropagation()
                setViewIndex((viewIndex + 1) % images.length)
              }}
            >
              <ChevronRight size={28} />
            </button>
          )}
          <span className="image-lightbox-count">{viewIndex + 1} / {images.length}</span>
        </div>,
        document.body
      )}
    </div>
  )
}
