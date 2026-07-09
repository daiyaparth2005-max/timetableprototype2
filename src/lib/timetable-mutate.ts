import type { GeneratedGrid, GeneratedCell, Timetable, ClassItem } from "./store";

export type Coord = { classId: string; day: number; period: number };

/**
 * Move a single cell (single, non-split subject) from source to destination.
 * Handles cross-class ripple: if the destination slot already has this teacher
 * busy in another class, we swap that other class's cell into the source slot.
 * Returns a new grid, or an error string if impossible.
 */
export function moveCell(
  grid: GeneratedGrid,
  src: Coord,
  dst: Coord
): { ok: true; grid: GeneratedGrid; ripple?: string } | { ok: false; error: string } {
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

  // Check same-class collision on dst
  if (dstCells.length > 0 && dst.classId === src.classId) {
    // Swap within same class
    next[src.classId][src.day][src.period] = dstCells;
    next[dst.classId][dst.day][dst.period] = moving;
    return { ok: true, grid: next };
  }

  // Cross-class: check teacher conflicts at destination (excluding this dst cell)
  const movingTeachers = moving.map((c) => c.teacherId).filter(Boolean);
  let ripple: string | undefined;

  for (const cid of Object.keys(next)) {
    if (cid === dst.classId) continue;
    const cell = next[cid][dst.day][dst.period];
    for (const c of cell) {
      if (movingTeachers.includes(c.teacherId)) {
        // Teacher clash. Try to move that other class's cell into src slot (which is now empty).
        if (next[cid][src.day][src.period].length === 0 && src.classId !== cid) {
          next[cid][src.day][src.period] = next[cid][dst.day][dst.period];
          next[cid][dst.day][dst.period] = [];
          ripple = `Swapped ${cid}'s lesson to keep teacher free`;
        } else {
          return { ok: false, error: "Teacher clash — cannot auto-resolve" };
        }
      }
    }
  }

  // Same-class swap already handled above; for cross-class also swap destination content back to source
  if (dstCells.length > 0) {
    next[src.classId][src.day][src.period] = dstCells;
  }
  next[dst.classId][dst.day][dst.period] = moving;

  return { ok: true, grid: next, ripple };
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
  // Blank cells
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
            suggestion: "Add a lesson or use AI chat to suggest a fill.",
            coord: { classId: cid, day: d, period: p },
          });
        }
      }
    }
  }

  // Teacher clashes
  for (let d = 0; d < g.days.length; d++) {
    for (let p = 0; p < g.periodNames.length; p++) {
      const seenTeachers = new Map<string, string>(); // teacherId -> classId
      for (const cid of activeClassIds) {
        const cell = g.grid[cid][d][p];
        for (const c of cell) {
          if (!c.teacherId) continue;
          if (seenTeachers.has(c.teacherId)) {
            issues.push({
              kind: "teacher_clash",
              message: `Teacher double-booked on ${g.days[d]} · ${g.periodNames[p]}`,
              suggestion: "Drag one of the periods to a free slot for that teacher.",
              coord: { classId: cid, day: d, period: p },
            });
          } else {
            seenTeachers.set(c.teacherId, cid);
          }
        }
      }
    }
  }

  return issues.slice(0, 20);
}
