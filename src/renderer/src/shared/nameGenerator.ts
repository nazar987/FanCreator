/**
 * Генератор имён персонажей — «кубик» в разделе «Персонажи».
 * Слоговые пулы подобраны под фэнтези/исторические истории, но без
 * привязки к конкретной вселенной. Имена собираются из начала и
 * окончания, поэтому почти всегда звучат «по-книжному».
 */

const MALE_START = ['Ал', 'Тор', 'Кас', 'Дар', 'Эр', 'Вал', 'Рен', 'Гал', 'Ор', 'Лют', 'Сев', 'Мар', 'Хал', 'Бра']
const MALE_END = ['дан', 'рик', 'мир', 'вин', 'дор', 'ран', 'лей', 'гар', 'тис', 'вел', 'мунд', 'аст']

const FEMALE_START = ['Аэ', 'Эли', 'Лиа', 'Мира', 'Сель', 'Ина', 'Тали', 'Ноэ', 'Кае', 'Веле', 'Ари', 'Юна', 'Ила', 'Мэй']
const FEMALE_END = ['ра', 'лия', 'нэль', 'ста', 'вия', 'на', 'ель', 'ика', 'ая', 'рин', 'сса']

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

function makeName(female: boolean): string {
  const start = female ? pick(FEMALE_START) : pick(MALE_START)
  const end = female ? pick(FEMALE_END) : pick(MALE_END)
  // стык гласная+гласная читается плохо — вставляем мягкую согласную
  const clash = /[аеёиоуыэюя]$/i.test(start) && /^[аеёиоуыэюя]/i.test(end)
  return start + (clash ? 'л' : '') + end
}

/** Возвращает `count` уникальных имён, чередуя женские и мужские. */
export function generateNames(count = 8): string[] {
  const names = new Set<string>()
  let female = Math.random() < 0.5
  let guard = 0
  while (names.size < count && guard++ < 200) {
    names.add(makeName(female))
    female = !female
  }
  return [...names]
}
