/**
 * Русское склонение существительных по числу.
 * plural(2, 'история', 'истории', 'историй') → 'истории'
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** Число + правильная форма слова: pl(2, 'глава', 'главы', 'глав') → '2 главы'. */
export function pl(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`
}
