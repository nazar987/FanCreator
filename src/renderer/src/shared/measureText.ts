/**
 * Измерение ширины текста через offscreen-canvas (кэшированный контекст).
 * Нужно для динамического расчёта ширины колонок дерева под подписи связей.
 */
let ctx: CanvasRenderingContext2D | null = null

export function measureTextWidth(text: string, font = '600 11px Inter, system-ui, sans-serif'): number {
  if (!text) return 0
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * 7 // грубая оценка, если canvas недоступен
  ctx.font = font
  return ctx.measureText(text).width
}
