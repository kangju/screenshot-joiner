# Implementation Plan

Each numbered behavior is one TDD loop unless the test writer demonstrates that a smaller split is required.

## Phase 0 — Foundation

- P0-01 Verify Next.js static build and test setup.
- P0-02 Establish editor types, reducer skeleton, and test helpers.
- P0-03 Add a network-request guard test for the editor workflow.
- P0-04 Confirm the actual deploy target (e.g. Cloudflare Pages vs. Workers)
  and deploy command with the user, and do one trial deploy of a minimal
  static artifact.

## Phase 1 — Basic image input and joining

- P1-01 Select one PNG/JPEG/WebP and add it to state.
- P1-02 Add multiple files while preserving selected order.
- P1-03 Reject unsupported and malformed image data with an accessible error.
- P1-04 Paste one or more clipboard images at the end of the list.
- P1-05/P1-06 Calculate vertical and horizontal placement with zero gap.
- P1-07 Render and download a PNG.
- P1-08 Drag-and-drop image files onto the image list.
- P1-09 Remove an individual image.
- P1-10 Clear all images.
- P1-11 Scale a layout for a downscaled live preview.
- P1-12 Show a live preview that updates as items change.
- P1-13 Choose join direction and reflect it in the live preview and download.

## Phase 2 — Reordering and responsive controls

- P2-01 Reorder through mouse drag and drop.
- P2-02 Reorder through touch handle activation without blocking page scroll.
- P2-03 Reorder through keyboard controls.
- P2-04 Auto-scroll a long list during drag.
- P2-05 Provide accessible icon buttons and tooltips.
- P2-06 Hide row reorder/delete controls on narrow viewports behind an edit-mode toggle.
- P2-07 Always show the filename in each list row.
- P2-08 Render list-row thumbnails to preserve aspect ratio (contain, not cover).
- P2-09 Show short text labels alongside rotate/crop icons in mobile edit mode.

## Phase 3 — Transformations

- P3-01 Rotate an image in 90-degree increments.
- P3-02 Account for swapped dimensions after 90/270-degree rotation.
- P3-03 Open, confirm, cancel, and reset crop metadata.
- P3-04 Render crop and rotation in the correct order.
- P3-05 Fit all images to a common width.
- P3-06 Fit all images to a common height.
- P3-07 Support custom size while preserving aspect ratio.
- P3-08 Apply gap and background settings.
- P3-09 Restructure the crop dialog's numeric fields into a 2x2 grid, add
  guidance text, clarify button wording, and trap focus within the dialog.

## Phase 4 — ZIP input

- P4-01 Send ZIP processing to a dedicated Worker.
- P4-02 Filter supported images and ignore folders and metadata.
- P4-03 Sort extracted images by natural filename order.
- P4-04 Reject encrypted, nested, malformed, or unsupported archives.
- P4-05 Enforce per-file, count, compressed-size, and total-expanded-size limits.
- P4-06 Report progress and cancel extraction.
- P4-07 Terminate the Worker and release transferred resources.

## Phase 5 — Export and cleanup

- P5-01 Copy the final PNG with ClipboardItem.
- P5-02 Fall back to PNG download when image clipboard writing is unavailable.
- P5-03 Export JPEG with configurable quality and an opaque background.
- P5-04 Warn before allocating output above the pixel threshold.
- P5-05 Revoke object URLs and close ImageBitmap objects on deletion, clear, and unmount.
- P5-06 Include a client-local timestamp in the downloaded filename.

## Phase 6 — Release gate

- P6-01 Test current Chrome and Edge desktop flows.
- P6-02 Test current Firefox and Safari fallbacks.
- P6-03 Test representative iOS Safari and Android Chrome flows.
- P6-04 Verify there are no image-bearing network requests.
- P6-05 Verify static export and Cloudflare Workers static-assets configuration.
- P6-06 Run accessibility checks and the full completion gate.

