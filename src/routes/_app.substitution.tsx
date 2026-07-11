import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserX, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/substitution")({
  component: SubstitutionPage,
});

type Assignment = {
  ttId: string;
  ttName: string;
  classId: string;
  className: string;
  dayIndex: number;
  periodIndex: number;
  periodName: string;
  subjectId: string;
};

function SubstitutionPage() {
  const { data } = useStore();
  const [absentId, setAbsentId] = useState<string>("");
  const [ttId, setTtId] = useState<string>(data.timetables[0]?.id ?? "");
  const [day, setDay] = useState<string>("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const tt = data.timetables.find((t) => t.id === ttId);
  const activeDays = tt?.generated?.days ?? [];

  // Ensure a valid day is chosen for the current timetable
  const effectiveDay = day && activeDays.includes(day) ? day : activeDays[0] ?? "";

  // All assignments for the absent teacher on the chosen day, across all classes in this timetable.
  const teacherAssignments: Assignment[] = useMemo(() => {
    if (!tt?.generated || !absentId || !effectiveDay) return [];
    const g = tt.generated;
    const di = g.days.indexOf(effectiveDay);
    if (di < 0) return [];
    const out: Assignment[] = [];
    for (const cls of data.classes) {
      const dayCells = g.grid[cls.id]?.[di];
      if (!dayCells) continue;
      for (let pi = 0; pi < dayCells.length; pi++) {
        for (const c of dayCells[pi]) {
          if (c.teacherId === absentId) {
            out.push({
              ttId: tt.id,
              ttName: tt.name,
              classId: cls.id,
              className: cls.name,
              dayIndex: di,
              periodIndex: pi,
              periodName: g.periodNames[pi] ?? `P${pi + 1}`,
              subjectId: c.subjectId,
            });
          }
        }
      }
    }
    return out;
  }, [tt, absentId, effectiveDay, data.classes]);

  const selected = teacherAssignments.find(
    (a) => `${a.classId}|${a.periodIndex}` === selectedKey
  );

  // Who is BUSY at the selected slot (any class, any subject) across the timetable?
  const busyTeacherIds = useMemo(() => {
    const busy = new Set<string>();
    if (!tt?.generated || !selected) return busy;
    const { dayIndex, periodIndex } = selected;
    for (const cls of data.classes) {
      const cell = tt.generated.grid[cls.id]?.[dayIndex]?.[periodIndex];
      if (!cell) continue;
      for (const c of cell) if (c.teacherId) busy.add(c.teacherId);
    }
    return busy;
  }, [tt, selected, data.classes]);

  const freeFaculty = selected
    ? data.staff.filter((s) => s.id !== absentId && !busyTeacherIds.has(s.id))
    : [];

  const subjectName = (sid: string) => data.subjects.find((s) => s.id === sid)?.name ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
          Substitution
        </h1>
        <p className="text-muted-foreground">Cover an absent teacher — from the real generated timetable.</p>
      </div>

      <Card className="border-primary/20 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-primary" /> Manual Substitution
          </CardTitle>
          <CardDescription>
            Pick a timetable, day and absent teacher to see their real scheduled periods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Timetable</label>
              <Select
                value={ttId}
                onValueChange={(v) => {
                  setTtId(v);
                  setSelectedKey(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timetable" />
                </SelectTrigger>
                <SelectContent>
                  {data.timetables.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">No timetables yet.</div>
                  )}
                  {data.timetables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.generated ? "" : "(not generated)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Absent Teacher</label>
              <Select
                value={absentId}
                onValueChange={(v) => {
                  setAbsentId(v);
                  setSelectedKey(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {data.staff.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">No staff added yet.</div>
                  )}
                  {data.staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.shortName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Day</label>
              <Select
                value={effectiveDay}
                onValueChange={(v) => {
                  setDay(v);
                  setSelectedKey(null);
                }}
                disabled={activeDays.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {activeDays.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!tt?.generated && ttId && (
            <p className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 text-sm text-amber-900">
              This timetable hasn't been generated yet. Open it and click "Create Timetable" first.
            </p>
          )}

          {tt?.generated && absentId && (
            <div className="space-y-3">
              <div className="text-sm font-medium">
                Scheduled periods on {effectiveDay} — {teacherAssignments.length} class{teacherAssignments.length === 1 ? "" : "es"}
              </div>
              <div className="grid gap-2">
                {teacherAssignments.map((a) => {
                  const k = `${a.classId}|${a.periodIndex}`;
                  const active = selectedKey === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setSelectedKey(k)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                        active ? "border-primary bg-primary/10 shadow-sm" : "hover:bg-muted"
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {a.periodName} · {a.className}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {subjectName(a.subjectId)}
                        </div>
                      </div>
                      <Badge variant="destructive">Needs Substitution</Badge>
                    </button>
                  );
                })}
                {teacherAssignments.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No scheduled periods for this teacher on {effectiveDay}.
                  </p>
                )}
              </div>
            </div>
          )}

          {selected && (
            <Card className="bg-gradient-to-br from-primary/5 via-fuchsia-500/5 to-cyan-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Free Faculty — one-click swap
                </CardTitle>
                <CardDescription>
                  Available teachers for {selected.periodName} in {selected.className}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {freeFaculty.map((s) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toast.success(
                          `${s.name} assigned to ${selected.periodName} — ${selected.className}`
                        )
                      }
                    >
                      {s.name}
                      <Badge className="ml-2" variant="secondary">{s.shortName}</Badge>
                    </Button>
                  ))}
                  {freeFaculty.length === 0 && (
                    <p className="text-sm text-muted-foreground">No free faculty available at this slot.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
