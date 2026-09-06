# Acceptance Criteria

## Product-level criteria

- A user can add at least two supported images without a server request.
- A user can reorder them by dragging the dedicated handle with a mouse.
- A mobile user can reorder them by long-pressing and dragging the handle without preventing normal scrolling elsewhere.
- A keyboard user can reorder them and receive an accessible status update.
- A user can crop, rotate, and resize each image non-destructively.
- A user can choose vertical or horizontal joining and see a matching preview.
- A user can add a valid ZIP and receive only its supported images in natural filename order.
- A malicious or oversized ZIP fails safely without freezing the main UI.
- A user can copy PNG output where supported or download PNG/JPEG otherwise.
- Removing images or leaving the page releases object URLs, ImageBitmap objects, workers, and listeners.
- The project builds as static files in `out/`.
- No user image, ZIP content, filename, or output is sent to a remote endpoint or persisted after the tab closes.

## Verification perspective

Individual functions passing their own tests does not guarantee the final
result is correct across the whole operation flow (input → transform →
layout → render → output/dispose). Guarantees about "in-between" state —
the output-size guard, allocation ordering, resource release, worker
termination — require at least one real-operation scenario exercised
end-to-end, in addition to the unit tests for the function itself.

## Review severities

- Critical: privacy breach, arbitrary external transmission, unsafe archive behavior, data corruption, or application-wide failure.
- Major: required behavior missing, incorrect image result, memory leak on a normal workflow, inaccessible core operation, or static build failure.
- Minor: recoverable usability issue, incomplete message, or maintainability issue without current incorrect behavior.

Reviewer approval requires zero unresolved critical or major findings.

