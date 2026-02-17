# Task Redesign V7 — Implementation Context

> A `task-redesign-v7.jsx` fájl az egyetlen vizuális referencia. 
> Rendereld ki, és pixelpontosan azt valósítsd meg.
> Ez a dokumentum csak azt tartalmazza, ami a JSX-ből nem olvasható ki.

---

## Megközelítés

1. Először **olvasd végig a meglévő kódbázist** — schema, komponensek, konvenciók
2. Aztán **olvasd végig a JSX prototípust** — ez egyetlen fájl, ~1180 sor, mock datával, inline style-okkal
3. **Készíts tervet**, ami a prototípust a meglévő architektúrába illeszti
4. A prototípus inline style-jait **Tailwind osztályokra** konvertáld
5. A mock adatokat **Convex query-kre** cseréld
6. A `useState`-eket ahol szükséges **Convex mutation-ökre** cseréld

## Ami a prototípusból 1:1 jön

- **Minden szín, spacing, font-size, font-weight** — pontosan azok kellenek
- **SVG ikonok** — a StatusIcon és az I komponens SVG path-jai pixelre pontosak, másolni kell
- **Animációk** — popIn, slideIn, timerPulse, filterSlideIn keyframe-ek
- **Filter logika** — date presetek, operator cycling, select vs date filter viselkedés
- **Timer formátum** — H:MM megállva, H:MM:SS futáskor, tabular-nums

## Ami NEM a prototípusból jön

- **Adatbázis séma** — a meglévő Convex schemát bővítsd szükség szerint (pl. `dueDate`, `createdAt` mezők, ha még nincsenek)
- **Fájlstruktúra / komponens dekompozíció** — kövesd a projekt meglévő konvencióit
- **ShadcnUI** — ahol van megfelelő shadcn komponens (Popover, DropdownMenu, Checkbox, RadioGroup, ScrollArea), használd azokat a custom megoldás helyett
- **Routing** — illeszd a meglévő route struktúrába

## Viselkedési edge case-ek (amit a kódból nehezebb kiolvasni)

1. **Filter bar** nyitva marad amíg van aktív filter — csak "Clear all" vagy utolsó filter ✕-elése zárja
2. **Click outside** a filter bar-on belüli value dropdown-t zárja, de a bar-t nem (ha vannak filterek)
3. **Date filterek** single-select (radio), regular filterek multi-select (checkbox)
4. **Operator toggle** kattintásra: select → `is` ↔ `is not`; date → `is` → `before` → `after` → `is`
5. **Done sorok** 45% opacity, nincs due date chip, nincs play gomb a timeren
6. **Today sorok** meleg `#fbf7f6` háttér, hover: `#f7f2f1`
7. **Unread** taskok (lastEdited > lastViewed) vastag 650-es címet kapnak
8. **Timer** — egyszerre csak egy task-on futhat, a header bar-ban mindig látszik melyik fut
9. **InlineAddTask** — második sora (Client, Category, Status dropdown) csak gépelés után jelenik meg, és a csoportosításnak megfelelő dropdown rejtve marad
10. **`#c25852` az EGYETLEN színes akcentus** — minden más neutrál szürke a palettában
