# TDD Log

Append one entry only after a completed loop.

## Template

```text
### YYYY-MM-DD — Requirement ID and behavior

- RED: test names and expected failure
- GREEN: production change and passing narrow suite
- REVIEW: APPROVE or findings resolved
- Full checks: test / typecheck / lint / build
- Files: changed paths
- Residual risk: none or concise note
```

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
