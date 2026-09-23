# jpui-dropdown

A WeWeb custom element that turns any content into a dropdown trigger and renders a floating
panel next to it. The panel is teleported out of the component tree, so it is never clipped by a
parent's `overflow`.

Both the trigger and the panel are dropzones — you drop whatever WeWeb elements you want into
each, so this works equally well as a menu, a popover, a context menu, or a tooltip-like panel.

Based on [`weweb-assets/ww-dropdown`](https://github.com/weweb-assets/ww-dropdown).

## Features

- Three trigger modes: **click**, **hover**, **right-click**
- Position on any of the four sides, with `start` / `center` / `end` alignment
- X / Y offsets in `px` or `%`
- Optionally opens at the cursor, like a native context menu
- Optional slide + scale animation with a transform origin derived from position and alignment
- Teleported to `#app`, so no overflow clipping; repositions on scroll, resize, and trigger resize
- Flips and shifts to stay inside the viewport (`keepInViewport`)
- Nested dropdowns — opening or clicking a child does not close its parents
- Closes on outside click or outside right-click — opening one right-click menu closes the
  others; closes on <kbd>Esc</kbd>; `closeDropdown` action for workflows
- Exposes open state, trigger config, and position to the formula editor via local context
- `z-index` control and a disabled state
- "Force display in editor" so you can style the open panel on the canvas

## Installation

```bash
npm i
```

## Start

```bash
npm run serve --port=[PORT]
```

Then open the WeWeb editor, open the developer popup, and add `localhost:[PORT]` as a custom
element.

## Build

```bash
npm run build -- --name=jpui-dropdown --type=wwobject
```

The `--` is required. Without it npm swallows `--name` and the CLI stops with
`Error : arg 'name="name"' not specified` — while still exiting `0`, so read the output rather
than trusting the exit code.

This produces `dist/manager.js`, the **editor** bundle (`wwFront` blocks stripped, `wwEditor`
blocks kept). WeWeb builds the production bundle itself on publish, so a green local build proves
the component compiles, not that the front path works.

## Properties

| Property | Type | Default | Bindable | Responsive | Description |
| --- | --- | --- | --- | --- | --- |
| `triggerType` | `click` \| `hover` \| `right-click` | `click` | ✅ | — | How the dropdown opens |
| `smallScreenClickFallback` | boolean | `true` | ✅ | — | Right-click mode only. On non-`default` breakpoints a plain click also opens the dropdown. Turn off when the trigger's click already does something else (e.g. selects a card) |
| `position` | `top` \| `right` \| `bottom` \| `left` | `bottom` | ✅ | ✅ | Side of the trigger the panel appears on |
| `alignment` | `start` \| `center` \| `end` | `start` | ✅ | ✅ | Alignment along the cross axis. For `top`/`bottom`: left / centered / right. For `left`/`right`: top / centered / bottom |
| `openAtCursor` | boolean | `false` | ✅ | — | Click and right-click modes. Anchors the panel at the pointer instead of the trigger box; `position` / `alignment` / offsets then apply around that point (`bottom` + `start` = top-left corner at the cursor). In right-click mode, right-clicking again moves the open menu to the new point |
| `offsetX` | length (`px` \| `%`) | `0px` | ✅ | — | Horizontal gap from the trigger |
| `offsetY` | length (`px` \| `%`) | `0px` | ✅ | — | Vertical gap from the trigger |
| `keepInViewport` | boolean | `true` | ✅ | — | When the panel would overflow the screen, flips it to the opposite side if there is more room there, then shifts it to stay 8 px inside the edges. Once the trigger (or cursor point) scrolls out of view, the panel scrolls away with it |
| `dropdownZIndex` | number `0`–`100` | `unset` | ✅ | ✅ | Stacking order of the teleported panel |
| `disabled` | boolean | `false` | ✅ | — | Blocks every trigger mode |
| `animated` | boolean | `false` | ✅ | — | Enables the slide + scale transition |
| `closeOnEscape` | boolean | `true` | ✅ | — | Pressing <kbd>Esc</kbd> closes the dropdown. Every open dropdown listens, so nested ones all close together |
| `closeOnContentClick` | boolean | `false` | ✅ | — | Any click inside the panel closes it, after the clicked element's own workflow has started — menu items no longer need a close action. Clicks on a nested dropdown's trigger are ignored. No effect while editing on the canvas |
| `forceDisplayEditor` | boolean | `false` | — | — | Keeps the panel open on the editor canvas so you can style it. No effect in production |

`offsetX` / `offsetY` have no configured default; when unset they are treated as `0px`.

## Slots

| Slot | Description |
| --- | --- |
| `triggerLayout` | The element(s) that open the dropdown |
| `dropdownLayout` | The panel content, rendered only while open |

## Actions

| Action | Description |
| --- | --- |
| `Close dropdown` (`closeDropdown`) | Closes the dropdown from a workflow |

There is no matching "open" action — the dropdown can only be opened by user interaction.

## Local context

Available in the formula editor under `context.local.data['dropdown']`:

```js
context.local.data?.['dropdown']?.['isOpen']              // boolean
context.local.data?.['dropdown']?.['trigger']?.['type']   // 'click' | 'hover' | 'right-click'
context.local.data?.['dropdown']?.['trigger']?.['disabled']
context.local.data?.['dropdown']?.['position']?.['placement']
context.local.data?.['dropdown']?.['position']?.['alignment']
context.local.data?.['dropdown']?.['position']?.['offsetX']
context.local.data?.['dropdown']?.['position']?.['offsetY']
context.local.data?.['dropdown']?.['state']?.['isDisplayed'] // includes editor force-display
context.local.data?.['dropdown']?.['state']?.['isAnimated']
```

## Behaviour notes

- **Breakpoint fallback.** On any non-`default` screen size, a plain click opens the dropdown
  whatever `triggerType` is set to, and hover is disabled. This makes `hover` and `right-click`
  usable on touch devices. In `right-click` mode, turn off `smallScreenClickFallback` to keep
  plain clicks for the trigger's own workflow — the menu then opens only on `contextmenu`
  (long-press on Android; iOS Safari fires none).
- **Native context menu.** The trigger calls `preventDefault()` on `contextmenu` in every trigger
  mode, so right-clicking the trigger never shows the browser menu — even when `triggerType` is
  `click` or `hover`.
- **Hover close delay.** Leaving the trigger or the panel in `hover` mode closes after 200 ms, so
  you can move the pointer across the gap between them.
- **Unmount delay.** The teleported node is removed 250 ms after closing to let the leave
  transition finish.
- **Nesting.** Each instance registers its id with its ancestors, and the outside-click handler
  ignores clicks inside any registered trigger or panel — so child dropdowns don't collapse their
  parents.
- **Editor.** `hover` never opens on the canvas; `click` does. Use `forceDisplayEditor` to keep
  the panel pinned open while styling it.

## Limitations

- **Viewport fitting is flip + shift only.** With `keepInViewport` the panel flips to the
  opposite side and shifts along both axes, but never resizes: a panel taller than the viewport
  still overflows. The flip is not reflected in `position.placement` in local context.
- **No trigger events.** The component emits no `open` / `close` events; watch
  `context.local.data['dropdown']['isOpen']` instead.
- **Fixed animation.** Duration (0.2 s) and easing are not configurable.
- **No ARIA or focus management.** The trigger is a plain `div` with no role or `aria-expanded`,
  and the panel is not focus-managed; only <kbd>Esc</kbd> is handled. Add your own semantics
  inside the slots if you need an accessible menu.

## Project structure

| File | Purpose |
| --- | --- |
| `src/wwElement.vue` | The component: trigger, teleported panel, positioning, local context |
| `ww-config.js` | Editor properties, dropzones, and the `closeDropdown` action |
| `AI.json` | Machine-readable description used by WeWeb's AI tooling; must mirror `ww-config.js` |
| `package.json` | `@weweb/cli` plus the `build` / `serve` scripts |
