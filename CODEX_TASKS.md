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

## T3 — Сохранение темы оформления по проекту (Easy)
**Зачем:** пожелание №12 — тема должна запоминаться.
Сейчас `openProject` применяет `project.theme`, но смена темы нигде не сохраняется.

**Файл:** `src/renderer/src/store/store.tsx`, функция `setTheme`.
Доработать так: если открыт проект (`current` не null) — после смены темы сохранить её:
`window.api.projects.update({ projectId: current.id, patch: { theme: t } })` и затем
`applyProject(result)`. На главном экране (без проекта) — просто менять локально, как сейчас.

**Приёмка:** открыть проект, сменить тему, закрыть и открыть проект снова → тема та же.
На разных проектах могут быть разные темы.

---

## T4 — Обложка проекта на главном экране (Easy-Medium)
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

## T5 — Drag & Drop переупорядочивание глав в дереве (Medium)
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

# 🔒 Что Codex НЕ берёт (зона senior)

Это сложные/архитектурные/«опасные» вещи — их делает senior (Claude):
- **Шаблоны анкет персонажей** (создание/редактирование шаблонов, применение к группе) — №16.
- **Карта взаимоотношений** (узлы + разноцветные направленные стрелки + легенда) — №17.
- **Заметки-стикеры** (перетаскиваемые цветные стикеры + стрелки) — №18.
- **Таймлайн «рыбья кость»** и **карточки как в Miro** — №2.
- **Notion-подстраницы/ссылки внутри листа редактора** — №14.
- **Перенос главы между историями**, полнотекстовый индекс поиска.
- Любые изменения в **редакторе и пагинации**.

Если по ходу простой задачи ты понял, что она тянет за собой что-то из этого списка —
останови работу и отметь `// TODO(senior)`.
