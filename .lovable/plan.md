## Scope

Full redesign + 7 features. Given the size, I'll ship it in one coherent pass but you may need follow-up turns to refine details after you try it out. Nothing existing (staff, subjects, classes, saved timetables) will be lost — the data model is extended, not replaced.

## 1. Redesign (Sage & Cream, Urbanist/Epilogue)

- Update `src/styles.css` design tokens:
  - `--background` warm cream `#f5f0e8`, `--foreground` deep ink, `--primary` muted sage `#7d9b76`, `--secondary` `#dce5d4`, `--muted` `#f0ebe3`, `--border` soft warm gray, `--accent` `#a8c0a0`, subtle shadows.
- Install `@fontsource/urbanist` + `@fontsource/epilogue`; register in `__root.tsx`; set `--font-sans: Epilogue`, `--font-display: Urbanist`; apply display font to headings via a small utility.
- Sidebar, cards, buttons, inputs, tables get consistent rounded-lg, generous spacing, hairline borders, no heavy shadows.
- Login page refresh to match.

## 2. Feature changes

**(1) Four sections per timetable — N-3, 4-5, 6-8, 9-12**
- Add `section` field to `ClassItem` (`"N-3" | "4-5" | "6-8" | "9-12"`), default `"9-12"` for existing classes.
- Each `Lesson` already ties to a class → section derived from class. In the timetable editor and preview, add a tabbed switcher; each tab shows only classes/lessons/grid for that section. Bell schedule (periods, days) is shared across tabs, as chosen.
- PDF export groups pages by section.

**(2) Search inside subject/faculty pickers in Lessons**
- Replace plain `<Select>` in the lesson editor with `Command`-based combobox (shadcn `cmdk`) with type-to-filter.

**(3) Keep class selected after "Add Lesson"**
- Reset only subject/teacher/split/groups/frequency; leave `classId` intact.

**(4) Assembly slot in Bell Schedule**
- Add optional `assembly: { name, start, end } | null` on `Timetable`.
- In bell schedule UI, add a small "+ Add assembly" row above period 1 with time inputs; renders in preview and PDF as a pre-period row.

**(5) AI chat assistant in the editor**
- Floating panel on the right of the timetable editor.
- Backed by a `createServerFn` calling Lovable AI Gateway (`google/gemini-3-flash-preview`) via `@ai-sdk/openai-compatible`.
- The function receives the current timetable snapshot + user message and returns either a suggestion or a proposed patch (JSON diff of lessons/periods/generated grid). User clicks "Apply" to accept.
- Tool set: `move_period`, `swap_periods`, `set_preference` (e.g. "put CUET at last periods for grade 12"), `suggest_layout`. Preferences persist on the timetable so generator honors them.
- Generator update: add a soft-constraint pass reading `preferences` (e.g. subject → preferred period range for a given class/section).

**(6) Drag-and-drop editing with cross-class conflict fixing**
- In preview, cells become draggable (`@dnd-kit`). Single-cell drag, plus shift-click multi-select then drag.
- On drop: validate — teacher clash, class double-booking, subject-daily-cap. If teacher was also placed in another class at the destination slot, auto-swap them (the other class gets the vacated slot). Show a toast summarizing the ripple.
- Multi-select drop tries to preserve relative offset; if a swap chain is impossible, the drop is rejected with a reason.

**(7) Validation notifications + suggestions**
- Add a `validate(timetable)` pass: flags blank cells, teacher clashes, over-capacity days, orphan lessons.
- Non-blocking banner in the editor + a "Fix" popover per issue with a concrete suggested action (e.g. "Move MATH from Mon-P4 to Wed-P2 — teacher free, class free").

## Technical

- New/updated files (approx):
  - `src/styles.css` (theme), `src/routes/__root.tsx` (fonts).
  - `src/lib/store.ts` — extend `ClassItem` (section), `Timetable` (assembly, preferences), `GeneratedGrid` stays the same shape.
  - `src/lib/timetable-validate.ts` — new.
  - `src/lib/timetable-mutate.ts` — new, drag/swap/ripple logic.
  - `src/lib/ai-gateway.server.ts` + `src/lib/timetable-ai.functions.ts` — AI chat serverFn.
  - `src/components/ClassSectionTabs.tsx`, `SubjectCombobox.tsx`, `TeacherCombobox.tsx`, `AssemblyEditor.tsx`, `TimetableChat.tsx`, `ValidationBanner.tsx`, `DraggableCell.tsx`.
  - `src/routes/_app.timetable.$id.tsx` and `_app.timetable.$id.preview.tsx` — integrate all of the above.
  - `src/routes/_app.setup.tsx` — add "Section" field for classes (single-add + bulk template).
- Dependencies to add: `@fontsource/urbanist`, `@fontsource/epilogue`, `@dnd-kit/core`, `@dnd-kit/sortable`, `ai`, `@ai-sdk/openai-compatible`, `zod` (if not already).
- Migration: existing classes get `section = "9-12"` on first read; existing timetables get `assembly = null`, `preferences = []`. Non-destructive.
- Secrets: `LOVABLE_API_KEY` is auto-provisioned server-side; nothing for you to configure.

## Out of scope for this pass

- Persisting AI chat transcripts across reloads (kept in-memory per session).
- Undo/redo history for drag operations beyond a single "Undo" toast action.
- Reordering days.

Reply "go" to build, or tell me what to change.
