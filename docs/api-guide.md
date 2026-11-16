# TodoMVC technical reference

This site is generated from JSDoc comments in `js/`. Module pages describe
parameters, return values, data shapes, and behavior, with links to the source.
Update those comments with API changes, then run `npm run test:docs`.
Do not edit or commit the generated `docs/api/` directory.

## Architecture and data flow

1. [app](module-app.html) loads storage, creates the view and controller, wires
   browser events, and requests the first render.
2. [controller](module-controller.html) owns todos, the active filter, edit
   drafts, and storage errors. It delegates mutations to the model, saves changed
   collections, and sends state snapshots to the view.
3. [model](module-model.html) provides immutable todo updates and selectors.
   Bulk actions operate on the whole collection, not just visible rows.
4. [storage](module-storage.html) validates versioned local storage and returns
   warnings rather than throwing for browser storage failures.
5. [view](module-view.html) reconciles keyed table rows, renders text literally,
   and restores focus after edits, removals, and filtering.

The model and controller can run without a DOM. Storage and view dependencies
are injected, so logic tests do not need a browser. `app` is the browser-only
entry point; importing it immediately accesses the document and local storage.

## Controller example

The following uses the same entry points as the browser app. It can also run in
Node.js from the repository root with module input enabled:

```js
import { createController } from './js/controller.js';

const controller = createController({
  createId: () => 'example-1',
  save: () => '', // Return a warning string on failure.
  render: state => console.log(state.todos),
});

controller.add('Buy milk', 'Corner shop');
controller.startEdit('example-1');
controller.setLocationDraft('example-1', 'Supermarket');
controller.finishEdit('example-1');
controller.dispatch({ type: 'toggle', id: 'example-1' });
```

Snapshots expose current references, not defensive copies. Treat them as
read-only and change state through controller methods. Creating a controller
does not render; call `render()` for an initial empty view.

## Persistence contract

The key is `vanilla-todomvc:v1`; the JSON payload is
`{ "version": 1, "todos": [...] }`. Todos have string `id`, nonblank string
`title`, boolean `completed`, and optional string `location` fields. Loading
trims text and gives legacy todos an empty location without writing storage.
Invalid payloads are rejected as a whole, including duplicate IDs.

A failed save retains in-memory state. The controller retries persistence on
the next actual mutation and clears the warning after a successful save.
There is no backend, synchronization, or cross-tab conflict resolution.
