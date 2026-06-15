# CODEX_TASKS — задачи для Codex (junior)

> Этот файл ведёт senior (Claude). Codex берёт задачи **сверху вниз**, по одной.
> Перед началом задачи прочитай разделы «Золотые правила» и «Шпаргалка по архитектуре».
> Не уверен — **не угадывай**, оставь комментарий `// TODO(senior): вопрос ...` и переходи дальше.

---

## 🟡 Золотые правила (читать каждый раз)

1. **Язык интерфейса — русский.** Все надписи, кнопки, подсказки — по-русски.
2. **TypeScript строгий.** Перед тем как считать задачу готовой, запусти `npm run typecheck` —
   должно быть **0 ошибок**. Если не проходит — чини, пока не пройдёт.
3. **Не трогай редактор.** Файлы `src/renderer/src/features/editor/**` и пагинацию —
   это зона senior. Если задача якобы требует туда лезть — стоп, спроси senior.
4. **Не добавляй новые npm-зависимости** без разрешения senior. Используй то, что уже есть
   (`lucide-react`, `@hello-pangea/dnd`, `framer-motion` уже установлены).
5. **Никаких `window.prompt/confirm/alert`** — в Electron они заблокированы. Используй
   `promptText()` и `confirmDialog()` из `src/renderer/src/shared/ui/dialogs.tsx`.
6. **Стиль кода — как в соседних файлах.** Те же отступы, именование,組 структура. Цвета —
   только через CSS-переменные (`var(--accent)`, `var(--panel)`, `var(--text)` и т.д.,
   см. `src/renderer/src/theme/theme.css`). Никаких хардкод-цветов типа `#fff`.
7. **Одна задача — один коммит.** Сообщение коммита на русском, кратко по сути.
8. После изменения данных в renderer **всегда** обновляй состояние через `applyProject(result)`
   (см. шпаргалку). Не дублируй логику стора.

---

## 🧭 Шпаргалка по архитектуре

Стек: **Electron + electron-vite + React 18 + TypeScript**. Данные — на диске
(`userData/FanCreator/projects/<id>/project.json`), картинки — файлами, отдаются по протоколу
`asset://`. UI — свой дизайн-система на CSS-переменных (без Mantine).

### Поток данных (главное!)
```
renderer (UI)  --window.api.*-->  preload  --ipcRenderer.invoke-->  main (ipc handlers)  -->  диск
```
Почти все мутации возвращают **полный обновлённый `Project`**. В renderer после вызова делай:
```ts
const { current, applyProject } = useStore()
const result = await window.api.stories.update({ projectId: current.id, storyId, patch })
applyProject(result)   // обновит и текущий проект, и список на главном экране
```

### Как добавить новый IPC-метод (если задача требует)
Нужно поправить **3 файла** синхронно:
1. `src/main/ipc/index.ts` — сам обработчик. Используй готовый помощник
   `mutate(projectId, (p) => { ... })` — он читает проект, применяет мутацию, пишет на диск
   и возвращает проект. Есть утилиты `now()`, `uid()`.
2. `src/shared/api.ts` — добавь сигнатуру метода в интерфейс `FanCreatorApi` (типобезопасно).
3. `src/preload/index.ts` — пробрось: `methodName: (input) => invoke('channel:name', input)`.

Каналы именуются `сущность:действие` (`stories:update`, `characters:add` …).

### Готовые кирпичики UI (переиспользуй, не пиши заново)
- `src/renderer/src/shared/ui/components.tsx`: `Button` (variant `primary|ghost|soft|danger`,
  size `sm|md`, `icon`), `Input` (есть проп `icon`), `Card`, `StatusBadge`, `Hashtags`.
- `src/renderer/src/shared/ui/dialogs.tsx`: `promptText({title, placeholder?, initial?})` →
  `Promise<string|null>`; `confirmDialog({title, message?, danger?})` → `Promise<boolean>`.
- `src/renderer/src/shared/ui/ContextMenu.tsx`: `openContextMenu(event, items: MenuItem[])`.
  `MenuItem = { label, icon?, onClick?, danger?, submenu?, type?: 'sep'|'label' }`.
- Иконки: `lucide-react` (`import { Plus, Trash2 } from 'lucide-react'`).

### Стор (`src/renderer/src/store/store.tsx`) — что доступно через `useStore()`
`current` (открытый Project | null), `applyProject(p)`, `reloadCurrent()`,
`projects` (список сводок), `refreshProjects()`, `openProject(id)`, `closeProject()`,
`tabs`, `activeTabId`, `openTab({id?, kind, title, storyId?, chapterId?})`, `closeTab(id)`,
`setActiveTab(id)`, `theme`, `setTheme(t)`.
Тип вкладки `OpenTab.kind` уже включает `'shelf' | 'chapter' | 'characters'`.

### Модель данных — `src/shared/types.ts`
`Project { id, title, coverPath, description, tags[], theme, stories[], characters[] }`.
`Story { id, title, coverPath, synopsis, tags[], genres[], status, chapters[] }`.
`Character { id, name, role, tags[], templateId, fields: CharacterField[], avatarPath }`.
`CharacterField { id, label, value }`. `ChapterStatus = 'idea'|'draft'|'editing'|'done'`.

### Где что рисуется
- `src/renderer/src/app/App.tsx` — выбирает контент по `active.kind`.
- `src/renderer/src/app/Sidebar.tsx` — дерево историй/глав, контекстные меню.
- `src/renderer/src/app/TabBar.tsx` — верхние вкладки и меню «+».
- `src/renderer/src/features/library/**` — главный экран и полка с обложками.
- CSS каждой фичи импортируется в `src/renderer/src/main.tsx`.

### Definition of Done (для каждой задачи)
- [ ] `npm run typecheck` — без ошибок.
- [ ] `npm run dev` — приложение запускается, фича работает, данные переживают перезапуск.
- [ ] Интерфейс на русском, цвета через переменные, использованы готовые кирпичики UI.
- [ ] Не задеты редактор и пагинация.

---

# ЗАДАЧИ (по порядку)

## ✅ T1 — Раздел «Персонажи» (Medium) — СДЕЛАНО (commit 620b680, ревью senior пройдено)
> Следующая задача — **T2**. T2 также уберёт `TODO(senior)` про TagEditor в карточке персонажа.

### (архив описания T1)
**Зачем:** пожелание №16. В новом UI раздела персонажей пока **нет вообще** (есть только модель
и IPC). Нужно собрать экран.

**IPC уже готов** — ничего в main/preload менять не нужно:
`window.api.characters.add({projectId, name})`,
`.update({projectId, characterId, patch})` (patch принимает `name, role, tags, fields`),
`.delete({projectId, characterId})`. Все возвращают `Project`.

**Файлы:**
- создать `src/renderer/src/features/characters/Characters.tsx` и `characters.css`;
- импортировать css в `src/renderer/src/main.tsx`;
- в `src/renderer/src/app/App.tsx` отрисовать `<Characters />` когда `active?.kind === 'characters'`;
- в `src/renderer/src/app/TabBar.tsx` в меню «+» (`addMenu`) добавить пункт «Персонажи»,
  открывающий `openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })`.

**Что должно быть на экране:**
- Кнопка «Добавить персонажа» (`characters.add`, имя по умолчанию «Новый персонаж»).
- Карточки персонажей (используй `Card`). В карточке:
  - Имя — `Input`, сохранение на `onBlur` (patch `{name}`).
  - Роль — `Input` (patch `{role}`).
  - Теги — компонент `TagEditor` из задачи **T2** (если T2 ещё не сделана, временно покажи
    `Hashtags` только на чтение и оставь `// TODO(senior): подключить TagEditor после T2`).
  - Список произвольных полей `fields` (биография, внешность и т.п.): каждое поле = подпись
    (`label`) + многострочный текст (`<textarea>`-стилизуй под `.input`). Сохранение на blur
    обновляет массив `fields` целиком в patch `{fields}`.
  - Кнопка **«+ Подробнее»** — спрашивает `promptText({title:'Название характеристики'})`,
    добавляет в `fields` новый объект `{ id: crypto.randomUUID(), label, value: '' }`.
  - У каждого поля — крестик удаления (убрать из `fields`).
  - Кнопка удаления персонажа (через `confirmDialog`, `danger:true`).
- Всё сохраняется через `applyProject(result)`.

**Приёмка:** можно добавлять/редактировать/удалять персонажей и их поля; после перезапуска
всё на месте; вкладка «Персонажи» открывается из «+».

**НЕ делать:** шаблоны анкет и применение к группе — это отдельная задача senior. Здесь только
ручное редактирование одного персонажа.

---

## ✅ T2 — TagEditor + теги/жанры/свойства истории (Easy) — СДЕЛАНО (commit aaf8e51, ревью senior пройдено)
> TagEditor подключён и в карточку персонажа (TODO из T1 закрыт). Следующая задача — **T3**.

### (архив описания T2)
**Зачем:** пожелания №3 и №19 (хэштеги, жанры).

**Часть A. Переиспользуемый редактор тегов.**
Создать `src/renderer/src/shared/ui/TagEditor.tsx`:
```ts
function TagEditor(props: { tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }): JSX.Element
```
- Поле ввода; **Enter** добавляет тег (без `#`, без дублей, trim); **Backspace** на пустом поле
  удаляет последний; у каждого чипа крестик. Стили — в `ui.css` (класс `.tag-chip`),
  цвета через переменные.

**Часть B. Окно «Свойства истории».**
Создать `src/renderer/src/features/library/StoryProperties.tsx` — модалка (по образцу
`.modal` из `ui.css`, можно как в `dialogs.tsx`) с полями: название (`Input`), синопсис
(`textarea`), статус (`<select>` со значениями ChapterStatus + русские подписи — есть
`STATUS_LABEL` в `components.tsx`), теги (`TagEditor`), жанры (`TagEditor`). Кнопка «Сохранить»
вызывает `window.api.stories.update({ projectId, storyId, patch })` → `applyProject`.

Открывать это окно из контекстного меню истории: в `src/renderer/src/app/Sidebar.tsx`
в `storyMenu(s)` добавить пункт «Свойства» (иконка `Settings2`). Хранить открытую историю в
локальном `useState` Sidebar и рендерить `<StoryProperties .../>` при наличии.

**Приёмка:** у истории можно задать синопсис, статус, теги и жанры; теги/жанры видны в дереве
и на полке как `#хэштеги`; сохраняется после перезапуска. После T2 — подключить `TagEditor`
в карточку персонажа (T1) и оставить там `tags` редактируемыми.

---

## ✅ T3 — Сохранение темы оформления по проекту (Easy) — СДЕЛАНО (commit f67e998)
### (архив описания T3)
**Зачем:** пожелание №12 — тема должна запоминаться.
Сейчас `openProject` применяет `project.theme`, но смена темы нигде не сохраняется.

**Файл:** `src/renderer/src/store/store.tsx`, функция `setTheme`.
Доработать так: если открыт проект (`current` не null) — после смены темы сохранить её:
`window.api.projects.update({ projectId: current.id, patch: { theme: t } })` и затем
`applyProject(result)`. На главном экране (без проекта) — просто менять локально, как сейчас.

**Приёмка:** открыть проект, сменить тему, закрыть и открыть проект снова → тема та же.
На разных проектах могут быть разные темы.

---

## ✅ T4 — Обложка проекта на главном экране (Easy-Medium) — СДЕЛАНО (commit fd7c5f7)
### (архив описания T4)
**Зачем:** пожелание №19 (проекты тоже как книги).
Сейчас обложки есть только у историй. Нужно повторить для проектов.

**IPC — добавить (3 файла, см. шпаргалку), по образцу `stories:setCover`/`stories:pickCover`:**
- `projects:setCover` `{ projectId, source, isDataUrl? }` — сохраняет картинку (используй уже
  существующие `saveAsset`, `assetUrl`, `dataUrlToBuffer` в `src/main/ipc/index.ts`) и пишет
  результат в `p.coverPath`.
- `projects:pickCover` `{ projectId }` — диалог выбора файла (как у историй).
Добавь обе в `FanCreatorApi.projects` (`src/shared/api.ts`) и в `src/preload/index.ts`.

**Renderer:** `src/renderer/src/features/library/Home.tsx` — передать в `<CoverArt>` пропсы
`onDropImage` (→ `projects.setCover` с `isDataUrl:true`) и `onPick` (→ `projects.pickCover`),
после вызова — `refreshProjects()`. `CoverArt` уже умеет drag&drop и кнопку «Обложка».

**Приёмка:** перетащил картинку на карточку проекта → обложка сохранилась и показывается;
переживает перезапуск.

---

## ✅ T5 — Drag & Drop переупорядочивание глав в дереве (Medium) — СДЕЛАНО (commit a34290e)
> Все задачи T1–T5 выполнены и приняты. Дальше — «ФАЗА 2» ниже: крупные фичи делятся на
> фундамент (Codex) и финиш (senior). Начинай с **T6**.
### (архив описания T5)
**Зачем:** пожелания №7/№15 — управлять порядком глав.
**IPC уже готов:** `window.api.chapters.reorder({ projectId, storyId, order: string[] })` →
`Project` (`order` — массив id глав в новом порядке).

**Файл:** `src/renderer/src/app/Sidebar.tsx`. Использовать **уже установленный** `@hello-pangea/dnd`
(`DragDropContext`, `Droppable`, `Draggable`). Обернуть список глав внутри раскрытой истории.
На `onDragEnd`: посчитать новый порядок id и вызвать `chapters.reorder` → `applyProject`.

**Важно не сломать:** клик по главе (открыть), двойной клик, контекстное меню должны
продолжать работать. Перетаскивание — за «ручку» или за всю строку, но без конфликта с кликом.

**Приёмка:** главы переставляются мышкой, порядок сохраняется после перезапуска.

---

# 🚀 ФАЗА 2 — крупные фичи: модель «фундамент → финиш»

Дальше идут сложные интерактивные фичи (доска, таймлайн, шаблоны). Чтобы делить нагрузку,
каждая такая фича разбита на два слоя:

- **Часть Codex (фундамент)** — ограниченная и предсказуемая: модель данных, IPC, новая вкладка,
  CRUD и **статичный** рендер (без сложного интерактива). Это то, что ты делаешь.
- **Потом senior (финиш)** — сложный интерактив: бесконечный холст с зумом/панорамой,
  перетаскивание мышью, рисование стрелок, SVG-раскладки. Это делает Claude **поверх твоего
  фундамента**. Поэтому **строго соблюдай контракты типов из этого файла** — senior на них
  рассчитывает.

**Где оставлять швы для senior:** в местах, где нужен интерактив, ставь явный комментарий
`// SENIOR: <что тут будет>` и делай простую заглушку. Не пытайся реализовать зум/драг/рисование
стрелок — это не твоя часть, сделаешь лишнюю работу.

## Общие конвенции для новых фич
- **Новая вкладка:** расширь `OpenTab.kind` в `src/renderer/src/store/store.tsx` (как уже сделано
  для `'characters'`), добавь нужные поля (`boardId?`, `timelineId?`). В `src/renderer/src/app/App.tsx`
  добавь ветку рендера по `active.kind`. В `TabBar.tsx` (`addMenu`) добавь пункт открытия.
- **Новый раздел данных:** добавь типы в `src/shared/types.ts`, поле в `Project`, IPC в
  `src/main/ipc/index.ts` (через `mutate`), сигнатуры в `src/shared/api.ts`, проброс в `src/preload/index.ts`.
- **Автосохранение «тяжёлого» полотна** (доска): сохраняй весь объект целиком с дебаунсом ~600 мс,
  как сделано в редакторе (`src/renderer/src/features/editor/Editor.tsx`, `saveTimer`). Не дёргай
  IPC на каждое движение.
- CSS фичи — отдельный файл, импорт в `src/renderer/src/main.tsx`.

---

## ✅ T6 — Доска: данные + IPC + статичный рендер (Medium) — СДЕЛАНО (commit 8ab8c59, ревью senior пройдено)
> Фундамент принят. Финиш (S-A: зум/панорама, перетаскивание, рисование стрелок) делает senior
> поверх `features/board/Board.tsx`. Codex дальше может брать **T7** (независимая).
### (архив описания T6)
**Зачем:** объединённое пожелание №17 + №18 — безлимитная «доска детектива» как в Miro:
сколько угодно досок на проект, стикеры разных цветов/форм + стрелки между ними.
**Твоя часть — фундамент. Перетаскивание/зум/рисование стрелок НЕ делаешь (это senior).**

**1) Типы (`src/shared/types.ts`) — реализуй ровно так:**
```ts
export type StickerShape = 'rect' | 'rounded' | 'circle' | 'note'
export interface BoardSticker {
  id: string
  x: number; y: number   // координаты на холсте (мировые, не экранные)
  w: number; h: number
  color: string          // hex, напр. '#ffd166'
  shape: StickerShape
  text: string
}
export interface BoardArrow {
  id: string
  fromId: string         // id стикера-источника
  toId: string           // id стикера-цели
  color: string
  label?: string
}
export interface Board {
  id: string
  title: string
  stickers: BoardSticker[]
  arrows: BoardArrow[]
  createdAt: number
  updatedAt: number
}
```
И добавь в `Project` поле `boards: Board[]` (а также в `projects:create` инициализируй `boards: []`,
и в миграции `src/main/store/store.ts` — `boards: legacy.boards ?? []`).

**2) IPC (`src/main/ipc/index.ts` + `api.ts` + `preload`):**
- `boards:add({ projectId, title })` → `Project` (новый Board с пустыми массивами).
- `boards:rename({ projectId, boardId, title })` → `Project`.
- `boards:delete({ projectId, boardId })` → `Project`.
- `boards:save({ projectId, boardId, stickers, arrows })` → `Project` (полная перезапись полотна).

**3) Вкладка и открытие:** добавь `kind: 'board'` и `boardId?` в `OpenTab`; в `App.tsx` рендерь
`<Board boardId=... />`; в `TabBar.addMenu` — пункт «Новая доска» (создать + открыть) и список
существующих досок проекта для открытия.

**4) Компонент `src/renderer/src/features/board/Board.tsx` + `board.css` (СТАТИЧНЫЙ):**
- Контейнер-холст: `position: relative; overflow: hidden;`. Внутри — **обёртка трансформации**
  `<div className="board-world" style={{ transform: \`translate(${pan.x}px,${pan.y}px) scale(${zoom})\` }}>`
  с локальным состоянием `pan={x:0,y:0}`, `zoom=1`. **Пока не меняй их** — это шов для senior:
  `// SENIOR: pan & zoom (колесо/пробел-драг) меняют pan/zoom`.
- Стикеры: абсолютно позиционированные `div` по `x/y`, размер `w/h`, фон `color`, форма по `shape`
  (`circle` → border-radius 50%, `note` → лёгкий «загнутый угол» и т.п.). Текст — редактируемый
  (`textarea`/contentEditable), меняет `sticker.text`.
- На каждом стикере мини-панель: выбор цвета (`<input type=color>`), выбор формы (`<select>`),
  удаление. Кнопка «Добавить стикер» создаёт стикер в видимой области (напр. x=120+40*n, y=120).
- Стрелки: один **SVG-оверлей** на весь мир; для каждой `arrow` рисуй `<line>`/`<path>` от центра
  `fromId` к центру `toId` (центры считаются из `x+w/2`, `y+h/2`), цвет `arrow.color`, маркер-стрелку
  на конце (`<marker>`). Создание стрелки **мышью НЕ делай** — оставь
  `// SENIOR: рисование стрелок перетаскиванием от стикера к стикеру`. Для проверки можно временно
  добавить кнопку «связать выбранные», но это не обязательно.
- **Автосохранение:** локальный стейт `stickers`/`arrows`, при изменении — дебаунс-сейв через
  `boards:save` (см. конвенцию). Сидируй стейт из `board` при монтировании по `boardId`.

**Приёмка:** можно создать доску, добавить стикеры, поменять им текст/цвет/форму, удалить; стрелки
рендерятся между стикерами; всё сохраняется и переживает перезапуск; `npm run typecheck` чисто.
**Потом senior:** зум/панорама бесконечного холста, перетаскивание стикеров, рисование стрелок
мышью, разноцветные двусторонние связи + легенда, ресайз, выделение группой.

---

## T7 — Перенос главы между историями (Medium, целиком твоя)
**Зачем:** удобство (упоминалось в №7). Здесь senior-финиша нет — задача полностью твоя.

- **IPC:** `chapters:move({ projectId, fromStoryId, toStoryId, chapterId })` → `Project`. В `mutate`:
  убери главу из `fromStory.chapters`, добавь в конец `toStory.chapters`, пересчитай `order` в обеих
  историях, обнови `updatedAt`. Если `from===to` — ничего. Добавь в `api.ts` и `preload`.
- **UI (`src/renderer/src/app/Sidebar.tsx`):** в `chapterMenu` добавь пункт «Переместить» с
  `submenu` — список **других** историй проекта; клик вызывает `chapters.move` → `applyProject`.

**Приёмка:** глава переносится в выбранную историю, исчезает из старой, порядок корректный,
переживает перезапуск.

---

## ✅ T8 — Шаблоны анкет персонажей: фундамент (Medium) — СДЕЛАНО (commit cd94b26, ревью senior пройдено)
> Принято: CRUD шаблонов + применение к одному персонажу. Финиш (S-B: мультивыбор + применение
> к группе + распространение правок шаблона) — за senior. Codex дальше: **T9** (таймлайн).
### (архив описания T8)
**Зачем:** пожелание №16. **Твоя часть:** CRUD шаблонов + применение шаблона к **одному**
персонажу. Массовое применение к группе и распространение правок — senior.

- **Типы:** `CharacterTemplate { id, name, fieldLabels: string[] }`. Поле `Project.templates: CharacterTemplate[]`
  (init `[]` в create и миграции).
- **IPC:** `templates:add({projectId,name})`, `templates:update({projectId,templateId,patch})`
  (patch: `{name?, fieldLabels?}`), `templates:delete({projectId,templateId})`. Все → `Project`.
  Плюс в api/preload.
- **UI:** небольшой менеджер шаблонов (можно отдельной вкладкой `kind:'characters'` сверху, или
  модалкой «Шаблоны» из раздела персонажей): создать/переименовать/удалить шаблон; у шаблона —
  редактируемый список подписей полей (переиспользуй стиль из карточки персонажа).
- **Применить к одному:** на карточке персонажа — кнопка «Применить шаблон» (выбор из списка),
  которая **добавляет недостающие** поля (по `label`) в `character.fields`, не трогая существующие
  значения. Сохрани `character.templateId`.

**Приёмка:** можно завести шаблон с набором полей и применить его к персонажу — у него появляются
эти поля; переживает перезапуск. **Потом senior:** мультивыбор персонажей и применение к группе,
распространение правок шаблона на уже привязанных персонажей.

---

## ✅ T9 — Таймлайн: данные + IPC + список событий (Medium) — СДЕЛАНО (commit d858f2f, ревью senior пройдено)
> Принято: данные/IPC + линейный список событий. Финиш (S-C: раскладка «рыбья кость», ветки,
> драг/зум) — за senior. **Все задачи T1–T9 закрыты.** Дальше — только senior-финиши и чисто-senior.
### (архив описания T9)
**Зачем:** пожелание №2 (таймлайн, в идеале «рыбья кость»). **Твоя часть:** данные + простой
**линейный** список событий с CRUD. SVG-раскладку «рыбья кость» делает senior.

- **Типы:** `TimelineEvent { id, title, note: string, order: number }`,
  `Timeline { id, title, events: TimelineEvent[] }`. Поле `Project.timelines: Timeline[]` (init `[]`).
- **IPC:** `timelines:add`, `timelines:rename`, `timelines:delete`,
  `timelineEvents:add({projectId,timelineId,title})`, `timelineEvents:update`, `timelineEvents:delete`.
  Все → `Project`. Плюс api/preload.
- **Вкладка** `kind:'timeline'` + `timelineId?`; открытие из `TabBar`.
- **UI `features/timeline/Timeline.tsx`:** вертикальный/горизонтальный список событий с заголовком и
  заметкой, добавить/редактировать/удалить. Без перетаскивания и без SVG.

**Приёмка:** создаётся таймлайн, добавляются/редактируются/удаляются события, переживает перезапуск.
**Потом senior:** раскладка «рыбья кость» (хребет + наклонные «кости»), ветки/параллельные линии,
перетаскивание и зум.

---

# 🔒 Чисто senior (Codex не берёт совсем)
- **Notion-подстраницы и ссылки внутри листа редактора** (№14) — тесно связано с TipTap.
- Любые изменения в **редакторе и пагинации** (`src/renderer/src/features/editor/**`).
- Финишные интерактивные слои фич T6/T8/T9 (см. «Потом senior» в каждой).

Если по ходу задачи ты упёрся во что-то из этого — стоп, отметь `// TODO(senior)` и опиши вопрос.
