# Vanilla TodoMVC

A classic TodoMVC in plain HTML, CSS, and JavaScript. No framework, build step, backend, or dependencies.

## Run

Use Node.js 22 or newer. There is nothing to install.

```sh
npm start
```

Open **http://127.0.0.1:3000**. Stop with Ctrl+C. To use another port, run `PORT=3001 npm start`.
`npm run dev` is an alias for the same local-only static server. Any static HTTP server can serve this folder; opening `index.html` with `file://` will not load JavaScript modules reliably.

## Use

- Type a todo and press Enter. Whitespace-only titles are ignored.
- Check an item to complete it. The top chevron toggles **all** items, including those outside the current filter.
- Double-click a title or activate its edit button to edit. Enter or leaving the field saves; Escape cancels. Saving an empty title deletes the item.
- Use the delete button to remove an item or Clear completed to remove every completed item.
- All, Active, and Completed use hash URLs and support Back/Forward.
- All controls work with the keyboard. Row actions appear on hover, keyboard focus, and touch-sized screens.

Todos stay in this browser, on this origin, under `vanilla-todomvc:v1` in `localStorage`. They are never sent to a service. Private browsing, clearing site data, changing the port/origin, or using another device may give you a separate or empty list. If browser storage fails, the app keeps working in memory and displays a warning. Malformed saved data is ignored; the next change writes a fresh valid list. There is no cross-tab conflict resolution.

## Validate

```sh
npm test
npm run check
```

Tests use Node's built-in runner and cover state transitions, routes, editing lifecycle, filtered bulk actions, storage validation/failure, and literal title preservation.

If Factory's `agent-browser` CLI and its Chromium browser are available, run `npm run test:browser` for DOM, routing/history, persistence, storage-failure, literal rendering, focus management, and 1280px/320px layout regression checks. It starts and stops its own server on a temporary loopback port and uses the embedded browser when configured; otherwise it opens and closes a named headless session. Responsive checks use same-origin iframe viewports because Factory controls the embedded pane's size. The embedded browser tab is left open, but the temporary server is stopped. The suite uses DOM events, including synthetic Enter/Escape, rather than claiming native OS keyboard coverage. No application dependencies are installed.

For a browser smoke test, start the server and:

1. Add three items, complete one, and verify the count and all three filters.
2. Under Active, toggle all. Verify the empty filtered state, then use Completed to inspect all items.
3. Edit using the mouse and keyboard. Check Enter, blur, Escape, and empty-title deletion, including clicking another row action while editing.
4. Reload and navigate Back/Forward. Verify titles, order, completion, and selected filter.
5. Enter `<img src=x onerror=alert(1)>`. Verify it appears as literal text, not an image.
6. Use only Tab, Shift+Tab, Enter, Space, and Escape. Check focus after deletion and editing.
7. Check desktop and 320px-wide layouts, including long titles, for wrapping and no horizontal overflow.

## Structure

- `js/model.js`: pure immutable todo operations and selectors.
- `js/controller.js`: mutations, editing lifecycle, filter state, and save/render coordination.
- `js/storage.js`: versioned, validated local storage with failure recovery.
- `js/view.js`: keyed DOM updates, accessible labels, and focus management. Titles use `textContent`, never HTML.
- `js/app.js`: browser event wiring.
- `scripts/serve.js`: dependency-free development server, bound to loopback only.

Current Chrome, Firefox, and Safari are the browser targets. No account, synchronization, due dates, or deployment is included.
