import type { GeneratedGrid, Timetable, ClassItem } from "./store";

export type Coord = { classId: string; day: number; period: number };

export type MoveResult =
  | { ok: true; grid: GeneratedGrid; ripple?: string }
  | { ok: false; error: string }
  | {
      ok: false;
      needsCombineConfirm: true;
      conflictClassIds: string[];
      teacherIds: string[];
    };

/**
 * Move a single cell (single, non-split subject) from source to destination.
 * If moving would place the same teacher in another class at the same slot,
 * the caller can retry with { combine: true } to explicitly co-schedule
 * both classes (shared teacher across multiple classes at the same time).
 */
export function moveCell(
  grid: GeneratedGrid,
  src: Coord,
  dst: Coord,
  opts: { combine?: boolean } = {}
): MoveResult {
  if (src.classId === dst.classId && src.day === dst.day && src.period === dst.period) {
    return { ok: true, grid };
  }
  const srcCells = grid[src.classId]?.[src.day]?.[src.period];
  if (!srcCells || srcCells.length === 0) return { ok: false, error: "No lesson at source" };

  // Deep clone grid
  const next: GeneratedGrid = {};
  for (const cid of Object.keys(grid)) {
    next[cid] = grid[cid].map((day) => day.map((p) => p.map((c) => ({ ...c }))));
  }

  const moving = next[src.classId][src.day][src.period];
  next[src.classId][src.day][src.period] = [];

  const dstCells = next[dst.classId][dst.day][dst.period];

  // Same-class swap
  if (dst.classId === src.classId) {
    next[src.classId][src.day][src.period] = dstCells;
    next[dst.classId][dst.day][dst.period] = moving;
    return { ok: true, grid: next };
  }

  // Cross-class: detect teacher clash with any *other* class at dst
  const movingTeachers = moving.map((c) => c.teacherId).filter(Boolean);
  const conflictClasses: string[] = [];
  const conflictTeachers = new Set<string>();

  for (const cid of Object.keys(next)) {
    if (cid === dst.classId) continue;
    if (cid === src.classId) continue;
    const cell = next[cid][dst.day][dst.period];
    for (const c of cell) {
      if (movingTeachers.includes(c.teacherId)) {
        conflictClasses.push(cid);
        conflictTeachers.add(c.teacherId);
      }
    }
  }

  if (conflictClasses.length > 0 && !opts.combine) {
    return {
      ok: false,
      needsCombineConfirm: true,
      conflictClassIds: Array.from(new Set(conflictClasses)),
      teacherIds: Array.from(conflictTeachers),
    };
  }

  // If combine requested: tag every affected cell (moving + all conflicts) with a shared id
  if (opts.combine && conflictClasses.length > 0) {
    const combinedId = `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    for (const c of moving) c.combinedId = combinedId;
    for (const cid of conflictClasses) {
      for (const c of next[cid][dst.day][dst.period]) {
        if (movingTeachers.includes(c.teacherId)) c.combinedId = combinedId;
      }
    }
  }

  // Swap destination content back to source (if any)
  if (dstCells.length > 0) {
    next[src.classId][src.day][src.period] = dstCells;
  }
  next[dst.classId][dst.day][dst.period] = moving;

  return {
    ok: true,
    grid: next,
    ripple: opts.combine ? `Combined with ${conflictClasses.length} other class${conflictClasses.length === 1 ? "" : "es"}` : undefined,
  };
}

export type ValidationIssue = {
  kind: "blank" | "teacher_clash" | "class_double";
  message: string;
  suggestion?: string;
  coord?: Coord;
};

export function validateGenerated(tt: Timetable, classes: ClassItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const g = tt.generated;
  if (!g) return issues;

  const activeClassIds = classes.map((c) => c.id).filter((id) => g.grid[id]);

  for (const cid of activeClassIds) {
    const cls = classes.find((c) => c.id === cid);
    if (!cls) continue;
    for (let d = 0; d < g.days.length; d++) {
      for (let p = 0; p < g.periodNames.length; p++) {
        const cell = g.grid[cid][d][p];
        if (!cell || cell.length === 0) {
          issues.push({
            kind: "blank",
            message: `${cls.name} · ${g.days[d]} · ${g.periodNames[p]} is empty`,
            suggestion: "Add a lesson or drag one in from another slot.",
            coord: { classId: cid, day: d, period: p },
          });
        }
      }
    }
  }

  for (let d = 0; d < g.days.length; d++) {
    for (let p = 0; p < g.periodNames.length; p++) {
      const seenTeachers = new Map<string, { classId: string; combinedId?: string }>();
      for (const cid of activeClassIds) {
        const cell = g.grid[cid][d][p];
        for (const c of cell) {
          if (!c.teacherId) continue;
          const prev = seenTeachers.get(c.teacherId);
          if (prev) {
            // Skip if both cells are marked as combined with the same id
            if (prev.combinedId && c.combinedId && prev.combinedId === c.combinedId) continue;
            issues.push({
              kind: "teacher_clash",
              message: `Teacher double-booked on ${g.days[d]} · ${g.periodNames[p]}`,
              suggestion: "Drag one to a free slot, or combine the classes if intentional.",
              coord: { classId: cid, day: d, period: p },
            });
          } else {
            seenTeachers.set(c.teacherId, { classId: cid, combinedId: c.combinedId });
          }
        }
      }
    }
  }

  return issues.slice(0, 20);
}
