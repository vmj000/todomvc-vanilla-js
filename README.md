# Vanilla TodoMVC

A tabular TodoMVC in plain HTML, CSS, and JavaScript, with optional task locations. No framework, build step, backend, or runtime dependencies. Playwright is a development-only dependency.

Live app: **https://vmj000.github.io/todomvc-vanilla-js/**. See [deployment instructions](docs/deployment.md) for GitHub Pages setup and verification.
The live app tracks `main`; feature-branch changes are not deployed before merge.

## Run

Use Node.js 22 or newer. Running the app does not require installing packages.

```sh
npm start
```

Open **http://127.0.0.1:3000**. Stop with Ctrl+C. To use another port, run `PORT=3001 npm start`.
`npm run dev` is an alias for the same local-only static server. Any static HTTP server can serve this folder; opening `index.html` with `file://` will not load JavaScript modules reliably.

## Use

- Use the table's Completion, Task, Location, and Actions columns to manage todos.
- Type a task, optionally add a free-text location, and press Enter or select Add todo. Both fields are trimmed; whitespace-only tasks are ignored. Location needs no map, account, or geolocation permission.
- Check an item to complete it. The top chevron toggles **all** items, including those outside the current filter.
- Double-click a task or activate its edit button to edit task and location together. Enter or Save commits both fields; Escape or Cancel restores both. Moving between that row's fields and buttons keeps editing; leaving the row saves. An empty task deletes the item, while an empty location only clears its location.
- Use the delete button to remove an item or Clear completed to remove every completed item.
- All, Active, and Completed use hash URLs and support Back/Forward.
- All controls work with the keyboard. Row actions appear on hover, keyboard focus, and touch-sized screens.
- On narrow screens, the table scrolls horizontally inside its labeled, keyboard-focusable region without making the page overflow. Long tasks and locations wrap inside their cells.

Todos stay in this browser, on this origin, under `vanilla-todomvc:v1` in `localStorage`. They are never sent to a service. Private browsing, clearing site data, changing the port/origin, or using another device may give you a separate or empty list. If browser storage fails, the app keeps working in memory and displays a warning. Malformed saved data is ignored; the next change writes a fresh valid list. There is no cross-tab conflict resolution.

The optional `location` field is additive within the existing version1 payload and storage key. Legacy todos without it load with an empty location, preserving IDs, order, tasks, and completion without rewriting storage on load. A supplied location must be a string; loaded text is trimmed and rendered literally, never as HTML.

## Validate

```sh
npm test
npm run check
```

Tests use Node's built-in runner and cover state transitions, routes, editing lifecycle, filtered bulk actions, storage validation/failure, and literal title preservation.

### Reproducible browser tests

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:e2e
```

On a Linux machine that needs browser system libraries, use `npx playwright install --with-deps chromium firefox webkit` instead. No global Playwright or Factory tooling is required. The lockfile pins the test tooling; the application stays dependency-free.

The suite runs against Playwright's Chromium, Firefox, and WebKit with a fresh browser context and isolated storage for every test. It starts and stops the existing server on **http://127.0.0.1:4173**. Keep that port free; the suite deliberately refuses to reuse an existing server.

Coverage includes trimmed/blank creation, Enter/blur/Escape editing and empty-title deletion, completion, global counts, filters and filtered bulk actions, clearing/deleting, reload persistence, hash Back/Forward, literal HTML-like titles, native browser keyboard input and focus recovery, and long-title/control bounds at 320px and 1280px. Storage tests simulate malformed saved data, blocked storage, and quota failures with recovery. Every test rejects uncaught browser errors, console errors, failed HTTP requests, and unexpected dialogs.

These are browser-engine tests, not branded Chrome/Firefox/Safari builds or real mobile-device tests. The 320px checks exercise responsive CSS, not a physical touchscreen.
On macOS only, the sequential Tab-navigation case is skipped in WebKit because it depends on host Full Keyboard Access settings. The other WebKit tests still cover Enter/Escape, editing focus, and keyboard-triggered focus recovery. Linux CI runs the Tab-navigation case in all three engines.

Useful commands:

```sh
npm run test:e2e -- --project=chromium
npm run test:e2e:ui
npx playwright show-report
```

Failures retain an HTML report in `playwright-report/` and traces, screenshots, and videos in `test-results/`. To inspect a trace, run `npx playwright show-trace <path-to-trace.zip>`. Generated reports are ignored by Git.

The [E2E workflow](.github/workflows/e2e.yml) runs on pushes and pull requests to `main`, or manually. It uses Node.js 24, `npm ci`, the logic tests and syntax checks, and all three browser engines on Ubuntu. Failed runs upload reports and browser artifacts for 14 days. It needs only read access to repository contents and does not deploy the app.

If Factory's `agent-browser` CLI and its Chromium browser are available, run `npm run test:browser` for DOM, routing/history, persistence, storage-failure, literal rendering, focus management, and 1280px/320px layout regression checks. It starts and stops its own server on a temporary loopback port and uses the embedded browser when configured; otherwise it opens and closes a named headless session. Responsive checks use same-origin iframe viewports because Factory controls the embedded pane's size. The embedded browser tab is left open, but the temporary server is stopped. The suite uses DOM events, including synthetic Enter/Escape, rather than claiming native OS keyboard coverage. No application dependencies are installed.

For a browser smoke test, start the server and:

1. Add three items, complete one, and verify the count and all three filters.
2. Under Active, toggle all. Verify the empty filtered state, then use Completed to inspect all items.
3. Create and edit locations, including leaving one blank. Move between task and location editors, then check Enter, Save, Cancel, Escape, leaving the row, and empty-task deletion.
4. Reload and navigate Back/Forward. Verify titles, order, completion, and selected filter.
5. Enter `<img src=x onerror=alert(1)>` as both task and location. Verify it appears as literal text, not an image.
6. Use only Tab, Shift+Tab, Enter, Space, and Escape. Check focus after deletion and editing.
7. Check desktop and 320px-wide layouts, including long tasks/locations, for cell wrapping and contained table scrolling without page overflow.

## Structure

- `js/model.js`: pure immutable todo operations and selectors.
- `js/controller.js`: mutations, editing lifecycle, filter state, and save/render coordination.
- `js/storage.js`: versioned, validated local storage with failure recovery.
- `js/view.js`: keyed DOM updates, accessible labels, and focus management. Titles use `textContent`, never HTML.
- `js/app.js`: browser event wiring.
- `scripts/serve.js`: dependency-free development server, bound to loopback only.

Current Chrome, Firefox, and Safari are the browser targets. No account, synchronization, or due dates are included.
