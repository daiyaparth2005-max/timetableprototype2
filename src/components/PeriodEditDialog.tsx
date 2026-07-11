import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { SearchCombobox } from "@/components/SearchCombobox";
import { useStore, uid, type Timetable, type GeneratedCell } from "@/lib/store";
import type { Coord } from "@/lib/timetable-mutate";
import { toast } from "sonner";

type GroupDraft = { id: string; label: string; subjectId: string; teacherId: string };

export function PeriodEditDialog({
  tt,
  coord,
  onClose,
}: {
  tt: Timetable;
  coord: Coord | null;
  onClose: () => void;
}) {
  const { data, update } = useStore();

  const g = tt.generated;
  const existing = g && coord ? g.grid[coord.classId]?.[coord.day]?.[coord.period] ?? [] : [];
  const isEmpty = existing.length === 0;

  const [split, setSplit] = useState<boolean>(existing.length > 1);
  const [subjectId, setSubjectId] = useState<string>(existing[0]?.subjectId ?? "");
  const [teacherId, setTeacherId] = useState<string>(existing[0]?.teacherId ?? "");
  const [groups, setGroups] = useState<GroupDraft[]>(
    existing.length > 1
      ? existing.map((c, i) => ({
          id: uid(),
          label: c.groupLabel || `Group ${String.fromCharCode(65 + i)}`,
          subjectId: c.subjectId,
          teacherId: c.teacherId,
        }))
      : [
          { id: uid(), label: "Group A", subjectId: "", teacherId: "" },
          { id: uid(), label: "Group B", subjectId: "", teacherId: "" },
        ]
  );
  const [frequency, setFrequency] = useState<number>(1);

  // Count how many *other* empty slots exist for this class this week — the
  // upper bound for the "apply to N free slots" feature.
  const maxFrequency = useMemo(() => {
    if (!g || !coord) return 1;
    const dayCount = g.days.length;
    const periodCount = g.periodNames.length;
    let free = 0;
    for (let d = 0; d < dayCount; d++) {
      for (let p = 0; p < periodCount; p++) {
        if (d === coord.day && p === coord.period) continue;
        const cell = g.grid[coord.classId]?.[d]?.[p];
        if (!cell || cell.length === 0) free++;
      }
    }
    return 1 + free;
  }, [g, coord]);

  if (!coord || !g) return null;

  const subjectOptions = data.subjects.map((s) => ({ id: s.id, label: s.name, sub: s.shortName }));
  const teacherOptions = data.staff.map((s) => ({ id: s.id, label: s.name, sub: s.subject || s.shortName }));

  const cls = data.classes.find((c) => c.id === coord.classId);
  const periodName = g.periodNames[coord.period];
  const dayName = g.days[coord.day];

  const canSave = split
    ? groups.every((gr) => gr.subjectId && gr.teacherId)
    : !!subjectId && !!teacherId;

  const addGroup = () =>
    setGroups((gs) => [
      ...gs,
      { id: uid(), label: `Group ${String.fromCharCode(65 + gs.length)}`, subjectId: "", teacherId: "" },
    ]);

  const buildCells = (): GeneratedCell[] => {
    if (split) {
      return groups.map((gr) => ({
        subjectId: gr.subjectId,
        teacherId: gr.teacherId,
        groupLabel: gr.label,
      }));
    }
    return [{ subjectId, teacherId }];
  };

  const save = () => {
    if (!canSave) return toast.error("Fill subject and teacher");
    const cells = buildCells();

    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => {
        if (t.id !== tt.id || !t.generated) return t;
        // Deep clone
        const grid: typeof t.generated.grid = {};
        for (const cid of Object.keys(t.generated.grid)) {
          grid[cid] = t.generated.grid[cid].map((day) => day.map((p) => p.map((c) => ({ ...c }))));
        }
        // Set the primary slot
        grid[coord.classId][coord.day][coord.period] = cells.map((c) => ({ ...c }));

        // Frequency > 1 → also fill next free slots for the same class
        let need = Math.max(0, frequency - 1);
        if (need > 0) {
          outer: for (let d = 0; d < g.days.length; d++) {
            for (let p = 0; p < g.periodNames.length; p++) {
              if (d === coord.day && p === coord.period) continue;
              const cell = grid[coord.classId]?.[d]?.[p];
              if (!cell || cell.length === 0) {
                grid[coord.classId][d][p] = cells.map((c) => ({ ...c }));
                need--;
                if (need === 0) break outer;
              }
            }
          }
        }

        // Sync back into lessons so the constraint sticks on next regenerate.
        const placed = frequency - need;
        const newLessons = [...t.lessons];
        if (split) {
          newLessons.push({
            id: uid(),
            classId: coord.classId,
            split: true,
            subjectId: "",
            teacherId: "",
            groups: groups.map((gr) => ({
              id: uid(),
              label: gr.label,
              subjectId: gr.subjectId,
              teacherId: gr.teacherId,
            })),
            frequency: placed,
          });
        } else {
          newLessons.push({
            id: uid(),
            classId: coord.classId,
            split: false,
            subjectId,
            teacherId,
            groups: [],
            frequency: placed,
          });
        }

        return {
          ...t,
          lessons: newLessons,
          generated: { ...t.generated, grid },
        };
      }),
    }));
    toast.success(frequency > 1 ? `Placed ${frequency}× in free slots` : "Period updated");
    onClose();
  };

  const clear = () => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => {
        if (t.id !== tt.id || !t.generated) return t;
        const grid: typeof t.generated.grid = {};
        for (const cid of Object.keys(t.generated.grid)) {
          grid[cid] = t.generated.grid[cid].map((day) => day.map((p) => p.map((c) => ({ ...c }))));
        }
        grid[coord.classId][coord.day][coord.period] = [];
        return { ...t, generated: { ...t.generated, grid } };
      }),
    }));
    toast.success("Cleared");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit period</DialogTitle>
          <DialogDescription>
            {cls?.name} · {dayName} · {periodName}
            {isEmpty && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">EMPTY</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Switch id="split-edit" checked={split} onCheckedChange={setSplit} />
            <Label htmlFor="split-edit" className="cursor-pointer">Split into Groups</Label>
          </div>

          {!split ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Subject</Label>
                <SearchCombobox
                  value={subjectId}
                  onChange={setSubjectId}
                  options={subjectOptions}
                  placeholder="Search subject…"
                />
              </div>
              <div>
                <Label>Faculty</Label>
                <SearchCombobox
                  value={teacherId}
                  onChange={setTeacherId}
                  options={teacherOptions}
                  placeholder="Search teacher…"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((gr) => (
                <div key={gr.id} className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[100px_1fr_1fr_auto]">
                  <Input
                    value={gr.label}
                    onChange={(e) =>
                      setGroups((gs) => gs.map((x) => (x.id === gr.id ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  <SearchCombobox
                    value={gr.subjectId}
                    onChange={(v) => setGroups((gs) => gs.map((x) => (x.id === gr.id ? { ...x, subjectId: v } : x)))}
                    options={subjectOptions}
                    placeholder="Subject"
                  />
                  <SearchCombobox
                    value={gr.teacherId}
                    onChange={(v) => setGroups((gs) => gs.map((x) => (x.id === gr.id ? { ...x, teacherId: v } : x)))}
                    options={teacherOptions}
                    placeholder="Teacher"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setGroups((gs) => gs.filter((x) => x.id !== gr.id))}
                    disabled={groups.length <= 2}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addGroup}>
                <Plus className="mr-1 h-4 w-4" /> Add Group
              </Button>
            </div>
          )}

          <div>
            <Label>
              Frequency this week{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (max {maxFrequency} — this slot + {maxFrequency - 1} free)
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={maxFrequency}
                value={frequency}
                onChange={(e) => setFrequency(Math.max(1, Math.min(maxFrequency, Number(e.target.value) || 1)))}
                className="w-24"
              />
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: frequency }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-7 w-9 items-center justify-center rounded bg-gradient-to-br from-primary/20 to-fuchsia-500/20 text-[10px] font-semibold text-primary"
                  >
                    1P
                  </div>
                ))}
              </div>
            </div>
            {frequency > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Will auto-fill {frequency - 1} more empty slot{frequency - 1 === 1 ? "" : "s"} for this class and save as a lesson constraint.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {!isEmpty && (
            <Button variant="ghost" size="sm" onClick={clear} className="text-destructive">
              <Trash2 className="mr-1 h-4 w-4" /> Clear slot
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={!canSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
