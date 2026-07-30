# Spec 69 — A file picker that looks like Airrow

> **In one sentence:** Replace the native `<input type="file">` in the import flow with a
> design-system dropzone that supports drag-and-drop, shows what was chosen, and treats empty /
> selected / error as real states.

|                |                                                        |
| -------------- | ------------------------------------------------------ |
| **Status**     | ✅ Done                                                |
| **Issue**      | #69 — "Snyggare filväljare i importflödet — ersätt native \"Browse… No file selected\"" |
| **Branch**     | `69-import-file-picker` (from `feature/import-existing-projects`) |
| **Feature**    | Import existing projects                               |
| **Depends on** | [63 — Import existing projects](63-import-existing-projects.md) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **founder with an existing codebase** I want **a file picker that looks and behaves like the rest
of Airrow — drop a zip on it, see what I picked, change my mind** so that **the first screen I meet
feels like a product I can trust with my code, not a browser dialog.**

---

## Background

_How things work today and what's wrong with that._

- **Today:** [ImportForm.tsx:91-111](apps/web/src/features/import/ImportForm.tsx#L91-L111) renders the
  archive field as `<Input type="file" …>` — the shared input styled for text, wrapping the browser's
  native control. The chosen `File` is already lifted into component state
  ([ImportForm.tsx:26](apps/web/src/features/import/ImportForm.tsx#L26)) because the merged download
  needs it after submit.
- **The problem:** the native control renders as a grey "Browse… / Choose File" button plus
  "No file selected" — wording and appearance vary by browser and locale, it ignores the design
  tokens, offers no drag-and-drop, and never confirms the filename or size.
- **Empty / selected / error are not real states** (constitution §III): the empty state is the
  browser's own text, and the error state is a sentence of prose at
  [ImportForm.tsx:101-103](apps/web/src/features/import/ImportForm.tsx#L101-L103) explaining that the
  field cleared itself.
- **Already in place:** the design system (`apps/web/src/components/ui/`, incl. `label.tsx`,
  `states.tsx`, `input.tsx`), the server action and its Zod validation
  ([actions.ts](apps/web/src/features/import/actions.ts)), and the `archive` File already held in
  React state.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Add a reusable `FileDropzone` to `apps/web/src/components/ui/` that keeps a real, visually hidden
`<input type="file" name="archive" required>` as the form control — so `FormData` reaches the server
byte-for-byte unchanged — and layers a token-styled, keyboard-reachable drop target over it. A drop
hands the event's own `DataTransfer.files` straight to that input (`input.files = …`), which is the
only legal way a file reaches it; no `DataTransfer` is constructed. The three states (empty, selected,
error) are separate components chosen by one exhaustive switch over a discriminated union, not
conditionals sprinkled through JSX.

It lives in `apps/web/src/components/ui/file-dropzone.tsx` as a generic control (props for `name`,
`accept`, label and error), not in the import feature. §I's "an abstraction is earned by ≥2 uses"
argues for the feature folder while there is only one caller — we go with `components/ui` anyway: a
file picker is design-system material rather than import logic, and issue #69 asks for it there
explicitly. Nothing import-specific may leak in.

A drop that isn't a `.zip` is **refused by the control**: no file is selected and the control enters
its error state ("That isn't a .zip archive"). Drag-and-drop bypasses the `accept` filter that
clicking honours, so this only restores parity with the click path — it is an affordance, not a rule.
The server's Zod validation remains the one that decides, unchanged.

**Not touched:** the server action, the Zod schema, the 50 MB / 5,000-file limits, the ignore list,
and the archive-cache flow after submit. No business validation moves to the client.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] The control is built entirely from design-system tokens (color, radius, spacing, type) and reads
      correctly in light and dark mode — no hardcoded hex or px in the component.
- [x] Clicking the control opens the file dialog **and** dragging an archive onto it selects that file,
      with a distinct hover state and a distinct drag-over state.
- [x] When a file is selected the control shows its **name and size**, with an affordance to replace it
      and one to remove it.
- [x] Empty, selected and error are rendered as discrete states from a single state value — not
      conditionals scattered through JSX (§III).
- [x] The form behaves exactly as today: the field is still named `archive`, `required` still applies,
      and the server receives the same `FormData`. No validation moves to the client.
- [x] Keyboard and screen-reader accessible: the control is focusable with a visible focus ring, the
      hint text is wired via `aria-describedby`, and the selected filename is announced when it changes.
- [x] After a rejected import, the control itself renders in its error state — error tokens on the
      border/icon plus "Choose your archive again" — replacing today's prose line under the field.
- [x] A dropped file that isn't a `.zip` is refused: nothing is selected, and the control says so in
      its error state.
- [x] Dropping several files at once selects nothing and says "Drop one archive at a time."
- [x] The component lives in `apps/web/src/components/ui/` and is generic enough to reuse; nothing
      import-specific leaks into it (§III reuse-before-create).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — [file-dropzone.test.tsx](apps/web/src/components/ui/file-dropzone.test.tsx), 12
  cases, all green: the field keeps `name`/`required`/`accept`; empty → selected → removed; name and
  size shown; a drop selects the file and hands the `FileList` to the input; a non-`.zip` drop and a
  multi-file drop each select nothing and render the matching refusal; an `error` prop renders as
  `role="alert"`, survives a repeated submit, and yields to a fresh choice; the hint is the field's
  accessible description; the filename reaches the live region.
- **No existing test to update** — the import form has no test today
  ([features/import/](apps/web/src/features/import/) covers `archive`, `digest`, `archive-cache` and
  `MergedDownload` only), so the new dropzone tests are the whole of this spec's coverage.
- Token-only styling: every class in the component is a token utility (`border-border-strong`,
  `bg-accent-soft`, `text-danger`, `rounded-lg`) — no hex, no arbitrary values. Both themes derive
  from the same names, so light mode follows.
- **Manual check — done** (2026-07-27, dev server on `/app/projects/import`). The three things no
  test can reach were confirmed in a real browser: the drag-and-drop handover to `input.files`, the
  control in both themes with its hover and drag-over treatments, and the focus ring on the zone
  when the visually hidden input takes focus. Everything else is proven by the suite below.
- Full suite result + typecheck/lint status — see _Implementation notes_.

### Implementation notes

- **`input.files` is only assignable a real `FileList`, and jsdom can build none.** The drop path
  therefore hands over `event.dataTransfer.files` untouched (no `new DataTransfer()`, which jsdom
  also lacks). The test observes the handover at the property setter rather than reading it back —
  the assignment itself is browser plumbing, covered by the manual check above.
- **A native file input is not a drop target here.** The visible zone is a `<label>`, so clicking is
  the browser's job (no JS), while `dragenter`/`dragover`/`dragleave`/`drop` live on the wrapper.
  A depth counter keeps the drag-over state from flickering as the pointer crosses children.
- **The selection is dropped when the form resets, not when the error text changes.** `/analyze`
  caught the first attempt getting this wrong: it compared the incoming `error` string against the
  last one, and [ImportForm.tsx:107](apps/web/src/features/import/ImportForm.tsx#L107) passes a
  *constant* string — so a second consecutive failure (same 60 MB archive, same message) changed
  nothing, no reset fired, and the control went on naming a file the browser had already discarded.
  The control now watches the falling edge of `useFormStatus().pending`, which is the actual cause:
  React empties uncontrolled fields once the action settles. An external `error` is pure render
  precedence — shown when nothing is chosen, superseded the moment the founder picks again.
  Regression test: _"stops naming a file once the submit has emptied the field — every time, not
  just the first"_, confirmed failing against the pre-fix component.
- **Refusal copy is parameterised** (`noun`, default `"file"`), so the generic component says "Drop
  one file at a time" and the import form, passing `noun="archive"`, says "Drop one archive at a
  time" — the wording in the criteria above.
- **Verification run:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` 147/147
  across 29 files · `pnpm test:scripts` 13/13. No pre-existing test failures.
- **`pnpm build` fails on this branch and on `feature/import-existing-projects` alike** — the same
  `SyntaxError: Unexpected end of JSON input` while exporting `/_not-found`, reproduced with these
  changes stashed. Pre-existing and unrelated; not in this spec's scope, worth its own issue.
- **Docs:** [`UI_ARCHITECTURE.md`](docs/architecture/UI_ARCHITECTURE.md) lists every `components/ui`
  file, so `file-dropzone` was added to that inventory in the same change (§IV).

---

## Exact changes (file:line)

_As built._

1. **[`apps/web/src/components/ui/file-dropzone.tsx`](apps/web/src/components/ui/file-dropzone.tsx)**
   (new, 300 lines) — `FileDropzone`, plus the `DropzoneState` union and the three zones it dispatches
   to (`ChoiceZone` for empty and error, `SelectedZone`). `fileSize`, `matchesAccept` and `refuseDrop`
   are file-local pure helpers; `Button` is reused for Replace/Remove.
2. **[`apps/web/src/features/import/ImportForm.tsx:91-111`](apps/web/src/features/import/ImportForm.tsx#L91)**
   — the `<Input type="file">` block becomes `<FileDropzone id="archive" name="archive" noun="archive">`;
   the limits hint moves into its `hint` prop (so `aria-describedby` wires it), and the "choose your
   archive again" prose becomes the `error` prop. `setArchive` is now the `onFileChange` callback.
   The file header comment is corrected to match.
3. **[`apps/web/src/components/ui/file-dropzone.test.tsx`](apps/web/src/components/ui/file-dropzone.test.tsx)**
   (new) — the 12 cases above.
4. **[`docs/architecture/UI_ARCHITECTURE.md`](docs/architecture/UI_ARCHITECTURE.md)** — `file-dropzone`
   added to the component inventory, with a line on why the native input survives inside it.
5. **`specs/README.md`** — registered in the status table.

**No change needed:** `actions.ts`, the archive parsing in `packages/engine`, and `archive-cache.ts` —
the submitted `FormData` is identical.

---

## Data model

**No schema changes.**

---

## Security

The control is presentational and client-side only; the archive still crosses one boundary — the
existing server action, where the same Zod validation and the 50 MB / 5,000-file limits apply
unchanged. Filenames are rendered as text, never as markup, so a hostile archive name cannot inject.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Multiple files dropped at once → nothing is selected; the control shows "Drop one archive at a
  time." Silently taking the first would make the choice depend on drop order, which the founder
  can't see.
- A folder dropped instead of an archive → treated like any non-`.zip` drop: refused with the same
  error state, never silently accepted.
- A non-`.zip` file dropped (drag-and-drop bypasses the `accept` filter) → refused; the control says
  "That isn't a .zip archive" and keeps the previous selection cleared.
- A very long filename → truncates without breaking the layout; the full name stays available (title
  attribute or wrap).
- A 0-byte file → shows as "0 B" selected; the server rejects it as it does today.
- Drag cancelled (leaves the drop target) → the drag-over state clears; no file selected.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Uploading a folder instead of an archive.
- Changing the limits (50 MB / 5,000 files) or the ignore list.
- An upload progress indicator — a separate change if it turns out to be needed.
- Reusing the dropzone anywhere else in the app in this change; it just has to be general enough to.
