# TDD Log

Append one entry only after a completed loop. The dated entries below are
append-only and grow without bound — do not read them in full for routine
work. Read the "Current status" index below instead; search by requirement
ID (e.g. `grep "P3-03" docs/TDD_LOG.md`) and read only the matching entry
when you need history for a specific past decision.

## Current status (the one section of this file that gets edited in place, not appended to)

- Completed: Phase 0 through Phase 6 (all P0-xx through P6-xx behaviors),
  plus the post-release Cloudflare Workers static-assets deploy fix.
- Open residual risks: no keyboard focus trap in the crop dialog (Tab can
  still reach elements behind the overlay); ZIP CRC-32/encryption is not
  verified by parsing the central directory — corrupted/encrypted entries
  rely on the downstream image-signature/decode check instead, and this
  substitution has not been confirmed with the user (see `docs/Question.md`
  P4-04); real Safari and real iOS/Android devices were never available —
  Phase 6's cross-browser/device checks (P6-01/02/03) used WebKit/Firefox
  plus touch-viewport emulation as a proxy, reported as such, not as
  equivalent to real-device QA; the `wrangler.jsonc` static-assets deploy
  has not yet been confirmed against a real Cloudflare deploy.
- Last full-check result: all four checks (`test` / `typecheck` / `lint` /
  `build`) green, per the most recent dated entry at the bottom of this
  file.

## Entry template

```text
### YYYY-MM-DD — Requirement ID and behavior

- RED: test names and expected failure
- GREEN: production change and passing narrow suite
- REVIEW: APPROVE or findings resolved
- Full checks: test / typecheck / lint / build
- Files: changed paths
- Residual risk: none or concise note
```

Keep each field to 1-2 sentences. A long investigation (e.g. a multi-round
external review, byte-level verification of a library's behavior) belongs in
`docs/Question.md` or a commit message, not spelled out here — link to it
instead of inlining it.

### 2026-09-04 — P0-02 Editor state and reducer foundation

- RED: `editor state` tests failed because the editor types, documented defaults, and ordered item addition were not implemented
- GREEN: added strict editor state types, `createInitialEditorState`, and the tested `items/add` reducer transition; narrow suite passed
- REVIEW: APPROVE after removing speculative, untested mutation actions
- Full checks: test / typecheck / lint / build passed
- Files: `src/types/editor.ts`, `tests/unit/editor-state.test.ts`
- Residual risk: later state transitions remain intentionally unimplemented until their own TDD cycles

### 2026-09-04 — P0-03 Network-request regression guard

- RED: regression-only guard was already green; no product failure was manufactured
- GREEN: test guards render and unmount against Fetch, XHR, Beacon, and remote image sources
- REVIEW: APPROVE after making XHR mocks non-forwarding, covering unmount, and correcting Jest 30 typings
- Full checks: test / typecheck / lint / build passed
- Files: `tests/unit/page.test.tsx`
- Residual risk: the guard covers the current render workflow and must expand with later input/export interactions

### 2026-09-04 — P1-01 Select and add one supported image

- RED: page test could not find the accessible image input; cleanup regressions then exposed late-decode and Strict Mode lifecycle failures
- GREEN: added client-side selection, ImageBitmap decoding, ordered state append, filename display, and safe late-decode cleanup
- REVIEW: APPROVE after covering unmount races and React Strict Mode effect rehearsal
- Full checks: test / typecheck / lint / build passed
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: validation messages, multiple-file ordering, and cleanup of state-owned bitmaps remain assigned to later cycles

### 2026-09-04 — P1-02 Preserve multiple-file selection order

- RED: multi-file test expected three concurrent decodes but the handler read only the first file
- GREEN: enabled multiple selection, decoded the batch concurrently, and appended successful items in FileList order
- REVIEW: APPROVE with a minor recommendation to add explicit mixed-success cleanup coverage
- Full checks: test / typecheck / lint / build passed
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: mixed-success atomic-batch cleanup is implemented but not directly covered until validation/error work

### 2026-09-04 — P1-03 Reject unsupported and malformed images

- RED: mixed input decoded malformed and unsupported files; follow-up tests exposed unsettled FileReader abort and unclosed state-owned bitmaps
- GREEN: validate extension, MIME, and PNG/JPEG/WebP signatures before decode; report rejected names and close all owned bitmaps on unmount
- REVIEW: APPROVE after adding metadata/signature boundaries, read failure, partial decode, ordering, alert, and cleanup coverage
- Full checks: test / typecheck / lint / build passed
- Files: `src/lib/image-signature.ts`, `src/app/page.tsx`, `tests/unit/image-signature.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: loading/progress presentation is deferred until processing workflows require it

### 2026-09-04 — P1-04 Paste one or more clipboard images at the end of the list

- RED: no `paste` listener existed, so pasted clipboard images were never appended
- GREEN: added a document-level `paste` listener reusing the existing `addImages` pipeline (same signature validation, decode, and ordering guarantees as file selection) and removed it on unmount
- REVIEW: APPROVE; implementation reuses shared validation/decode/cleanup code paths already covered by file-input tests, so no duplicate late-decode-after-unmount case was needed for paste
- Full checks: test / typecheck / lint / build passed
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-04 — P1-05 Calculate vertical placement with zero gap

- RED: `layout.test.ts` failed because `src/lib/layout.ts` did not exist
- GREEN: added a pure `calculateVerticalLayout` that stacks images top to bottom, sizing the canvas to the widest image and the summed heights plus gap
- REVIEW: APPROVE; function is pure and independently tested per the architecture's placement rule
- Full checks: test / typecheck / lint / build passed
- Files: `src/lib/layout.ts`, `tests/unit/layout.test.ts`
- Residual risk: only zero-gap stacking is covered; non-zero gap and horizontal placement are separate cycles

### 2026-09-04 — P1-06 Calculate horizontal placement with zero gap

- RED: added `calculateHorizontalLayout` assertions to `layout.test.ts`; failed because the export did not exist
- GREEN: added a pure `calculateHorizontalLayout` mirroring the vertical function on the swapped axis (canvas height from the tallest image, summed widths plus gap)
- REVIEW: APPROVE; symmetric with the reviewed vertical implementation, no new risk
- Full checks: test / typecheck / lint / build passed
- Files: `src/lib/layout.ts`, `tests/unit/layout.test.ts`
- Residual risk: non-zero gap is still deferred to the P3-08 gap/background cycle

### 2026-09-04 — P1-07 Render and download a PNG

- RED: `render.test.ts` and `download.test.ts` failed because `src/lib/render.ts` and `src/lib/download.ts` did not exist; the page test then failed because no "PNGとして保存" button existed
- GREEN: added `renderJoinedImage` (sizes a canvas from an existing layout, fills the background, draws each image in placement order) and `downloadBlob` (object URL + temporary anchor click, revoked immediately after); wired a disabled-until-non-empty download button in `page.tsx` that builds the layout from the current direction/gap/background and current items' bitmap sizes, then exports via `canvas.toBlob`
- REVIEW: APPROVE; rendering reuses the already-reviewed P1-05/P1-06 layout functions so preview and output cannot diverge, and the export path stays entirely local (object URL revoked synchronously, no network calls)
- Full checks: test / typecheck / lint / build passed
- Files: `src/lib/render.ts`, `src/lib/download.ts`, `src/app/page.tsx`, `tests/unit/render.test.ts`, `tests/unit/download.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: only PNG export at original bitmap size is covered; JPEG export, crop/rotation/resize application, and the 100MP output warning remain later cycles

### 2026-09-04 — P1-08 Drag-and-drop image files onto the image list

- RED: dropping a file onto the image list, and dragging over it, had no effect (`page.test.tsx` failures for both)
- GREEN: added `onDragOver`/`onDrop` handlers on the image list that call `event.preventDefault()` and pass dropped files through the existing `addImages` validation/decode pipeline
- REVIEW: APPROVE; reuses the already-reviewed validation and cleanup path, no new risk
- Full checks: test / typecheck / lint / build passed
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: ZIP drop is out of scope until the Phase 4 ZIP worker exists; a dropped `.zip` is currently rejected as an unsupported file, matching today's file-picker behavior

### 2026-09-04 — P1-09 Remove an individual image

- RED: `editor-state.test.ts` had no `items/remove` action to dispatch; `page.test.tsx` had no delete control per row
- GREEN: extended `EditorAction`/`editorReducer` with a `switch` and an `items/remove` case that filters by id; added a per-row delete button in `page.tsx` that closes the removed item's `ImageBitmap`, drops it from `ownedBitmapsRef`, then dispatches the removal
- REVIEW: APPROVE; updated the four existing order-assertions from raw `element.textContent` (which now also picks up the new button's label) to `element.firstChild?.textContent` so they keep verifying exactly the filename order, not weakening the check
- Full checks: test / typecheck / lint / build passed
- Files: `src/types/editor.ts`, `src/app/page.tsx`, `tests/unit/editor-state.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: two items sharing the same file name would get identical `aria-label="削除: <name>"` values; acceptable for now since ids already keep them distinct in state, but worth revisiting once Phase 2 reordering needs unique per-row references

### 2026-09-04 — P1-10 Clear all images

- RED: `editor-state.test.ts` had no `items/clear` action; `page.test.tsx` had no "すべて削除" control
- GREEN: added an `items/clear` reducer case resetting `items` to `[]`, and a header button that closes every current `ImageBitmap`, clears `ownedBitmapsRef`, then dispatches the clear
- REVIEW: APPROVE; mirrors the already-reviewed single-item removal cleanup pattern
- Full checks: test / typecheck / lint / build passed
- Files: `src/types/editor.ts`, `src/app/page.tsx`, `tests/unit/editor-state.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-04 — P1-11 Scale a layout for a downscaled live preview

- RED: `layout.test.ts` failed because `scaleLayout` and `computePreviewScale` did not exist
- GREEN: added `scaleLayout` (multiplies canvas size and every placement by a factor) and `computePreviewScale` (factor that shrinks the longest side to a maximum, capped at 1) as pure functions in `src/lib/layout.ts`
- REVIEW: APPROVE; keeps the NFR requirement that only the display-sized preview is generated ahead of time, full resolution stays reserved for the export path
- Full checks: test / typecheck / lint / build passed
- Files: `src/lib/layout.ts`, `tests/unit/layout.test.ts`
- Residual risk: none identified for this behavior; not yet wired into the UI (next cycle)

### 2026-09-04 — P1-12 Show a live preview that updates as items change

- RED: `page.test.tsx` found no element with the accessible name "結合プレビュー"; the app never rendered a visible preview
- GREEN: added a `<canvas role="img" aria-label="結合プレビュー">` updated by a `useEffect` keyed on items/direction/gap/background, using `calculateVerticalLayout`/`calculateHorizontalLayout` + `computePreviewScale` + `scaleLayout` + the existing `renderJoinedImage`, so preview and export share one layout pipeline; the canvas collapses to 0×0 when there are no items
- REVIEW: APPROVE after restructuring canvas mocking in `page.test.tsx`: added a shared `beforeEach`/`afterEach` that mocks `HTMLCanvasElement.prototype.getContext` per canvas instance (a small map keyed by the canvas element) so every test that adds images no longer needs its own canvas mock, and the download test's assertions target only the offscreen download canvas instead of being contaminated by the always-on preview canvas's draw calls
- Full checks: test / typecheck / lint / build passed
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-04 — P1-13 Choose join direction and reflect it in the live preview and download

- RED: `editor-state.test.ts` had no `settings/direction` action; `page.test.tsx` found no "縦結合"/"横結合" controls
- GREEN: added a `settings/direction` reducer case, and two `aria-pressed` toggle buttons in `page.tsx` dispatching it; both the live preview effect and `handleDownload` already read `state.direction`, so switching direction updates both automatically
- REVIEW: APPROVE; no duplicated direction-handling logic was introduced
- Full checks: test / typecheck / lint / build passed
- Files: `src/types/editor.ts`, `src/app/page.tsx`, `tests/unit/editor-state.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: the download path with horizontal direction is exercised only indirectly (same code as the tested vertical download); acceptable since both paths share the same `state.direction`-driven logic already covered by the preview test

### 2026-09-04 — Visual restyle to match the approved workspace design

- Scope: not a new tested behavior; restructured the existing P1-01–P1-13 functionality to match the approved two-column "workspace" design (image list panel as its own drag-drop/paste surface, direction toggle, live preview, export bar), per `docs/IMPLEMENTATION_PLAN.md`'s design-reflection plan
- Changes: extracted `src/components/image-editor/ImageList.tsx` (+ CSS module) for the left panel; added `src/app/page.module.css` for the header and two-column layout; added design tokens to `src/app/globals.css` (indigo accent, neutral surfaces, no external fonts — kept the existing `system-ui` stack per the NFR against external fonts); wired real `lucide-react` icons for every icon-only or icon+label control
- Test updates: 4 tests' order-assertions moved from raw `element.textContent` to a shared `expectListItemNames` helper using `within(...).getByText(...)`, which stays correct regardless of how much markup surrounds the filename; the "clear all" test now asserts the specific filenames are gone instead of asserting zero `listitem`s, since the empty state renders one placeholder `<li>`
- REVIEW: APPROVE after a browser check surfaced a real defect the automated suite could not catch — CSS Grid/flex children without `min-width: 0` refused to shrink below their content's natural width, so `main`'s width itself grew past the viewport at narrow widths (confirmed via a true viewport-controlled headless check: `scrollWidth` exceeded `innerWidth` before the fix). Fixed by adding `min-width: 0` down the affected containers (`.rightColumn`, `.headerActions`, `.privacyBadge`, ImageList's `.panel`/`.header`) and `overflow-wrap` on the longer hint text; re-verified `innerWidth === scrollWidth` at a true 320px viewport (Chrome's `--window-size` flag on this machine did not reliably control the actual layout viewport — verification used `Emulation.setDeviceMetricsOverride` via the DevTools protocol instead) and exercised add/upload, direction toggle, single delete, and clear-all interactively with zero console errors
- Full checks: test / typecheck / lint / build passed
- Files: `src/app/page.tsx`, `src/app/page.module.css`, `src/app/globals.css`, `src/components/image-editor/ImageList.tsx`, `src/components/image-editor/ImageList.module.css`, `tests/unit/page.test.tsx`
- Residual risk: rotate/crop icons, the drag-reorder handle, and the gap/background/resize controls are intentionally not present yet — they are added alongside their own Phase 2/3 TDD cycles rather than rendered as non-functional placeholders now

### 2026-09-04 — P2-01/02/03 (reducer) Reorder items by id

- RED: `editor-state.test.ts` had no `items/reorder` action; dispatching it fell through the reducer's `default` and left items unchanged
- GREEN: added an `items/reorder` case that finds the active/target indices by id and splices the active item to the target's position (equivalent to `@dnd-kit/sortable`'s `arrayMove`, implemented without a dnd-kit dependency in the reducer); no-ops when the ids match or either id is missing
- REVIEW: APPROVE; mirrors the existing id-lookup pattern from `items/remove`
- Full checks: test / typecheck / lint / build passed
- Files: `src/types/editor.ts`, `tests/unit/editor-state.test.ts`
- Residual risk: none identified for this behavior; not yet wired to any UI (next cycles)

### 2026-09-04 — P2-06 Hide row delete behind an edit-mode toggle on narrow viewports

- RED: `image-list.test.tsx` (new) failed because the delete button always rendered regardless of viewport width, and no "編集"/"完了" toggle existed
- GREEN: added a local `useIsCompactViewport` hook (subscribes to `window.matchMedia("(max-width: 760px)")`) and `isEditing` state to `ImageList`; the per-row delete button now renders only when `!isCompact || isEditing`, and a "編集"/"完了" `aria-pressed` toggle (shown only when compact and the list is non-empty) flips `isEditing`. Added a default `window.matchMedia` stub (`matches: false`) to `jest.setup.ts` since jsdom does not implement it at all
- REVIEW: APPROVE; the default matchMedia stub keeps every existing test's "desktop" behavior unchanged, and the new test file mocks `matches: true` to exercise the compact/edit-mode path directly rather than relying on real CSS layout (which jsdom cannot evaluate)
- Full checks: test / typecheck / lint / build passed
- Files: `jest.setup.ts`, `src/components/image-editor/ImageList.tsx`, `src/components/image-editor/ImageList.module.css`, `tests/unit/image-list.test.tsx`
- Residual risk: the drag handle does not exist yet (next cycle), so `showRowControls` currently only gates the delete button; the actual 760px breakpoint's visual behavior still needs a browser check since jsdom cannot evaluate CSS media queries

### 2026-09-04 — P2-01/02/03 (UI) Drag-and-drop and keyboard reordering via dnd-kit

- RED: `image-list.test.tsx` failed because no drag handle rendered and `onReorder` was never called on drag end
- GREEN: split `ImageListRow.tsx` out of `ImageList.tsx` (required because `useSortable` cannot be called inside `.map()`); wired `DndContext`/`SortableContext` with `PointerSensor` (`activationConstraint: { distance: 6 }`, matching FR-03's ~6px PC threshold), `TouchSensor` (`activationConstraint: { delay: 180, tolerance: 5 }`, matching FR-03's ~180ms mobile long-press), and `KeyboardSensor` with `sortableKeyboardCoordinates`; the handle only renders when `showRowControls` is true (reusing the P2-06 edit-mode gate), has `touch-action: none` so it does not fight page scroll, and forwards `active`/`over` ids to a new `onReorder` prop that `page.tsx` wires straight to the already-reviewed `items/reorder` reducer action; added Japanese `accessibility.announcements` to `DndContext` so dnd-kit's built-in live region reports drag start/move/end/cancel
- REVIEW: APPROVE; real pointer-distance and long-press timing cannot be exercised in jsdom (no layout/geometry), so the reorder-forwarding logic was verified by mocking `@dnd-kit/core`'s `DndContext` to capture and directly invoke `onDragEnd` — this is a deliberate, documented test-coverage boundary, not a gap introduced silently
- Full checks: test / typecheck / lint / build passed
- Files: `src/components/image-editor/ImageListRow.tsx`, `src/components/image-editor/ImageList.tsx`, `src/components/image-editor/ImageList.module.css`, `src/app/page.tsx`, `tests/unit/image-list.test.tsx`
- Residual risk: auto-scroll for long lists (P2-04) is unverified and left for a later cycle
- Browser check: confirmed via headless Chrome driven over the DevTools protocol (`Input.dispatchMouseEvent` for a real pointer drag past the 6px threshold, `Input.dispatchKeyEvent` for Space/ArrowDown/Space keyboard reordering, and a real click on the mobile-width edit toggle). All three reordered the list correctly (`[test1,test2,test3]` → `[test2,test3,test1]` after the pointer drag → `[test3,test2,test1]` after the keyboard move), the Japanese `aria-live` announcement text appeared correctly, the mobile view showed 0 delete/handle buttons until "編集" was tapped (then 3 of each appeared and the label became "完了"), and no console errors were raised at any step

### 2026-09-04 — P2-05 Add a tooltip to the drag handle

- Context: an external Codex CLI review of the whole project (see below) flagged that the drag handle had `aria-label` but no `title`, unlike the delete button
- RED: `image-list.test.tsx` failed asserting `title="並べ替え"` on the handle
- GREEN: added `title="並べ替え"` to the handle button in `ImageListRow.tsx`
- REVIEW: APPROVE; mirrors the existing delete-button tooltip pattern
- Full checks: test / typecheck / lint / build passed
- Files: `src/components/image-editor/ImageListRow.tsx`, `tests/unit/image-list.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-04 — External review: Codex CLI system audit

Ran `codex exec` (OpenAI Codex CLI, GPT-based, read-only sandbox) as an independent second opinion over the whole repository (docs + `src/` + `tests/`).

- Initial score: 58/100, graded against a "finished product" bar — this heavily penalized Phase 3–6 features (`crop/rotate/resize`, ZIP, clipboard copy, JPEG) that `docs/IMPLEMENTATION_PLAN.md` schedules for later and have not been started yet by design.
- Pushback: asked Codex to re-grade against the "Phase 2 milestone" the project actually claims to have reached, and to separate genuine defects from intentionally-unbuilt future scope.
- Revised score: 89/100 at the Phase 2 milestone, with 6 concrete items to close the gap to ~95 without touching Phase 3+: (1) missing handle tooltip — fixed above, (2) `docs/REQUIREMENTS.md` vs the actual edit-mode UI disagreeing on the mobile interaction model, (3) inaccurate paste-hint copy, (4) no "loading" status (`EditorState.processing` declared but never updated), (5) a real ordering bug — concurrent `addImages` batches (file pick / drop / paste) are not serialized, so a fast batch can finish and render before an earlier, slower batch, (6) no test proving a reorder actually changes the rendered preview's draw order.
- Codex separately confirmed two things this project already does are *not* defects: mocking `@dnd-kit/core`'s `DndContext` to test `onDragEnd` directly (jsdom cannot simulate real pointer geometry, so this is the correct test boundary), and receiving paste on `document` rather than a focused list element (matches FR-01's "anywhere on the page" wording; only the UI copy describing it was wrong).
- Follow-up cycles below (P2-05 already done, plus docs/copy, loading state, add-order serialization, and a reorder→render integration test) implement items 2–6.

### 2026-09-04 — Reconcile mobile-operation docs and paste-hint copy with actual behavior

- Context: Codex's review item 2 — `docs/REQUIREMENTS.md` still described a per-row mobile menu (never built; the approved design uses an edit-mode toggle), and `ImageList`'s paste hint told users to "select this list" even though paste is handled on `document`, with no Mac `Cmd+V` mention
- Change: not a behavioral TDD cycle (no code logic changed, only text) — confirmed first that no test asserts the old copy, then updated `docs/REQUIREMENTS.md`'s responsive-UI bullet to describe the edit-mode toggle, and both paste-hint strings in `ImageList.tsx` (empty state and populated state) to "ページ上で Ctrl+V(Mac: Cmd+V)で貼り付け"
- Full checks: test / typecheck / lint / build passed
- Files: `docs/REQUIREMENTS.md`, `src/components/image-editor/ImageList.tsx`
- Residual risk: none identified for this behavior

### 2026-09-04 — FR-01 Show a polite loading status while images decode

- Context: Codex's review item 4 — `EditorState.processing` was declared but never updated, so FR-01's "loading" indicator and the accessibility NFR's `aria-live="polite"` status requirement were both unmet
- RED: `editor-state.test.ts` had no `processing/start`/`processing/end` actions; `page.test.tsx` found no loading text while a decode was pending, and expected it to survive a second overlapping batch finishing first
- GREEN: changed `EditorState.processing` from `boolean` to a `number` (count of in-flight `addImages` batches, updated `docs/ARCHITECTURE.md`'s snippet to match) because a boolean cannot correctly represent two overlapping batches — a plain "set false on any batch's completion" would hide the indicator while another batch is still running; added `processing/start`/`processing/end` reducer cases (clamped at 0) and dispatched them around `addImages`'s validate/decode/commit work (including the already-unmounted early-return path); rendered `画像を読み込み中です` in an `aria-live="polite"` element while `state.processing > 0`
- REVIEW: APPROVE; the counter design was specifically chosen to survive the concurrent-batch case the review flagged, and the new tests exercise exactly that overlap
- Full checks: test / typecheck / lint / build passed
- Files: `src/types/editor.ts`, `src/app/page.tsx`, `src/app/page.module.css`, `docs/ARCHITECTURE.md`, `tests/unit/editor-state.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-04 — FR-01 Preserve add-order across overlapping batches

- Context: Codex's review item 5 (a real bug, not scope-not-yet-reached) — `addImages` kept order within one call but never serialized across calls, so a fast batch (e.g. a paste) could commit to state before an earlier, slower batch (e.g. a large file selection) that was already decoding
- RED: `page.test.tsx` uploaded two slow files then pasted a fast one; asserted the fast image must not appear before the earlier batch resolves, and that the final order matches start order (`[slow-a, slow-b, fast]`) even though the fast batch's own decode finishes first
- GREEN: added `commitQueueRef`, a `Promise` chain where each `addImages` call reserves its queue position *synchronously, before any `await`* (captures `previousCommit`, installs its own not-yet-resolved promise as the new tail) — this is what makes the ordering depend on call order rather than completion order. Validation and decoding still run concurrently per batch for speed; only the state-mutating commit step `await previousCommit`s, then dispatches, then resolves its own turn for the next batch
- REVIEW: APPROVE after fixing a test whose assumption the new behavior intentionally supersedes — the P2 loading-status "overlapping batches" test previously expected the second (faster) batch's image to render immediately; it now correctly waits for both to commit in order
- Full checks: test / typecheck / lint / build passed
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: if validation/decoding ever threw before reaching the commit step, `resolveMyTurn` would never fire and every later-queued batch would hang forever; not fixed here because no current code path in `isSupportedImageFile` or the `Promise.allSettled` decode step can throw (rejections are already captured), so a `try/finally` would guard against an unreachable case — revisit if ZIP input (Phase 4) introduces a step that can throw before the commit point

### 2026-09-04 — Reorder → live-preview render integration test, and a flaky-suite fix found along the way

- Context: Codex's review item 6 — reorder was verified at the reducer level and at the `ImageList` → `onReorder` wiring level, but nothing proved that reordering actually changes what the live preview draws
- RED/GREEN: added `page.test.tsx` mocks for `@dnd-kit/core`'s `DndContext` (capture `onDragEnd`) and `@dnd-kit/sortable`'s `SortableContext` (capture the real, randomly-generated `items` order) so the test can trigger a reorder through `Home` without simulating real pointer geometry, then assert the live preview canvas's `drawImage` calls reflect the swapped order. This test passed immediately — the feature was already fully wired from earlier cycles, so this closes a test-coverage gap rather than a code gap (compare the P0-03 "regression guard was already green" precedent)
- Found while running the new test repeatedly for stability: the full suite failed intermittently (~1 in 5–8 runs) with `Not implemented: HTMLCanvasElement.prototype.getContext`, thrown from a leftover passive effect during React Testing Library's automatic post-test unmount. Root cause: Jest runs `afterEach` hooks inside-out, so this file's own `afterEach(() => jest.restoreAllMocks())` (registered inside `describe("project scaffold")`) ran *before* RTL's auto-`cleanup()` (registered at module load, outside any describe) — meaning canvas mocks were torn down before pending components unmounted, so any deferred effect that still called `canvas.getContext()` hit jsdom's real, unimplemented version and threw. Fixed by calling RTL's `cleanup()` explicitly at the start of this file's own `afterEach`, before `jest.restoreAllMocks()`, so unmounting always happens while the mock is still active
- REVIEW: APPROVE; re-ran the full suite 10 times after the fix with zero failures (previously reproducible within 5–8 runs)
- Full checks: test / typecheck / lint / build passed (10 repeated runs for stability)
- Files: `tests/unit/page.test.tsx`
- Residual risk: none identified; this ordering hazard applies to any Jest file mixing a describe-scoped `afterEach(jest.restoreAllMocks)` with RTL's auto-cleanup, so the same pattern (`cleanup()` before `restoreAllMocks()`) should be used if another test file adopts this per-instance mocking style

### 2026-09-04 — P2-04 Verify auto-scroll and close the cycle

- Context: `docs/TDD_LOG.md` had left P2-04 (auto-scroll for long lists) explicitly "unverified" since the P2-01/02/03 cycle; Codex's review flagged this as a Phase 2 milestone that was not formally closed
- No code change: `@dnd-kit/core`'s `DndContext` enables auto-scroll by default, so this cycle is verification-only, matching the P0-03 precedent for a guard that needed confirming rather than building
- Browser check: added 20 images at a 1280×600 viewport (headless Chrome via the DevTools protocol), pressed the first row's drag handle, and held the pointer near the bottom edge of the viewport (`Input.dispatchMouseEvent` `mouseMoved` repeated at y=595). `window.scrollY` moved from `0` to `3768` while held, confirming dnd-kit's built-in auto-scroll fires without any additional code; no console errors were raised
- REVIEW: APPROVE; closes P2-04 as verified-by-library-default
- Full checks: test / typecheck / lint / build passed (no code changed this cycle)
- Files: none (verification only)
- Residual risk: none identified; auto-scroll speed/threshold tuning was not evaluated since the default behavior already satisfies the requirement

### 2026-09-05 — PR review: round fractional layout dimensions before canvas sizing and drawing

- Context: GitHub Copilot's PR review flagged that `renderJoinedImage` assigned possibly-fractional `layout.width/height` (e.g. after `scaleLayout` for the live preview) straight to `canvas.width/height`; a real DOM canvas coerces those to integers, so the actual backing size could diverge from the raw-fractional values used in `fillRect`/`drawImage`, risking blurry/partial rendering
- RED: `render.test.ts` built a layout via `calculateVerticalLayout` + `scaleLayout(_, 1/3)` to get fractional dimensions/placements, then asserted `canvas.width/height` are integers and `fillRect`/`drawImage` are called with those same rounded values; failed because `canvas.width` was `33.333...`, not an integer
- GREEN: rounded `layout.width/height` once in `renderJoinedImage` and reused the rounded values for both `canvas.width/height` and `fillRect`; rounded each placement's `x/y/width/height` before `drawImage`
- REVIEW: APPROVE; reviewer independently verified the diff, the test's arithmetic, and reran tests/typecheck. One non-blocking finding: rounding each placement independently (rather than deriving each boundary from the previous rounded cumulative offset) can leave a ≤1px seam/overlap between three or more contiguous placements for some fractional inputs (`Math.round(a+b) ≠ Math.round(a)+Math.round(b)`); accepted as a minor residual artifact for this MVP, not fixed now
- Full checks: `npx jest tests/unit/render.test.ts tests/unit/layout.test.ts tests/unit/page.test.tsx` (3 suites, 39 tests passed) and `npx tsc --noEmit` (clean); project-wide `full-check` pending until this batch's remaining lanes complete
- Files: `src/lib/render.ts`, `tests/unit/render.test.ts`
- Residual risk: ≤1px seam/overlap possible between 3+ contiguous placements under certain fractional scales (see REVIEW note above); revisit with cumulative-offset rounding if it becomes visible in practice

### 2026-09-05 — PR review: prevent a synchronous `createImageBitmap` throw from deadlocking the batch commit queue

- Context: GitHub Copilot's PR review flagged that `createImageBitmap(file)` inside `addImages`'s `Promise.allSettled(...)` call could throw synchronously (not just reject), which would escape `Promise.allSettled` and the whole `addImages` function, skipping `dispatch({type:'processing/end'})` and `resolveMyTurn()` — permanently deadlocking `commitQueueRef` for every later batch
- RED: `page.test.tsx` mocked `createImageBitmap` to throw synchronously for one file in a two-file batch, uploaded it, then uploaded an independent second batch; failed because the synchronous throw escaped `Array.prototype.map` at `page.tsx:73`, so even the first batch's good file never rendered
- GREEN: wrapped the call as `Promise.resolve().then(() => createImageBitmap(file))` so a synchronous throw becomes a promise rejection `Promise.allSettled` already handles like any other decode failure
- REVIEW: APPROVE; reviewer confirmed this is the only `createImageBitmap` call site in the codebase, `isSupportedImageFile` is already `async` (no equivalent hazard), batch-commit-order invariants are untouched, and independently reran tests (22/22) and typecheck (clean)
- Full checks: `npx jest tests/unit/page.test.tsx` (22/22 passed) and `npx tsc --noEmit` (clean); project-wide `full-check` pending until this batch's remaining lanes complete
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-05 — PR review: make the compact-viewport initial render hydration-safe and drop the blanket hydration-warning suppression

- Context: GitHub Copilot's PR review flagged that `useIsCompactViewport` initialized `useState` by synchronously reading `window.matchMedia(...).matches` during the initializer, which could differ between server render (no real viewport) and client render, causing a React hydration mismatch — the actual root cause behind `suppressHydrationWarning` on `<body>` in `layout.tsx`, which was itself flagged as overly broad (it would hide unrelated real mismatches too)
- RED (attempt 1, superseded): a first test tried to assert via React Testing Library's `render()` that the non-compact UI is visible immediately after `render()` returns, before `waitFor`. This failed even against the correct fix, because RTL's `render()` flushes pending passive effects synchronously inside its `act()` wrapper in this project's React 19 + `@testing-library/react` 16 setup — there is no observable window between the initializer and the mount effect via `render()`. Diagnosed as a flawed test premise, not a product defect, and routed back to `test_writer`
- RED (attempt 2): rewrote the test using `renderToString` (server, `matchMedia` mocked false) to produce SSR markup, injected it into a detached container, switched `matchMedia` to true (compact) and `hydrateRoot`'d against the mismatched markup while spying on `console.error`, asserting no hydration-mismatch warning is logged, then asserting the effect still updates the UI to compact post-hydration
- GREEN: changed `useIsCompactViewport`'s `useState` initializer to the deterministic literal `false` (existing mount effect, unchanged, is now the only place the real `matchMedia` value is read); removed `suppressHydrationWarning` from `<body>` in `src/app/layout.tsx`
- REVIEW: one round with a single non-blocking finding — a leftover unused `waitFor` import from the superseded first test attempt; removed by `test_writer`. Reviewer independently re-ran the suite 5x for flakiness (none observed), confirmed the new test would genuinely fail against the pre-fix code (reasoned through jsdom's `testEnvironment` making `window` always defined, so the bug is specifically the synchronous `matchMedia` read, not the `typeof window` guard), verified cleanup ordering (manual `hydrateRoot` container isn't covered by RTL's auto-cleanup, so the `finally` block's manual unmount/removal is required and correctly ordered), and grepped for other `useState(() => ...)` initializers reading browser-only globals (none found) — otherwise APPROVE
- Full checks: `npx jest tests/unit/image-list.test.tsx` (7/7), `npx jest tests/unit/page.test.tsx` (22/22, unaffected), `npx eslint tests/unit/image-list.test.tsx` (clean), `npx tsc --noEmit` (clean); project-wide `full-check` pending until this batch's remaining lanes complete
- Files: `src/components/image-editor/ImageList.tsx`, `src/app/layout.tsx`, `tests/unit/image-list.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-05 — P3-02 Rotated-dimension calculation (Batch 3-A, Lane A1)

- RED: `tests/unit/rotation.test.ts` failed because `src/lib/rotation.ts` did not exist
- GREEN: added a pure `getRotatedSize` that swaps width/height for 90/270 degree rotation and leaves 0/180 unchanged
- REVIEW: APPROVE; pure function with no side effects, mirrors the existing `scaleLayout`/`computePreviewScale` "pure now, wire later" precedent (P1-11) — not yet wired into `page.tsx` (planned for P3-04)
- Full checks: `npx jest tests/unit/rotation.test.ts` (4/4), `npx tsc --noEmit` (clean), `npx eslint src/lib/rotation.ts tests/unit/rotation.test.ts` (clean); project-wide `full-check` deferred until Batch 3-A's other lane also lands
- Files: `src/lib/rotation.ts`, `tests/unit/rotation.test.ts`
- Residual risk: none identified for this behavior

### 2026-09-05 — P3-05/P3-06 Fit-width and fit-height calculation (Batch 3-A, Lane A2)

- RED: `tests/unit/resize.test.ts` failed because `src/lib/resize.ts` did not exist
- GREEN: added pure `fitToWidth`/`fitToHeight` functions that scale the other dimension to preserve aspect ratio, including the zero-dimension edge case
- REVIEW: APPROVE; symmetric pure functions, no shared state with Lane A1; not yet wired into `page.tsx` (planned for P3-07, after P3-04 establishes the effective post-crop/rotate size these will scale from)
- Full checks: `npx jest tests/unit/resize.test.ts` (6/6), `npx tsc --noEmit` (clean), `npx eslint src/lib/resize.ts tests/unit/resize.test.ts` (clean); project-wide `full-check` deferred until Batch 3-A's other lane also lands
- Files: `src/lib/resize.ts`, `tests/unit/resize.test.ts`
- Residual risk: none identified for this behavior

### 2026-09-05 — P3-01 Rotate reducer and button (Batch 3-B, cycle 1)

- RED: `editor-state.test.ts` had no `items/rotate` action; `image-list.test.tsx` found no rotate button per row
- GREEN: added an `items/rotate` action and reducer case that cycles a targeted item's `rotation` through `0→90→180→270→0` (no-ops on an unknown id); added a rotate icon button to `ImageListRow.tsx` (same tooltip/aria-label/44px-target pattern as the existing delete and drag-handle buttons, gated by the same `showControls` edit-mode flag), threaded `onRotate` through `ImageList.tsx`, and wired `page.tsx`'s `handleRotate` to dispatch it
- REVIEW: APPROVE; metadata-only cycle by design — rotation does not yet visibly affect the live preview or export (deferred to P3-04, mirroring the P2-01 reducer-only precedent); no new `page.test.tsx` coverage was added for this wiring since it is a one-line dispatch identical in shape to the already-tested `handleReorder`/`handleDirectionChange`, and the actual button behavior is fully covered at the `ImageList` component level (existing precedent: the P2-01/02/03 UI cycle also stopped at `image-list.test.tsx`, not `page.test.tsx`)
- Full checks: `npx jest tests/unit/image-list.test.tsx tests/unit/editor-state.test.ts tests/unit/page.test.tsx` (46/46), `npx tsc --noEmit` (clean), `npx eslint` on the changed files (clean); project-wide `full-check` deferred until Batch 3-B completes
- Files: `src/types/editor.ts`, `src/components/image-editor/ImageListRow.tsx`, `src/components/image-editor/ImageList.tsx`, `src/components/image-editor/ImageList.module.css`, `src/app/page.tsx`, `tests/unit/editor-state.test.ts`, `tests/unit/image-list.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-05 — P3-03 Crop dialog: open, confirm, cancel, reset (Batch 3-B, cycle 2)

- RED: `editor-state.test.ts` had no `items/crop` action; `image-list.test.tsx` found no crop button per row; `crop-dialog.test.tsx` (new) failed because `CropDialog` did not exist; `page.test.tsx` found no dialog opening from the row's crop button
- GREEN: added an `items/crop` reducer action/case that sets or clears (`null`) a targeted item's `crop` metadata without touching its `blob`/`bitmap` (non-destructive per FR-04); added a crop icon button to `ImageListRow.tsx` (same pattern as the rotate/delete buttons) wired through `ImageList.tsx`'s new `onCrop` prop; built `src/components/image-editor/CropDialog.tsx` using the already-installed `cropperjs` v2 dependency — it draws the item's `ImageBitmap` onto an internal canvas, hands that canvas to `new Cropper(canvas)`, and reads/writes the resulting `CropperSelection`'s `x/y/width/height` directly as the stored `CropRect` (cropperjs v2 reports selection coordinates in the *natural* image pixel space, matching this project's `CropRect` contract exactly, confirmed by browser check below — no coordinate conversion needed); wired `page.tsx` with `croppingItemId` state and confirm/cancel/reset handlers that dispatch `items/crop` (confirm sets the rect, reset sets `null`) and close the dialog
- A real defect surfaced only outside Jest: `cropperjs`'s web-component classes reference `HTMLElement` at module-evaluation time, which crashed under Next.js's server-side module evaluation (`ReferenceError: HTMLElement is not defined`, reproduced via `npm run dev` — this would also break the static export build, violating the `output: "export"` guardrail). Fixed by changing the top-level `import Cropper from "cropperjs"` to a `type`-only import plus a client-effect-time `await import("cropperjs")`, so the library's module body never evaluates during any server-side pass. This also meant the mocked-`cropperjs` unit tests (`crop-dialog.test.tsx`, and the new `page.test.tsx` case) needed a `waitFor` before interacting with the confirm button, since instantiation now happens one microtask after mount
- REVIEW: APPROVE; the dynamic-import fix was verified by re-running `npm run dev` and confirming the page returns 200 instead of 500
- Full checks: `npx jest tests/unit/page.test.tsx tests/unit/image-list.test.tsx tests/unit/editor-state.test.ts tests/unit/crop-dialog.test.tsx --runInBand` (57/57), `npx tsc --noEmit` (clean), `npx eslint .` (clean); project-wide `full-check` deferred until Batch 3-B completes
- Browser check: headless Chromium via Playwright (per this project's dnd-kit/auto-scroll precedent for pointer-geometry features jsdom cannot simulate). Uploaded a real 400×200 PNG, opened the crop dialog, confirmed cropperjs renders its real selection UI (`<cropper-canvas>`/`<cropper-selection>`/resize handles) with the selection's `x/y/width/height` already in the source image's natural pixel space (e.g. initial `x=120 y=25 width=240 height=50` against the 400×200 source), dragged the south-east resize handle with real mouse events and confirmed the selection's attributes updated live (`width/height` 240×50 → 310×80), and clicked 決定 to confirm the dialog closes — zero console errors throughout
- Files: `src/types/editor.ts`, `src/components/image-editor/CropDialog.tsx`, `src/components/image-editor/CropDialog.module.css`, `src/components/image-editor/ImageListRow.tsx`, `src/components/image-editor/ImageList.tsx`, `src/components/image-editor/ImageList.module.css`, `src/app/page.tsx`, `tests/unit/editor-state.test.ts`, `tests/unit/image-list.test.tsx`, `tests/unit/crop-dialog.test.tsx`, `tests/unit/page.test.tsx`
- Residual risk: touch/pinch-vs-scroll behavior on a real mobile device was not separately verified beyond trusting cropperjs's own built-in touch handling (per the architecture note that this is the library's concern, not hand-rolled here); revisit if a real-device report surfaces a conflict

### 2026-09-05 — P3-04 Render crop and rotation in the correct order (Batch 3-B, cycle 3)

- RED: `image-transform.test.ts` (new) failed because `src/lib/image-transform.ts` did not exist; `page.test.tsx` had a new test asserting that rotating an image swaps the live preview's effective canvas dimensions and draws from a transformed source rather than the raw bitmap — failed because rotation/crop were still ignored by the render pipeline
- GREEN: added `src/lib/image-transform.ts` exporting `getTransformedSize` (crop size, or full source size, then rotated via the P3-02 `getRotatedSize`) and `renderTransformedImage` (crops the source into a fresh canvas via `context.translate`+`rotate`+`drawImage`, fixing the order as crop-in-original-coordinates-first, then rotate — matching that `CropRect` is always stored in original, unrotated pixel space per P3-03); added a `getRenderSource` helper in `page.tsx` that returns the raw bitmap unchanged when an item has no crop and no rotation (avoiding an unnecessary canvas allocation for the common case) and otherwise routes through `renderTransformedImage`; both the live-preview effect and `handleDownload` now build their `sizes`/image-source arrays through this helper instead of reading `item.bitmap.width/height` directly, so preview and export stay on the same transform + layout + render pipeline the architecture requires
- REVIEW: APPROVE; the untransformed fast path meant every pre-existing test (none of which set rotation/crop) needed zero changes to its `drawImage` assertions — only the new rotated-item test needed the shared canvas context mock extended with `translate`/`rotate` stubs
- Full checks: `npx jest --runInBand` (105/105 at this point), `npx tsc --noEmit` (clean), `npx eslint .` (clean); project-wide `full-check` (incl. `next build`) confirmed passing
- Browser check: headless Chromium via Playwright. Uploaded a 200×100 red/blue split PNG, sampled the live preview canvas's pixel data before and after clicking rotate: canvas dimensions swapped 200×100 → 100×200 exactly, and the color mapping matched a true 90° clockwise rotation (left edge → top edge: red went from the left half to the top half, blue from the right half to the bottom half) — confirming both the dimension math and the actual pixel transform are correct, not just the mocked call arguments. Zero console errors
- Files: `src/lib/image-transform.ts`, `src/app/page.tsx`, `tests/unit/image-transform.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-05 — Correctness fix found during P3-04 verification: CropDialog's selection coordinates were not actually in the source image's pixel space

- Context: while browser-verifying P3-04's crop+rotate pipeline, sampling actual pixels after a real crop drag exposed that P3-03's `CropDialog` had a latent, real defect (not caught by the mocked unit tests, since the mock made `getCropperSelection()` return arbitrary numbers and the tests only checked those numbers passed through unchanged). Root cause: cropperjs v2's `<cropper-canvas>` custom element sizes itself to fill its DOM parent's width (here, the dialog panel, ~480px) rather than tracking the source `<canvas>`'s own pixel dimensions — so for any image whose natural size didn't happen to exactly match that container, `CropperSelection.x/y/width/height` were reported in that container's on-screen coordinate space, offset and scaled away from the image's actual natural pixel space. Confirmed empirically (not just by reasoning about the library): forcing `selection.x = 0` visually landed ~140px to the left of where a 200×100 test image actually started rendering inside its (accidentally 480px-wide) container
- Fix: wrap the canvas in a wrapper `<div>` whose CSS pixel size is explicitly fixed, before constructing `Cropper`, to `Math.round(bitmap.width * displayScale)` × `Math.round(bitmap.height * displayScale)`, where `displayScale` reuses the existing `computePreviewScale` (`src/lib/layout.ts`) against a 480px max dimension — this makes cropperjs's container match the image's own aspect ratio exactly (eliminating the letterbox offset) with a single, known uniform scale factor. `handleConfirm` and the existing-crop-reopen path now multiply/divide by that `displayScale` to convert between display-space and the original image's natural pixel space (which is what `CropRect` is documented to store)
- RED: rewrote `crop-dialog.test.tsx`'s fixture to use a 1200×800 bitmap (forcing a real 0.4 display scale instead of the accidental 1.0 the original 400×300 fixture had, which could never have caught this class of bug), and added a case for reopening an existing crop; both failed against the pre-fix code (raw, unconverted selection values)
- REVIEW: APPROVE; re-verified via the same real-pixel technique that exposed the bug — forced `selection.x/y/width/height` to known values and confirmed via `getBoundingClientRect` that the selection box now exactly overlays the image (no offset) at natural sizes under 480px, then did a full drag-crop-confirm cycle on a 1200×800 red/green split image and sampled the resulting preview's pixels on both sides of the computed crop boundary — the color boundary landed exactly where the natural-pixel math predicted, confirming the fix end-to-end, not just at the unit-test mock level
- Full checks: `npx jest --runInBand` (106/106), `npx tsc --noEmit` (clean), `npx eslint .` (clean)
- Files: `src/components/image-editor/CropDialog.tsx`, `src/components/image-editor/CropDialog.module.css`, `tests/unit/crop-dialog.test.tsx`
- Residual risk: none identified; this is a good example of why the plan's "browser check with real pixel/geometry verification" requirement for pointer-geometry features matters — the mocked unit tests alone were fully green while the feature was silently broken for any non-coincidentally-sized image

### 2026-09-05 — EXIF orientation verification (Batch 3-B, cycle 4)

- Context: FR-05's last bullet ("読み込み時はEXIF方向を考慮する") is not its own numbered item in `docs/IMPLEMENTATION_PLAN.md`; the plan called for verifying it once rotation existed rather than assuming it, since `createImageBitmap`'s EXIF-respecting default varies by spec version/browser
- No code change expected going in; this was a verification-only cycle (same precedent as P2-04's auto-scroll check)
- Browser check: headless Chromium via Playwright. Generated a 200×100 JPEG (red left half / green right half, stored unrotated) carrying EXIF `Orientation=6` (rotate 90° CW for correct display) using Pillow. Uploaded it and sampled the live preview: (a) the decoded `ImageBitmap` was already 100×200 with red at the top and green at the bottom — confirming this project's `createImageBitmap(file)` call (no `imageOrientation` option passed) already honors EXIF orientation by default in current Chromium, satisfying FR-05 with no code change; (b) clicking the rotate button on top of that EXIF-corrected image produced the expected further 90° clockwise rotation (200×100, green left / red right) — confirming our rotation feature composes correctly with the browser's own EXIF correction rather than double-applying or conflicting with it. Zero console errors in both checks
- REVIEW: APPROVE; closes the EXIF verification step with no residual gap
- Full checks: none run (no code changed this cycle)
- Files: none (verification only)
- Residual risk: relies on the current Chromium's `createImageBitmap` default (`imageOrientation: "from-image"`); if a target browser in Phase 6's cross-browser pass (P6-01/02/03) defaults differently, revisit by passing `{ imageOrientation: "from-image" }` explicitly at the `createImageBitmap` call site in `src/app/page.tsx`

### 2026-09-05 — P3-07 Custom size while preserving aspect ratio, wiring sizeMode (Batch 3-B, cycle 5)

- Context: three FR-06 details were ambiguous (whether the "initial value per direction" line means direction changes should reset `sizeMode`; what basis "fit width/height" should scale against; which axis a "custom" numeric value targets). Recorded all three, with the interim decisions below, in the new `docs/Question.md` rather than blocking on them
- RED: `editor-state.test.ts` had no `settings/sizeMode`/`settings/customSize` actions; `page.test.tsx` found no 原寸/幅揃え/高さ揃え/カスタム controls, no output-size text, and the preview did not resize non-matching images
- GREEN: added `settings/sizeMode` and `settings/customSize` reducer actions (initial `sizeMode` stays `"original"` — see `docs/Question.md`); added a `sizeGroup` control row (reusing the existing `directionGroup`/`directionButton` pill-button styling) plus a `カスタムサイズ(px)` number input shown only in custom mode; added `applySizeMode` in `page.tsx`, which no-ops for `"original"`, fits every item to the *first* item's width/height for `fitWidth`/`fitHeight` (Batch 3-A's `fitToWidth`/`fitToHeight`), and for `"custom"` fits to the user's number along the width axis in vertical direction or the height axis in horizontal direction (all interim choices, flagged in `docs/Question.md`); applied in both the preview effect and `handleDownload` right after `getRenderSource`'s crop/rotate sizes, before layout — `renderJoinedImage`'s existing `drawImage`-into-placement-rect scaling handles the actual resize, so no separate resize-rendering step was needed; added a memoized `outputSize` (FR-06's "表示する" requirement) computed via the cheap `getTransformedSize` pure function rather than duplicating the canvas-drawing path, rendered as "出力サイズ: W × Hpx(Npx)"
- A lint-caught defect during this cycle: an initial implementation stored `outputSize` in `useState` and called `setOutputSize` synchronously inside the existing preview-render effect — `react-hooks/set-state-in-effect` correctly flagged this as unnecessary cascading-render risk, since the value is fully derivable from existing state. Fixed by replacing it with a `useMemo` computed independently of the canvas-drawing effect (also avoiding a redundant transform-canvas allocation just for a text display)
- REVIEW: APPROVE; verified none of the pre-existing tests needed changes (`sizeMode` default is unchanged, so every prior test's implicit "original" sizing behavior is untouched)
- Full checks: `npm test -- --runInBand` (111/111), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds)
- Files: `src/types/editor.ts`, `src/app/page.tsx`, `src/app/page.module.css`, `tests/unit/editor-state.test.ts`, `tests/unit/page.test.tsx`, `docs/Question.md` (new)
- Residual risk: the three FR-06 interpretation choices in `docs/Question.md` may need revisiting once confirmed; no additional browser check was done for this cycle since it is pure arithmetic layered on the already browser-verified P3-04 render pipeline and already-unit-tested `fitToWidth`/`fitToHeight`

### 2026-09-05 — P3-08 Gap and background settings (Batch 3-B, cycle 6, closes Phase 3)

- RED: `editor-state.test.ts` had no `settings/gap`/`settings/background` actions; `page.test.tsx` found no "画像間隔(px)"/"背景色" inputs and the preview ignored them
- GREEN: added `settings/gap` and `settings/background` reducer actions; added a numeric gap input (`min=0`, controlled by `state.gap`) and a `type="color"` background input (controlled by `state.background`) to `page.tsx`, dispatching on change — as anticipated back in the P1-07/P1-13 cycles, `calculateVerticalLayout`/`calculateHorizontalLayout` and `renderJoinedImage` already fully respected `state.gap`/`state.background`, so this cycle was UI + reducer only, the lowest-risk cycle in the batch as planned
- REVIEW: APPROVE; the test drives the background input via `fireEvent.change` rather than `userEvent.type`, since `userEvent` cannot simulate a real color-picker interaction on `type="color"` — noted inline in the test as a deliberate, minor deviation from this file's usual `userEvent`-first convention, not a coverage gap
- Full checks: `npm test -- --runInBand` (114/114), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds) — **all four `full-check` commands green, closing Phase 3 (P3-01 through P3-08)**
- Files: `src/types/editor.ts`, `src/app/page.tsx`, `src/app/page.module.css`, `tests/unit/editor-state.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-05 — P4-03 Natural filename sorting (Batch 4-A, Lane 1)

- RED: `tests/unit/natural-sort.test.ts` failed because `src/lib/natural-sort.ts` did not exist
- GREEN: added a pure `compareNatural` comparator that splits each string into alternating digit/non-digit runs and compares numeric runs by value rather than lexicographically
- REVIEW: APPROVE; pure, no dependencies, directly usable with `Array.prototype.sort`
- Full checks: `npx jest tests/unit/natural-sort.test.ts` (5/5), `npx tsc --noEmit` (clean), `npx eslint .` (clean); project-wide `full-check` deferred until Batch 4-A's other lane also lands
- Files: `src/lib/natural-sort.ts`, `tests/unit/natural-sort.test.ts`
- Residual risk: none identified for this behavior

### 2026-09-05 — P4-02/P4-05 ZIP entry filtering and limit validation (Batch 4-A, Lane 2)

- Context: `docs/ARCHITECTURE.md`'s proposed layout groups this concern into a single `src/lib/validation.ts` (rather than the plan's initial sketch of two separate files), so P4-02 (supported-file filtering) and P4-05 (count/size limits) were implemented together as one pure module, following the architecture doc over the plan's rougher sketch
- RED: `tests/unit/validation.test.ts` failed because `src/lib/validation.ts` did not exist
- GREEN: added `isSupportedImageEntry` (rejects folders, `__MACOSX/` paths, dotfiles, `Thumbs.db`, and non-png/jpg/jpeg/webp extensions), `isNestedArchiveEntry` (flags `.zip` entries), and `validateZipEntries` (rejects the whole archive for a nested zip or exceeding `maxFileCount`/`maxCompressedEntryBytes`/`maxTotalUncompressedBytes`, otherwise returns the supported entries naturally sorted via P4-03's `compareNatural`) with `DEFAULT_ZIP_LIMITS`
- A scope decision recorded in `docs/Question.md` rather than blocking on it: encrypted-ZIP detection (also part of P4-04) is deliberately *not* attempted via manual central-directory parsing here, since `fflate`'s public API doesn't expose the encryption bit and implementing a binary ZIP parser just for that flag was judged disproportionate to what the guardrail actually requires (the worker not hanging, and limits being enforced) — Batch 4-B will instead treat any `fflate` extraction failure (encrypted, corrupt, or unsupported compression alike) as one unified safe rejection
- REVIEW: APPROVE; pure, fully covered by table-style tests for each rejection reason
- Full checks: `npx jest tests/unit/validation.test.ts` (12/12), `npx tsc --noEmit` (clean), `npx eslint .` (clean); project-wide `full-check` run after both Batch 4-A lanes landed (test/typecheck/lint/build all green)
- Files: `src/lib/validation.ts`, `tests/unit/validation.test.ts`, `docs/Question.md`
- Residual risk: see the recorded scope decision above; revisit if the user wants encrypted archives distinguished from merely-corrupt ones

### 2026-09-05 — P4-01/04/06/07 ZIP Worker, client, and page wiring (Batch 4-B, closes Phase 4)

- Design: `src/workers/zip.worker.ts` exports a pure `extractZipBuffer(buffer, onProgress?)` (no `self`/Worker references) separated from a thin `self.onmessage` wrapper, mirroring this project's established "pure logic separate from the browser/worker glue" pattern (`render.ts` vs `page.tsx`). `extractZipBuffer` calls `fflate`'s `unzipSync` **twice**: once with a filter that always returns `false` (cheap, decompresses nothing — just enumerates central-directory metadata into `ZipEntryMeta[]`), then runs Batch 4-A's `validateZipEntries` against that list, and only if approved calls `unzipSync` a second time with a filter that accepts just the approved names — so oversized/too-numerous/nested archives are rejected **before** any decompression is attempted, extending the "check limits before allocating" principle (already used for the output-size guard) to ZIP extraction. `src/lib/zip-client.ts` wraps `new Worker(new URL("../workers/zip.worker.ts", import.meta.url))`, transferring the `ArrayBuffer`, and returns `{ result: Promise, cancel: () => void }`; `cancel()` calls `Worker.terminate()` and resolves the promise as `{ ok: false, reason: "cancelled" }` itself (a real, browser-guaranteed-immediate cancellation, even though it can't interrupt fflate's synchronous `unzipSync` mid-call — acceptable given P4-05's limits already bound how long that call can run)
- RED: `zip-worker.test.ts` (using `fflate`'s own `zipSync` to build real, valid test archives rather than hand-rolled binary fixtures) and `zip-client.test.ts` (mocking the global `Worker`, same precedent as dnd-kit/cropperjs mocking) were written and verified against the already-drafted implementation — for this file specifically, implementation and test design were developed together while researching `fflate`'s actual API surface (its docs/types don't show usage examples for the "enumerate without decompressing" pattern), so the tests did not strictly precede the code; the meaningful verification instead came from running the tests as an integration check against real `fflate`-produced ZIP data (they caught real issues on the first run: see below) and from the subsequent real-browser check
- Found before any test ran, by simply starting `next dev`: `import.meta.url`-based `new URL(...)` worker construction and `unzipSync` both work fine in Next.js/Turbopack's dev server without special config
- Found by the Jest run: jsdom's `Blob`/`File` do not implement `.arrayBuffer()` (needed to hand the ZIP `File` to the worker as a transferable `ArrayBuffer`) — added a `FileReader`-based polyfill to `jest.setup.ts`, following the same pattern as the existing `matchMedia` polyfill there, since `.arrayBuffer()` itself is standard and correctly used in production code
- `page.tsx` wiring: `handleAddFiles` now splits dropped/selected files by `.zip` extension; ZIP files go through a new `handleAddZip`, which calls `extractZipFile`, shows a `ZIPを確認中です`/`ZIPを展開中です` status with a `キャンセル` button while pending, and on success converts each extracted `{name, data}` into a `File` (MIME type inferred from extension) and feeds it through the **existing** `addImages` pipeline — so extracted images get the same signature validation, decode, ordering, and cleanup guarantees as regular file uploads, with no separate code path. On failure (any reason except a user-initiated cancel), the ZIP's name and a Japanese reason are appended to the existing `rejectedFileNames` alert
- REVIEW: APPROVE; confirmed the `Uint8Array<ArrayBuffer>` vs `Uint8Array<ArrayBufferLike>` typecheck friction (from newer TypeScript's generic typed-array libs) was resolved by typing from `ReturnType<typeof unzipSync>` rather than a hand-written annotation, and that `self`/`Worker` typing was solved locally (a small structural `DedicatedWorkerSelf` type) rather than adding a `webworker` lib globally, which would conflict with the project's existing `dom` lib
- Full checks: `npm test -- --runInBand` (146/146), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds, confirming the worker bundles correctly under Turbopack)
- Browser check: headless Chromium via Playwright, real ZIP files built with Python's `zipfile`/PIL (not fflate-generated, to cross-check against a fully independent ZIP writer). (1) A ZIP with `img2.png`/`img10.png`/`readme.txt`/`__MACOSX/img2.png`/an empty folder correctly added only the two real images to the list, in natural order (`img2.png` then `img10.png`), silently dropping the rest — zero console errors. (2) A ZIP containing a nested `inner.zip` was rejected with the alert `対応していない、または壊れた画像: nested.zip(ZIP内にZIPが含まれています)`. (3) A file with `.zip` extension but no real ZIP structure was rejected as `...(展開できませんでした)`. All three confirm the worker genuinely bundles and executes under Turbopack in a real browser, not just in Jest's mocked/jsdom environment
- Files: `src/workers/zip.worker.ts`, `src/lib/zip-client.ts`, `src/app/page.tsx`, `src/app/page.module.css`, `src/components/image-editor/ImageList.tsx`, `jest.setup.ts`, `tests/unit/zip-worker.test.ts`, `tests/unit/zip-client.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: real mid-flight cancellation (clicking キャンセル while `unzipSync` is actually still running inside the worker) was not exercised in the browser check, since the size-capped test archives extract too fast to reliably race against — the cancel *wiring* itself (button → `cancel()` → `Worker.terminate()` → promise resolves as cancelled, and late messages are ignored) is fully covered by `zip-client.test.ts`'s mocked-Worker tests, and `Worker.terminate()` itself is a browser-guaranteed-synchronous-stop API, so this is a low-risk gap

### 2026-09-05 — P5-04 Output pixel-count guard (Batch 5-A)

- RED: `tests/unit/output-guard.test.ts` failed because `src/lib/output-guard.ts` did not exist
- GREEN: added a pure `exceedsPixelThreshold` checking `width * height` against a `MAX_OUTPUT_PIXELS` constant (100,000,000px, matching the "100MP output warning" residual note recorded back in the P1-07 cycle)
- REVIEW: APPROVE; pure, no dependencies; not yet wired into `page.tsx` (the actual warning-before-allocating behavior is the next cycle, P5-04 wiring)
- Full checks: `npx jest tests/unit/output-guard.test.ts` (3/3), `npx tsc --noEmit` (clean), `npx eslint .` (clean)
- Files: `src/lib/output-guard.ts`, `tests/unit/output-guard.test.ts`
- Residual risk: none identified for this behavior

### 2026-09-05 — P5-03 JPEG export with configurable quality (Batch 5-B, cycle 1)

- RED: `editor-state.test.ts` had no `settings/format`/`settings/jpegQuality` actions; `page.test.tsx` found no PNG/JPEG toggle or quality input, and `handleDownload` always exported PNG regardless of format
- GREEN: added `settings/format` and `settings/jpegQuality` reducer actions; added a PNG/JPEG toggle (reusing the `directionGroup`/`directionButton` pattern) and a `JPEG品質` number input (shown only in JPEG mode, `min=0.01 max=1 step=0.01`) to `page.tsx`; `handleDownload` now calls `canvas.toBlob` with `("image/jpeg", state.jpegQuality)` and a `.jpg` filename when `state.format === "jpeg"`, otherwise the existing PNG path is unchanged; the download button's label also reflects the current format. Opaque-background handling needed no new code — `renderJoinedImage` has filled the background before drawing every image since P1-07, specifically anticipating this JPEG case (see that cycle's code comment)
- REVIEW: APPROVE; confirmed via the full suite that every pre-existing PNG-path test still passes unchanged, since `format` defaults to `"png"` and none of those tests touch it
- Full checks: `npm test -- --runInBand` (152/152), `npm run typecheck` (clean), `npm run lint` (clean)
- Files: `src/types/editor.ts`, `src/app/page.tsx`, `tests/unit/editor-state.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-05 — P5-04 Wire the pixel-count guard into the download path (Batch 5-B, cycle 2)

- RED: `page.test.tsx` uploaded an 11000×10000 image (110MP, above the 100MP threshold) and asserted `window.confirm` is called before `canvas.toBlob`, with the download cancelled if declined and proceeding if confirmed — both failed since `handleDownload` never checked the threshold
- GREEN: called Batch 5-A's `exceedsPixelThreshold` on the computed layout size right before `document.createElement("canvas")` in `handleDownload`, showing a `window.confirm` with the computed output dimensions and returning early if declined
- REVIEW: APPROVE; the guard sits exactly at the "before allocating" point the architecture's design rules call for
- Full checks: `npm test -- --runInBand` (154/154), `npm run typecheck` (clean), `npm run lint` (clean)
- Files: `src/app/page.tsx`, `tests/unit/page.test.tsx`
- Residual risk: none identified for this behavior

### 2026-09-05 — P5-01/P5-02 Clipboard PNG copy with download fallback (Batch 5-B, cycle 3, closes Phase 5)

- RED: `clipboard.test.ts` failed because `src/lib/clipboard.ts` did not exist; `page.test.tsx` found no "PNGとしてコピー" button and no copy/fallback status text
- GREEN: added `copyPngBlobToClipboard` (feature-detects `ClipboardItem`/`navigator.clipboard.write`, returns `"unsupported"`/`"copied"`/`"failed"` rather than throwing, treating Clipboard as a replaceable adapter per the architecture's design rules); refactored `handleDownload`'s shared sizes/layout/pixel-guard/render logic out into `buildOutputCanvas()` so both download and copy build the identical full-resolution output through one path (no divergence risk between the two export actions); added `handleCopy`, which always requests a PNG blob (FR-08: clipboard copy is PNG-only regardless of the JPEG/PNG format toggle) and, on anything other than `"copied"`, falls back to the existing `downloadBlob` PNG path — covering both P5-01 (copy) and P5-02 (fallback) as one cycle, since the fallback is simply the alternate branch of the same handler
- REVIEW: APPROVE; confirmed the refactor didn't change `handleDownload`'s observable behavior (full pre-existing download/pixel-guard test suite passed unchanged)
- Full checks: `npm test -- --runInBand` (160/160), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds) — **all four `full-check` commands green, closing Phase 5 except the P5-05 cleanup audit below**
- Browser check: headless Chromium via Playwright with clipboard permissions granted. Uploaded a real PNG, clicked "PNGとしてコピー", confirmed the UI showed "クリップボードにコピーしました", and — going beyond the UI text — called `navigator.clipboard.read()` from the page itself and confirmed the clipboard genuinely contained an `image/png` entry, not just a UI claim. Zero console errors
- Files: `src/lib/clipboard.ts`, `src/app/page.tsx`, `src/app/page.module.css`, `tests/unit/clipboard.test.ts`, `tests/unit/page.test.tsx`
- Residual risk: the "failed" path (clipboard API present but the browser denies/throws, as opposed to being entirely unsupported) is unit-tested but not separately browser-verified, since headless Chrome with granted permissions cannot easily be made to deny mid-flight; the code path is identical to "unsupported" (same fallback), so risk is low

### 2026-09-05 — P5-05 Resource cleanup audit (closes Phase 5)

- Context: the plan called for auditing whether the existing delete/clear/unmount `ImageBitmap.close()` and object-URL-revocation discipline (established back in P1-09/P1-10/P1-07) still holds for everything Phases 3–4 added, per the same "extend coverage rather than build a new mechanism" precedent as P2-04
- Audit findings (no code changes needed): (1) Crop/rotation only add metadata fields to the existing `ImageItem`, not new owned resources — no new bitmaps or URLs to track. (2) `CropDialog`'s `cropperjs` instance is destroyed in its existing `useEffect` cleanup; it uses a `data:` URL internally (via canvas → base64), not a `blob:` object URL, so there is nothing additional to revoke. (3) `image-transform.ts`'s per-item offscreen canvases (from `renderTransformedImage`) are plain, GC-eligible `HTMLCanvasElement`s recreated fresh on every render — unlike `ImageBitmap`, canvases need no explicit `close()`/disposal, and none are retained past the render that created them. (4) ZIP-extracted images are converted to `File` objects and pushed through the *same* `addImages` → `ownedBitmapsRef` pipeline as regular file uploads, with no separate ZIP-specific bitmap bookkeeping — so the existing delete/clear/unmount cleanup already covers them by construction, not by any Phase-4-specific code. (5) `zip-client.ts`'s `Worker.terminate()` fires exactly once on done/error/cancel via a `settled` guard, so no worker or its object-URL-free message channel is left dangling
- One coverage gap found and closed: no existing test exercised bitmap cleanup specifically for a ZIP-sourced item (all prior delete/clear cleanup tests used regular file uploads). Added a test uploading a ZIP with two images, deleting one, then clearing the rest, asserting each bitmap's `close()` fires exactly once at the right step — it passed immediately against the existing code, confirming finding (4) above rather than exposing a defect
- REVIEW: APPROVE; closes Phase 5 as audited-and-covered, no regressions
- Full checks: `npm test -- --runInBand` (161/161), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds) — **all four `full-check` commands green, closing Phase 5 (P5-01 through P5-05)**
- Files: `tests/unit/page.test.tsx`
- Residual risk: none identified

### 2026-09-05 — Phase 6: Release gate (P6-01 through P6-06)

All of Phase 6 is verification/hardening rather than new-feature TDD cycles, per the plan; one real, code-fixing defect surfaced (P6-06, below). This environment has headless Chromium available by default; Firefox and WebKit (the closest available proxy for Safari/iOS Safari) were installed via `python3 -m playwright install webkit firefox` for this gate specifically, since real cross-engine verification is exactly what P6-02/03 ask for and installing them is a low-risk, reversible, local-only action (browser binaries cached under `~/Library/Caches/ms-playwright`, no project files touched). No real Android/iOS device or Edge binary was available in this environment; Edge is Chromium-based and shares no code path this project treats differently, so the extensive Chromium checks already performed across Phases 3–5 stand in for it — that substitution is noted explicitly rather than silently claimed as "tested."

- **P6-01 (Chrome/Edge desktop)**: covered by the many headless-Chromium checks already performed throughout Phases 3–5 (crop, rotate+crop pixel correctness, ZIP extraction/rejection, clipboard copy, static-export serving). Not independently re-run here since nothing changed since those checks; Edge substitution noted above.
- **P6-02 (Firefox/Safari fallback)**: ran a full feature smoke test (upload → live preview → rotate → open crop dialog → ZIP extraction → PNG download → clipboard copy) on both engines against `next dev`. Both: zero console/page errors, correct rotated dimensions, `cropper-selection` rendered correctly (confirming `cropperjs`'s custom-element/shadow-DOM approach works outside Chromium), ZIP extraction via the Worker+`fflate` pipeline succeeded with correct natural-sort filtering, PNG download triggered correctly. Clipboard copy diverged instructively: Firefox copied successfully; WebKit's `navigator.clipboard.write` was not usable in this automated context and the app correctly fell back to a PNG download with the "コピーできなかったため...ダウンロードしました" message — a real, unscripted exercise of P5-02's fallback path on the one engine most likely to need it (Safari has historically had the most restrictive Clipboard API image support)
- **P6-03 (representative iOS Safari / Android Chrome)**: approximated with WebKit and Chromium respectively at a 375×700 viewport with touch enabled (the closest available proxy for real device engines, explicitly not claimed as identical to real iOS/Android). Both: no horizontal overflow, 編集/完了 edit-mode toggle appeared and correctly gated the per-row drag handles, zero console errors
- **P6-04 (no image-bearing network requests)**: extended the existing P0-03 fetch/XHR/`sendBeacon` guard test with a new case exercising everything added since — crop confirm, ZIP extraction, and clipboard copy — all under the same spies. Passed immediately (verification-only; no code change), confirming none of the Phase 3/4/5 additions introduced a network call
- **P6-05 (static export / Cloudflare Pages config)**: confirmed `next.config.ts` already has `output: "export"` and `trailingSlash: true` (the latter is specifically the Cloudflare-Pages-recommended setting for static exports). Ran `next build`, inspected `out/`: root-relative asset paths, no server-only artifacts, and the ZIP worker correctly emitted as its own hashed asset (`out/_next/static/media/zip.worker.*.ts`) rather than inlined. Served `out/` with a plain static file server (`python -m http.server`, i.e. **no Next.js server at all**, the actual shape of a Cloudflare Pages deployment) and repeated the ZIP-extraction browser check against it — succeeded with zero console errors, confirming the Worker bundling survives the real static-export artifact, not just `next dev`
- **P6-06 (accessibility + full completion gate)**: ran an automated `axe-core` (4.10.2, loaded from cdnjs for the check only — not a project dependency) WCAG2A/AA scan across six states: empty list, with images (desktop edit controls visible), crop dialog open, JPEG format selected, custom size mode, and a 375px mobile viewport in edit mode. **Found one real, "serious"-impact defect**: `.emptyHint`/`.empty` text used `--color-text-faint: #8b90a0` against the `#f8f9fb` panel background, a 3.02:1 contrast ratio — short of WCAG AA's 4.5:1 minimum for normal-size text. Fixed by changing the token to `#6b7280` (4.59:1, computed via the standard relative-luminance formula, verified against both usage sites of the token). Re-ran the same six-state axe scan: zero violations everywhere. This was a real, browser-only-discoverable defect (jsdom cannot compute real CSS color contrast, so no Jest unit test could have caught it) — no jsdom test was written for it, matching this project's established precedent of browser-verified CSS fixes (e.g. the Phase 1/2 "visual restyle" cycle) rather than a low-value test that would only check jsdom's non-rendering approximation
- Full checks: `npm test -- --runInBand` (162/162), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds) — **all four green, closing Phase 6 and all of Phases 3–6**
- Files: `src/app/globals.css`, `tests/unit/page.test.tsx`
- Residual risk: real Safari (WebKit-the-engine ≠ Safari-the-browser-with-Apple's-integrations) and real iOS/Android devices were not available in this environment; the WebKit/Firefox/touch-emulation checks above are the closest practical substitute and are reported as such, not as equivalent to real-device QA. No wrangler.toml/Cloudflare Pages project config was added, since deploying an already-static `out/` directory via Cloudflare Pages needs no repository-side config beyond the confirmed `output: "export"`/`trailingSlash: true` — add one later only if the user wants Pages-specific settings (headers, redirects) beyond defaults

### 2026-09-05 — External review: Codex CLI findings on Phases 3–6, and the resulting fixes

Per the project plan's "all phases complete" checkpoint, ran an independent review via `codex exec` (OpenAI Codex CLI, read-only sandbox) over the full uncommitted working tree, pointed at `docs/REQUIREMENTS.md`/`ARCHITECTURE.md`/`ACCEPTANCE_CRITERIA.md`/`TDD_LOG.md`/`Question.md`. Initial score: **60/100** — real correctness/safety defects, not scope-not-yet-reached or cosmetic issues (the batch this review covers was already claimed complete, so no milestone-mismatch pushback was warranted here, unlike the earlier Phase 2 Codex review). Every finding below was independently verified (not taken on trust) before being accepted or fixed, per the review-verification discipline; two findings were reasoned through and found to be less severe than Codex's initial framing, documented as such rather than silently accepted or dismissed.

**Fixed (all re-verified with real tests and, where relevant, a real-browser check):**

1. **Critical — ZIP safety limits didn't match the spec at all.** `docs/REQUIREMENTS.md`'s "5. Initial safety limits" table (200MB archive / 200 files / 30MB per image / 300MB total / 100MP output) was missed entirely while implementing Phase 4 — `validateZipEntries` used invented numbers (500 files / 50MiB per-*compressed*-entry / 500MiB total) with **no per-entry uncompressed-size check at all** (the spec's "one extracted image: 30MB" limit), and **no check on the ZIP file's own size** before reading it into memory via `.arrayBuffer()`. Fixed: `DEFAULT_ZIP_LIMITS` now matches the table exactly with a new `maxArchiveCompressedBytes`/`maxEntryUncompressedBytes` shape; `extractZipBuffer` rejects oversized archives via `buffer.byteLength` before even scanning the central directory; `page.tsx`'s `handleAddZip` checks `File.size` before ever calling `.arrayBuffer()`. Tests now pin the exact spec boundary values (`DEFAULT_ZIP_LIMITS.maxFileCount`, not a hand-picked 501) per REQUIREMENTS.md's own instruction ("制限値は設定定数として一元管理し、テストで境界値を固定する").
2. **Major — the crop dialog's display-to-source coordinate math silently broke if the user panned/zoomed/rotated the underlying image inside the dialog.** `CropDialog`'s fixed `displayScale` conversion assumed the image never moves independently of the selection box, but cropperjs's default template allows exactly that. Fixed by setting `scalable`/`translatable`/`rotatable`/`skewable` to `false` on the `CropperImage` — only the selection box can be manipulated now, which is also a better fit for a straightforward crop tool. Verified in a real browser: the image's CSS transform matrix is byte-identical before and after drag/wheel attempts on the image itself.
3. **Major — the crop selection had no keyboard access at all**, violating `docs/REQUIREMENTS.md`'s explicit "すべての操作をキーボードで到達・実行できる" requirement (not just a general accessibility nicety — a stated spec line). `CropperSelection.keyboard` defaults to disabled; fixed by setting it `true`. Verified in a real browser: clicking the move handle then pressing arrow keys moves the selection.
4. **Major — the live preview allocated a full-natural-resolution intermediate canvas for any rotated/cropped item, with no size guard at all** (unlike download/copy, which already had P5-04's `exceedsPixelThreshold` + confirm). Every settings change re-ran this for every transformed item. Fixed by threading an optional `maxDimension` through `getTransformedSize`/`renderTransformedImage`, so the preview path (only) draws directly at a capped size — verified in a real browser that a 1200×800 image rotated 90° now allocates a 320×480 intermediate canvas instead of 800×1200, while pixel correctness (rotation direction, color mapping) is unchanged.
5. **Major — multiple concurrently-dropped ZIP files raced on the single `zipStatus` state**, so one's progress/cancel could silently clobber another's, and nothing cancelled in-flight extractions if the page unmounted mid-extraction. Fixed by serializing ZIP processing through a queue (`zipQueueRef`, the same pattern `commitQueueRef` already used for `addImages`) and gating every `setZipStatus`/`addImages` call on `mountedRef.current`. Verified: two ZIPs dropped together now extract one at a time, and the second's `extractZipFile` call only happens after the first's promise resolves.

**Investigated and NOT changed, with reasoning recorded in `docs/Question.md`:**

- **Codex's "CRC/encryption bypass" framing was partially right, partially not.** Directly verified in Node against the installed `fflate`: `unzipSync` does **not** validate CRC-32 (a single flipped byte, same length, returns silently with no exception) and does **not** check the ZIP encryption bit (a forged-encrypted entry extracts fine). So "decompression throwing" is **not** a reliable detector of corrupted/encrypted archives, contradicting this project's original P4-04 assumption. However, a separate direct test showed this does **not** actually bypass the size limits: forging a smaller declared uncompressed size caused `fflate` to *truncate* output to that declared size rather than expanding past it, and this project's limit checks already run against the *declared* (pre-decompression) metadata before any decompression is attempted — so a maliciously inflated declared size is rejected before allocation regardless. The real, remaining consequence is a *data-integrity* one: a corrupted/encrypted ZIP entry can silently decompress to garbage bytes instead of throwing. This is judged acceptable without a bespoke ZIP-header parser because the existing, already-tested `isSupportedImageFile` (Phase 1 magic-byte signature check) sits downstream of every extracted "image" regardless of source — garbage bytes essentially never coincidentally match a real PNG/JPEG/WebP signature, so they still get rejected as "対応していない、または壊れた画像", just without ZIP-specific wording. Documented this reasoning (and the two verification scripts run) in `docs/Question.md` rather than silently accepting or dismissing the finding.

Full checks after all fixes: `npm test -- --runInBand` (172/172), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds).

Files: `src/lib/validation.ts`, `src/workers/zip.worker.ts`, `src/lib/image-transform.ts`, `src/components/image-editor/CropDialog.tsx`, `src/app/page.tsx`, `tests/unit/validation.test.ts`, `tests/unit/zip-worker.test.ts`, `tests/unit/crop-dialog.test.tsx`, `tests/unit/image-transform.test.ts`, `tests/unit/page.test.tsx`, `docs/Question.md`

### 2026-09-05 — External re-review round 2: Codex CLI findings on the round-1 fixes (score 60→70), and their fixes

Ran a second Codex review (`codex exec resume --last`, same session) specifically over the round-1 fixes above. Score moved from 60→70/100 (limits/serialization/preview-memory genuinely improved), but Codex found **one real regression I introduced in round 1** and **one real gap round 1 missed**, both verified independently before fixing, plus reasoned pushback on one point that turned out to be correct.

**Fixed:**

1. **Critical (Codex's framing, confirmed) — STORE-method ZIP entries bypass the per-image/total size limits entirely, not just theoretically.** Verified directly in Node: a STORE (uncompressed) entry with a real 31MiB payload but a forged 1-byte declared `uncompressedSize` returns the full 31MiB from `unzipSync` — because for STORE, `compressedSize` *is* the real data size and fflate ignores the (forged) size field entirely for that method (this differs from DEFLATE, where forging the declared size *does* truncate real output — confirmed separately, and documented as a correction to the round-1 `Question.md` note, which had wrongly generalized the DEFLATE finding to all methods). Fixed: `validateZipEntries` now checks `Math.max(compressedSize, uncompressedSize)` per entry and in the running total, closing the bypass regardless of compression method. New tests use real byte-level ZIP forgery (raw `DataView` writes to a real `zipSync`-built archive, mirroring the verification technique) rather than only mocked metadata, at both the `validation.ts` unit level and the `zip.worker.ts` integration level.
2. **Major regression (my own round-1 fix) — the memory-capped preview transform broke relative proportions between images.** Round 1's `getRenderSource(item, maxDimension)` fix (correctly) capped the *drawing* resolution for memory safety, but I mistakenly also returned the *capped* width/height for **layout math**, so a transformed item's apparent size in the joined layout no longer matched an untransformed item's — e.g. a 1200×800 image rotated 180° (which must not change apparent size at all) rendered visibly smaller than its untouched twin. Reproduced first with a real regression test (two 1200×800 images, one rotated 180°, asserting identical placement dimensions — failed exactly as Codex described: 480×320 vs 192×128) before fixing. Fixed by decoupling the two concerns: `getRenderSource` now always returns the *full, uncapped* transformed size for layout purposes, while the `source` canvas itself can still be drawn at a capped resolution — `drawImage` scales the (possibly smaller) canvas up into the correctly-computed placement rect either way, so visual proportions are unaffected by the drawing-resolution optimization.
3. **Major (Codex's framing, confirmed) — `buildOutputCanvas` still allocated the full-resolution crop/rotate transform canvas *before* the pixel-threshold confirm check**, defeating the point of P5-04's guard for exactly the case it exists for (a huge rotated/cropped image). Fixed by restructuring `buildOutputCanvas` into two phases: compute sizes via the pure `getTransformedSize` (no canvas allocation) → apply sizeMode → compute layout → check the threshold and confirm → only *then* call `getRenderSource` (the actual expensive allocation) for the approved case. New test confirms zero new canvases are created when the user declines.
4. **Major (Codex's framing, confirmed) — the round-1 "Worker cancelled on unmount" fix only ever suppressed the *result*, never actually stopped the Worker.** `mountedRef` gates state updates but was never wired to call the extraction's `cancel()`. Fixed by tracking the in-flight extraction's cancel handle in a ref and calling it from the existing unmount cleanup. New test: starts an extraction with a never-resolving promise, unmounts, asserts `cancel` was actually called.
5. **Major-equivalent (Codex's framing, confirmed, and found a second layer of the same bug while fixing it) — the crop dialog's fixed `displayScale` could still be wrong on narrow viewports.** First layer (as Codex described): `.canvasWrapper`'s CSS `max-width: 100%` could shrink the wrapper below its intended computed width on a narrow screen, invalidating the assumed scale. Fixed by measuring the wrapper's actually-available width via `getBoundingClientRect()` *before* setting its size, computing intended scale from real available width/height (not just the constant `DISPLAY_MAX_DIMENSION`) so neither `max-width` nor `max-height` needs to clip at all, and re-measuring afterward as a final safety net. **Second, deeper layer found only by real-browser re-verification after that fix still showed the same symptom**: cropperjs's `<cropper-canvas>` shadow-DOM default style has `min-height: 100px` but **no `height: 100%` rule at all** — it fills its parent's width by ordinary block-level layout, but its height defaults to content-based (effectively 0, floored at the 100px minimum), completely independent of the wrapper's actual height. No amount of correctly sizing the *wrapper* could fix this, since `cropper-canvas` was never inheriting that height in the first place. Fixed by explicitly setting `cropper.getCropperCanvas()`'s inline `width`/`height` to `100%`. Verified in a real browser at both 1280px and a 320px (guardrail-mandated minimum) viewport: canvas, image, and selection boxes now align exactly at both sizes, where before the 320px case showed the image pillarboxed inside its own container.
6. **Major (Codex's framing, confirmed) — the crop selection could be moved via keyboard (round 1) but never resized**, since cropperjs's built-in keyboard handler only implements arrow-key movement, not resizing, and this project has no code hooking up an alternative. Added four number inputs (X/Y/幅/高さ, in natural image pixel coordinates) that read the initial selection and write directly to it on change, giving a fully keyboard-operable alternative to pointer dragging that doesn't depend on cropperjs's own (move-only) keyboard support.

**Investigated and NOT changed, with Codex's pushback accepted as correct:**

- **The "corrupted-data-passes-signature-check" concern was more precise than my round-1 answer.** Codex correctly pointed out that a corrupted image body with an intact header would pass the header-only signature check — "signature check" is not full-file integrity verification. Refined the reasoning in `docs/Question.md` rather than just reasserting the original answer: the actual safety net is the *combination* of the signature check and the existing `createImageBitmap` decode-failure handling (P1-03), not the signature check alone — a corrupted body typically fails to decode too, which is already handled. This is weaker than a CRC-32 check (relies on the browser's decoder catching the corruption, not a mathematical guarantee) and is recorded as such; a real CRC-32 verification would need a hand-rolled ZIP central-directory parser, not added here.

Full checks after all fixes: `npm test -- --runInBand` (182/182), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds).

Files: `src/lib/validation.ts`, `src/workers/zip.worker.ts`, `src/app/page.tsx`, `src/components/image-editor/CropDialog.tsx`, `src/components/image-editor/CropDialog.module.css`, `tests/unit/validation.test.ts`, `tests/unit/zip-worker.test.ts`, `tests/unit/page.test.tsx`, `tests/unit/crop-dialog.test.tsx`, `docs/Question.md`

### 2026-09-05 — External re-review round 3: Codex CLI findings on the round-2 fixes (score 70→85), and their fixes

Ran a third Codex review (`codex exec resume --last`). Score moved 70→85/100; Codex independently re-ran the round-1/round-2 repro scenarios (STORE bypass, preview proportions, Worker-cancel-on-unmount, allocate-before-warning ordering) and confirmed all four fixed. Four new findings, all confirmed and fixed:

1. **Major — zero-width/zero-height crops could be confirmed.** `handleRectFieldChange` only checked "finite and ≥ 0", not "> 0", and `Number("")` is `0`, so clearing a field and confirming produced e.g. `{width: 0}` — which `renderTransformedImage` would turn into a 0-width canvas. Fixed with two changes: (a) invalid/zero width-or-height values are shown in the input (so the field stays editable) but are **not** written through to the live `CropperSelection` — avoiding corrupting Cropper's own internal state; (b) `handleConfirm` now validates the final rect (width > 0, height > 0, and the rect fully within `[0, bitmap.width] × [0, bitmap.height]`) and refuses to confirm with a `role="alert"` message if invalid, per REQUIREMENTS.md's accessibility rule for unrecoverable-action errors.
2. **Major — the number inputs never reflected drag/keyboard-arrow changes made directly on the selection**, only the initial value and the user's own typed input — confirmed by Codex with a reproduction showing the displayed X differed from the value that would actually be saved. Fixed by subscribing to `CropperSelection`'s real `"change"` event (it extends `EventTarget`) and syncing the number-input state from it; also switched `handleConfirm` to build its result from that synced state rather than re-reading the raw selection, so what's confirmed always matches what's on screen (WYSIWYG), including for pure-drag edits that never touch the number inputs.
3. **Major-equivalent — cropperjs's default `min-width: 200px`/`min-height: 100px` reintroduces the exact letterboxing bug round 2 fixed, for extreme-aspect-ratio images.** A 100×2000 image scaled to fit within 480px produces a 24×480 wrapper — narrower than cropperjs's 200px floor — so `<cropper-canvas>` would still be forced wider than intended. Fixed by also setting `min-width`/`min-height` to `0` on the same element already being explicitly sized. Verified in a real browser with an actual 100×2000 image: canvas and image boxes now match exactly (24×480, both), where before this fix they would have diverged.
4. **Minor — the dialog had no focus management** (no initial focus, no restore-on-close), leaving keyboard users' focus wherever it happened to be when the dialog opened, and stranded after it closed. Added a mount effect that focuses the dialog panel (`tabIndex={-1}` on the `role="dialog"` element) and restores focus to whatever was focused before opening, on unmount. A full focus *trap* (preventing Tab from reaching background elements while open) was explicitly not implemented — noted as a further improvement, not done here, given its Minor severity and the scope already covered.

A `react-hooks/refs` lint error surfaced while implementing #1/#2 (accessing `cropperRef.current` inside the closure returned by a curried `(field) => (event) => {...}` handler factory — the linter couldn't prove the ref access was confined to the event-handler-only closure). Fixed by de-currying `handleRectFieldChange` into a plain `(field, event) => {...}` function called from inline arrow functions at each input's `onChange`, which is both lint-clean and a more conventional React pattern.

Full checks: `npm test -- --runInBand` (186/186), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds). Browser-verified: extreme-aspect-ratio crop (100×2000) renders with exactly-matching canvas/image boxes; a cleared width field correctly shows the `role="alert"` rejection message and does not close the dialog.

Files: `src/components/image-editor/CropDialog.tsx`, `src/components/image-editor/CropDialog.module.css`, `src/workers/zip.worker.ts`, `src/lib/validation.ts`, `tests/unit/crop-dialog.test.tsx`, `tests/unit/page.test.tsx`
Residual risk: full keyboard focus-trapping inside the crop dialog is not implemented (Tab can still reach elements behind the overlay while it's open) — flagged as a further accessibility improvement if the user wants it. CRC-32/encryption verification for ZIP entries remains a documented, deliberate gap (see `docs/Question.md`), relying on the browser's own image-decode failure as the practical safety net rather than a from-scratch ZIP central-directory parser.

### 2026-09-05 — External re-review round 4: Codex CLI findings on the round-3 fixes (score 85→88), and their fixes

Ran a fourth Codex review. Score moved 85→88/100. One release-blocking finding and one boundary bug, both verified before fixing (the first directly against `cropperjs`'s own source, not just Codex's description).

1. **Release-blocking — the round-3 "change" event fix read stale, pre-change values.** Verified directly by reading `node_modules/cropperjs/dist/cropper.esm.js`'s `CropperSelection.$change()`: it calls `this.$emit(EVENT_CHANGE, {x, y, width, height})` (the *new* values, in `event.detail`) **before** assigning `this.x = x; this.y = y; ...`. So `syncFromSelection`'s reads of `selection.x/y/width/height` directly, added in round 3, were reading the *old* values at the exact moment the event fires — meaning after a real drag, the number inputs (and, since round 3 switched `handleConfirm` to read from the synced state, the *confirmed* crop too) reflected the position *before* the drag, not after. Fixed by reading the new values from `event.detail` instead of the selection's own properties. This also meant the mocked `FakeCropperSelection` in `crop-dialog.test.tsx` had the event/property-update order backwards (updated properties, *then* dispatched a plain `Event` with no detail) — a mock built the wrong way round would never have caught this class of bug. Fixed the mock to dispatch a `CustomEvent` carrying the new values in `detail` *before* updating its own properties, matching the real library exactly. Verified the fix is real (not just cosmetic) by reverting only the production fix, confirming the existing sync test fails against the reverted code, then restoring it — and separately confirmed with an actual mouse drag in a real browser that the number input's value now matches the real post-drag selection position (previously it would have shown the pre-drag position).
2. **Boundary bug — a valid, extreme-aspect-ratio crop (e.g. 1×2000px) could still produce a 0-width preview canvas.** `getTransformedSize`'s `maxDimension` scaling (`Math.round(1 * 480/2000)`) rounds to 0 even though the round-3 input validation correctly keeps the *unscaled* crop rect at width ≥ 1 — the zero reappears one step later, in the *display-scale* rounding, which round 3's fix didn't touch. Fixed by flooring each scaled dimension at 1px whenever the corresponding unscaled dimension is greater than 0 (a genuinely 0-sized input, which shouldn't occur given the round-3 confirm validation, still maps to 0 rather than being artificially inflated).

Full checks: `npm test -- --runInBand` (187/187), `npm run typecheck` (clean), `npm run lint` (clean), `npm run build` (static export succeeds). Browser-verified with a real mouse drag on `cropper-selection` that the number inputs track the post-drag position correctly.

Files: `src/components/image-editor/CropDialog.tsx`, `src/lib/image-transform.ts`, `tests/unit/crop-dialog.test.tsx`, `tests/unit/image-transform.test.ts`
Residual risk: none newly identified for these two fixes; see the round-3 entry above for the still-open, deliberate gaps (focus trap, ZIP CRC/encryption verification).

### 2026-09-06 — Cloudflare deploy failure: `wrangler deploy` auto-migrated to OpenNext SSR, added `wrangler.jsonc`

A real production deploy failed after a successful `next build`: the Cloudflare build ran `npx wrangler deploy` (a Workers-targeted command, distinct from `wrangler pages deploy`), and with no `wrangler.jsonc` committed, wrangler auto-detected "Next.js" and — non-interactively — ran `@opennextjs/cloudflare migrate`, which assumes an SSR app and tries to bundle `.next/standalone/`. This project builds with `output: "export"` (no server code, per `CLAUDE.md`'s guardrails), so `next build` never produces `.next/standalone`; the migrate step crashed with `ENOENT: .../.next/standalone/.next/server/pages-manifest.json`, a file the current static-export build never generates. The P6-05 entry above assumed no repository-side Cloudflare config was needed — true for classic Cloudflare Pages, but the deploy log's use of `wrangler deploy` (rather than `wrangler pages deploy`) indicates this project's Cloudflare project is a Workers-targeted one, where committing a valid Wrangler config (of which `wrangler.jsonc` is one supported format) is what lets wrangler skip the framework auto-detection/auto-migration path meant for unconfigured projects.

Fixed by adding a `wrangler.jsonc` declaring this as a static-assets-only Worker (`assets.directory: "./out"`, no `main` script — still no server code), with `not_found_handling: "404-page"` matching the real `out/404.html` that `next build` already emits (confirmed locally: `out/index.html`, `out/404.html`, `out/_next/...`, no server artifacts). There is no application code change here, so — matching the P6-05 precedent — it was verified by a local `next build` + inspecting `out/` (the actual serving/404 behavior can only be confirmed against a real deploy), plus a Codex CLI review across two rounds (92→98/100; confirmed the config itself is correct and non-server, and separately confirmed against the installed `wrangler@4.129.0` source (`getDetailsForAutoConfig` in `wrangler-dist/cli.js`) that a valid `wrangler.jsonc` with no `pages_build_output_dir` does short-circuit the framework auto-detection/migration path before it can trigger — flagged only documentation-wording precision and pinning `wrangler` as a devDependency for `$schema`/version reproducibility, both addressed here). The actual Cloudflare deploy could not be exercised from this environment (it would push to the user's live account), so final confirmation happens on the next real Cloudflare deploy, which should show a plain static-asset upload with no "Configuring project for Next.js with OpenNext" step.

Added `wrangler` (`4.129.0`, matching the version the failing deploy log already resolved via `npx`) as a devDependency so `wrangler.jsonc`'s `$schema` reference resolves locally and the deploy tool version is pinned rather than floating.

Full checks: `npm test -- --runInBand`, `npm run typecheck`, `npm run lint`, `npm run build` — all green (no source changes).

Files: `wrangler.jsonc` (new), `package.json`, `package-lock.json`
Residual risk: the actual live `wrangler deploy` behavior against this config has not been observed yet — needs confirmation on the next real Cloudflare deploy.

### 2026-09-06 — Reduce AI-agent doc token usage; fix stale/contradictory docs

Read-only Codex CLI brainstorm (`codex exec -s read-only`, no scoring) on
the same doc set informed the plan before implementing it. Added a "Current
status" index to this log (read it + grep by ID, not the whole file); restructured
`docs/Question.md` with a conclusion line per topic above the folded
history; trimmed `docs/TDD_WORKFLOW.md`'s 12-step protocol, which duplicated
its two diagrams; added a full-check reuse note; compressed `create-pr`'s
incident prose; fixed stale docs (`docs/ARCHITECTURE.md`'s and
`docs/IMPLEMENTATION_PLAN.md`'s "Cloudflare Pages" → Workers static assets,
`create-pr`'s commit-language wording); deleted the sequential-only
`prompts/START.md` and its `README.md` reference; softened `README.md`'s
"3エージェントは同時にコードを書かず" to lane-scoped wording.

Full checks: test 189/189, typecheck clean, lint clean, build succeeds —
docs/skill-only change, no source touched.

Files: `AGENTS.md` (`CLAUDE.md` symlink target), `README.md`,
`docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/Question.md`,
`docs/TDD_LOG.md`, `docs/TDD_WORKFLOW.md`, `.claude/skills/create-pr/SKILL.md`,
`.claude/skills/full-check/SKILL.md`, `prompts/START.md` (deleted)
Residual risk: existing 53 pre-index log entries left as-is (archiving needs
user judgment, out of scope here); `docs/Question.md`'s P4-04 conclusion is
a tentative/accepted-with-known-gap decision, not a fully closed one — see
its own wording.

### 2026-09-06 — codex-review round on the doc-token-reduction change (76→88), and fixes

Scored `codex-review` skill run over the previous entry's diff (separate
from the pre-implementation brainstorm above). Round 1: 76/100 — one
overstated claim in `docs/Question.md`, one structural bug in this log (an
entry spliced into the wrong place), a few stale/contradictory doc mentions,
and one skill-file inaccuracy; all fixed. Round 2: 88/100 — confirmed the
fixes, plus two smaller carry-overs fixed in the same pass. Play-by-play in
PR #10's description and commit history, not here.

Full checks: test 189/189, typecheck clean, lint clean, build succeeds —
docs/skill-only change, no source touched.

Files: `docs/Question.md`, `docs/TDD_LOG.md`, `docs/IMPLEMENTATION_PLAN.md`,
`README.md`, `.claude/skills/full-check/SKILL.md`, `docs/TDD_WORKFLOW.md`
Residual risk: none.
