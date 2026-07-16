# Theme Worlds 3.0

Theme World changes the visual language of FanCreator without changing navigation,
data, keyboard shortcuts or editor content. A world is defined by physical materials,
component geometry, typography and motion rather than by a color palette alone.

## Architecture

- `theme.css` owns color and surface tokens for classic palettes and worlds.
- `worlds.css` preserves the approved shell and library art direction.
- `theme/worlds/*.css` defines the semantic material contract for each world.
- Feature adapters consume semantic tokens and must not duplicate five selector trees.
- `.fc-prose` and the printable page remain outside Theme Worlds.

## World Identities

| World | Primary materials | Geometry | Motion |
| --- | --- | --- | --- |
| Fantasy | lapis, crystal, marble, gold | soft and floating | light sweep and mana breath |
| Dark Fantasy | basalt, forged iron, ember | heavy and compact | heat and weight |
| Medieval | blackened oak, parchment, woad, gilt and rubric | framed Gothic folios | candle light |
| Sci-Fi | titanium, holographic glass | precise and technical | scan and activation |
| Cyberpunk | terminal glass, signal labels | asymmetric hard cuts | short controlled glitch |

## Coverage Matrix

| Surface | Identity layer | Feature adapter | Notes |
| --- | --- | --- | --- |
| Shell, tabs, sidebar | complete | complete | `worlds.css` plus the per-world signature layer |
| Library and folders | complete | complete | `worlds.css` plus the per-world signature layer |
| Characters and folders | complete | complete | cards, profile, templates |
| Timeline list | complete | complete | events and rail |
| Tree, fishbone, genealogy | complete | complete | canvas, nodes, zoom controls |
| Board chrome | complete | complete | toolbar and linked entity preview |
| Help, updates, command palette | complete | complete | system overlays |
| Editor chrome | senior-owned | not in Codex scope | editor content is invariant |

The theme gallery previews a world without persisting it. It also exposes calm
and immersive intensity modes plus an explicit reduced-motion preference.

## Acceptance Rules

1. Hiding color must not erase a world's geometry and material hierarchy.
2. Every feature remains usable at 900 px and with the sidebar collapsed.
3. Focus, hover, selected and danger states remain legible in every world.
4. Decorative generated content is never required to understand an action.
5. System reduced-motion preference disables all repeating world animations.
6. Calm intensity keeps geometry and typography while reducing texture, glow and motion.
