export const EDGE_LABEL_ORIENTATIONS = ['auto', 'horizontal', 'vertical'] as const

export type EdgeLabelOrientation = (typeof EDGE_LABEL_ORIENTATIONS)[number]

export const EDGE_LABEL_ORIENTATION_LABEL: Record<EdgeLabelOrientation, string> = {
  auto: 'Авто',
  horizontal: 'Горизонтально',
  vertical: 'Вертикально'
}

export const isEdgeLabelOrientation = (value: string | null | undefined): value is EdgeLabelOrientation =>
  value === 'auto' || value === 'horizontal' || value === 'vertical'

export const readEdgeLabelOrientation = (
  storageKey: string,
  fallback: EdgeLabelOrientation = 'auto'
): EdgeLabelOrientation => {
  try {
    const value = window.localStorage.getItem(storageKey)
    return isEdgeLabelOrientation(value) ? value : fallback
  } catch {
    return fallback
  }
}

export const writeEdgeLabelOrientation = (storageKey: string, value: EdgeLabelOrientation): void => {
  try {
    window.localStorage.setItem(storageKey, value)
  } catch {
    // localStorage can be unavailable in restricted environments; the UI still works without persistence.
  }
}
