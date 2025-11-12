# VOIX Kanban Board

VOIX Kanban is a single-page demo workspace that showcases how a Vue 3 UI can expose its state to VOIX tools. It mixes a polished kanban experience (drag & drop, filtering, time logging) with live “context” blocks and a declarative `<tool>` belt so AI agents can reason about and manipulate the board exactly as a human would. This project exists as a demo app for the [VOIX framework](https://svenschultze.github.io/VOIX/), illustrating how a traditional UI can surface board, profile, and interaction state to multimodal assistants.

## Features

- Responsive Vue 3 kanban board with To Do / In Progress / Done columns and a customizable column editor (add, rename, reorder, recolor, or remove columns).
- Task creation form with column picker, multi-select gestures (click, shift+click, cmd/ctrl+click), and drag-and-drop between columns (supports group drag based on selection).
- Rich task cards: open detail modal, edit title/description inline, log time, add comments, assign/unassign teammates, duplicate/delete via custom context menu.
- Board-level filters: global search (title, description, comments), assignee dropdown, “only my tasks” toggle, and reset button—filters also cascade to all exported VOIX contexts.
- Profile side panel that surfaces personal stats, lets you edit the signed-in user, and echoes applied filters and roster data.
- Persistent state using `localStorage` (`voix-kanban-state`) so columns, tasks, and profile edits survive refreshes.
- `<context>` exports for columns, assignments, profile, and interaction state, plus an inline `<tool>` belt (inside `index.html`) that registers create/update/move/delete/time/comment/filter/profile/column operations for VOIX automation.

## Tech Stack

- Vue 3 (ESM build loaded from CDN) for state management and component templating.
- Vanilla JavaScript modules (`js/` folder) with Composition API.
- HTML5 drag-and-drop plus custom keyboard/mouse handlers.
- SCSS-like styling written in plain CSS (`styles.css`), optimized for modern browsers.
- Browser `localStorage` for persistence; no build tooling or bundler required.

## Project Structure

```
├── index.html          # Root markup + Vue app mount + context/tool placeholders
├── styles.css          # Global styles, layout, modal/panel styles
└── js
    ├── app.js          # Main Vue app: state, filters, drag/drop, persistence
    ├── data.js         # Default columns, teammates, starter tasks
    ├── helpers.js      # Small utilities (cloning, IDs, time formatting)
    └── components
        ├── task-modal.js      # Task detail editor/logging modal
        └── profile-panel.js   # Profile side panel & stats
```

## Getting Started

1. Serve the folder with any static web server (direct `file://` won’t load ES module imports):
   - `npx serve`
   - `python3 -m http.server 4173`
   - or your favorite static host.
2. Visit the served URL (e.g., http://localhost:4173). The board seeds itself from `js/data.js` or from whatever is already stored in `localStorage`.

> Tip: Delete the `voix-kanban-state` key in DevTools → Application → Local Storage if you want to reset to the default dataset.

## Usage Guide

- **Creating tasks:** Use the “Quick add task…” form; select a target column before submitting. Tasks appear at the top of their column and become the active selection.
- **Drag & drop:** Grab a card to move it. If multiple tasks are selected, they move together. Drop zones highlight the target column.
- **Selections & context menu:** Click to select, shift+click for range, cmd/ctrl+click to toggle. Right-click opens a context menu with open/duplicate/move/assign/delete shortcuts.
- **Task modal:** Click the ↗ icon or use the context menu to open details, edit text, log time, add comments, reassign, or delete the task.
- **Filters:** Search across titles/descriptions/comments, filter by assignee (including unassigned), or show only the signed-in user’s tasks. Active filters are summarized under the board controls and mirrored in VOIX contexts.
- **Profile panel:** “View profile” opens a stats dashboard plus editable profile form. Saving updates the header card and the exported profile context.
- **Column customization:** Use “Customize columns” to reorder via drag handles, rename, recolor, delete, or add new columns. Removing a column migrates its tasks to the first remaining column.

## Local Storage & Persistence

- Board state lives under the `voix-kanban-state` key and includes `tasks` and `columns`.
- Any change (tasks, filters, profile edits) triggers persistence watchers.
- To start fresh, clear the key or run the app in a private window.

## Development Notes

- The app intentionally avoids a build step; all Vue APIs come from `https://unpkg.com/vue@3/dist/vue.esm-browser.js`.
- The inline `<tool>` belt in `index.html` registers VOIX endpoints; each `<tool>` dispatches `call` events that the root Vue app handles (`createTask`, `moveTask`, etc.). Tools that return data (e.g., `get_board_state`, `add_column`) emit a `CustomEvent("return", { detail })`.
- Context blocks (`<context name="kanban_columns">`, etc.) are populated via helper functions in `app.js`, so downstream VOIX clients can stay in sync with columns, assignments, profile info, and interaction events.
- `helpers.js` hosts cloning/ID/time utilities; `data.js` centralizes anything a contributor might tweak (column presets, teammates, starter tasks).
- Because everything runs in-browser, testing is manual. You can add lightweight unit checks by importing Vue’s reactivity helpers into a test harness or by slicing logic into pure utility modules.

---

Feel free to adjust wording, add screenshots, or append a license/contribution section based on how you plan to distribute the project. Next steps you might consider:

1. Create `README.md` with this content and commit it.
2. Capture screenshots/GIFs of the board for the README.
3. Add instructions for deploying on GitHub Pages or Netlify if you plan to host it.
