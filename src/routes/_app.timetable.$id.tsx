import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStore,
  uid,
  type Period,
  type Lesson,
  type LessonGroup,
  type GeneratedGrid,
  type GeneratedCell,
  type Assembly,
} from "@/lib/store";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Plus,
  Trash2,
  Coffee,
  Edit3,
  Sunrise,
  X,
  Pencil,
} from "lucide-react";
import { SearchCombobox } from "@/components/SearchCombobox";
import { TimetableChat } from "@/components/TimetableChat";
import { TimetableGrid } from "@/components/TimetableGrid";
import { validateGenerated } from "@/lib/timetable-mutate";

export const Route = createFileRoute("/_app/timetable/$id")({
  component: WizardPage,
});


const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = ((total % 60) + 60) % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function sectionOf(section?: SectionKey): SectionKey {
  return section ?? "9-12";
}

function WizardPage() {
  const { id } = Route.useParams();
  const { data, update } = useStore();
  const navigate = useNavigate();
  const tt = data.timetables.find((t) => t.id === id);

  if (!tt) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Timetable not found</CardTitle></CardHeader>
          <CardContent>
            <Button asChild><Link to="/timetable">Back to list</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const issues = tt.generated ? validateGenerated(tt, data.classes) : [];

  const rename = (name: string) =>
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, name } : t)),
    }));

  return (
    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/timetable" })}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="flex-1">
            <Input
              value={tt.name}
              onChange={(e) => rename(e.target.value)}
              className="h-10 max-w-md border-transparent bg-transparent px-1 text-2xl font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
            />
            <p className="text-sm text-muted-foreground">Design your weekly schedule</p>
          </div>
        </div>

        {issues.length > 0 && <IssuesBanner issues={issues} />}

        <BellSchedule id={id} />
        <LessonsStep id={id} />
        <GenerateStep id={id} />
      </div>

      <div className="space-y-6 lg:sticky lg:top-16 lg:self-start">
        <TimetableChat tt={tt} />
      </div>
    </div>
  );
}

function IssuesBanner({ issues }: { issues: ReturnType<typeof validateGenerated> }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/30">
      <CardContent className="py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2 text-sm">
            <CircleAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <span className="font-medium">{issues.length} issue{issues.length === 1 ? "" : "s"} in generated timetable</span>
            <span className="text-muted-foreground">— {issues[0].message}</span>
          </div>
          <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show all"}</span>
        </button>
        {open && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {issues.map((i, idx) => (
              <li key={idx} className="rounded-md bg-background/70 p-2">
                <div className="font-medium">{i.message}</div>
                {i.suggestion && <div className="text-xs text-muted-foreground">💡 {i.suggestion}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function GenerateStep({ id }: { id: string }) {
  const { data, update } = useStore();
  const tt = data.timetables.find((t) => t.id === id)!;

  const canGenerate = tt.days.length > 0 && tt.periods.length > 0 && tt.lessons.length > 0;

  const generate = () => {
    const days = [...tt.days];
    const periods = tt.periods;
    const P = periods.length;
    const D = days.length;

    const grid: GeneratedGrid = {};
    for (const c of data.classes) {
      grid[c.id] = Array.from({ length: D }, () => Array.from({ length: P }, () => [] as GeneratedCell[]));
    }

    const teacherBusy = new Set<string>();
    const classBusy = new Set<string>();
    const key = (d: number, p: number, t: string) => `${d}|${p}|${t}`;
    const cKey = (c: string, d: number, p: number) => `${c}|${d}|${p}`;

    const teachersOf = (l: Lesson) => (l.split ? l.groups.map((g) => g.teacherId) : [l.teacherId]);
    const canPlace = (l: Lesson, d: number, p: number) => {
      if (classBusy.has(cKey(l.classId, d, p))) return false;
      return !teachersOf(l).some((t) => t && teacherBusy.has(key(d, p, t)));
    };
    const doPlace = (l: Lesson, d: number, p: number) => {
      if (l.split) {
        for (const g of l.groups) {
          grid[l.classId][d][p].push({ subjectId: g.subjectId, teacherId: g.teacherId, groupLabel: g.label });
          if (g.teacherId) teacherBusy.add(key(d, p, g.teacherId));
        }
      } else {
        grid[l.classId][d][p].push({ subjectId: l.subjectId, teacherId: l.teacherId });
        if (l.teacherId) teacherBusy.add(key(d, p, l.teacherId));
      }
      classBusy.add(cKey(l.classId, d, p));
    };

    const lessons = [...tt.lessons].sort((a, b) => b.frequency - a.frequency);
    const unplaced: string[] = [];

    for (const l of lessons) {
      if (!grid[l.classId]) continue;
      const freq = l.frequency;
      if (freq <= 0) continue;

      const perDay = D > 0 ? Math.floor(freq / D) : 0;
      const extras = freq - perDay * D;
      let placed = 0;

      if (perDay > 0) {
        let chosen = -1;
        for (let p0 = 0; p0 + perDay <= P; p0++) {
          let allDaysOk = true;
          for (let d = 0; d < D && allDaysOk; d++) {
            for (let k = 0; k < perDay; k++) {
              if (!canPlace(l, d, p0 + k)) { allDaysOk = false; break; }
            }
          }
          if (allDaysOk) { chosen = p0; break; }
        }
        if (chosen >= 0) {
          for (let d = 0; d < D; d++) {
            for (let k = 0; k < perDay; k++) doPlace(l, d, chosen + k);
            placed += perDay;
          }
        } else {
          for (let d = 0; d < D; d++) {
            let found = -1;
            for (let p0 = 0; p0 + perDay <= P; p0++) {
              let ok = true;
              for (let k = 0; k < perDay; k++) {
                if (!canPlace(l, d, p0 + k)) { ok = false; break; }
              }
              if (ok) { found = p0; break; }
            }
            if (found >= 0) {
              for (let k = 0; k < perDay; k++) doPlace(l, d, found + k);
              placed += perDay;
            }
          }
        }
      }

      const remainingDays = extras > 0 ? extras : (perDay === 0 ? freq : 0);
      const dayOrder = Array.from({ length: D }, (_, i) => i);
      let need = remainingDays;
      for (const d of dayOrder) {
        if (need <= 0) break;
        for (let p = 0; p < P; p++) {
          if (canPlace(l, d, p)) {
            doPlace(l, d, p);
            placed++;
            need--;
            break;
          }
        }
      }

      if (placed < freq) {
        const cls = data.classes.find((c) => c.id === l.classId)?.name ?? "class";
        unplaced.push(`${cls}: placed ${placed}/${freq}`);
      }
    }

    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) =>
        t.id === id
          ? { ...t, generated: { grid, days, periodNames: periods.map((p) => p.name), createdAt: Date.now() } }
          : t
      ),
    }));

    if (unplaced.length) {
      toast.warning(`Timetable created with conflicts: ${unplaced.join(", ")}`);
    } else {
      toast.success("Timetable generated successfully");
    }
  };

  const clear = () => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, generated: null } : t)),
    }));
  };

  const subjectShort = (sid: string) => data.subjects.find((s) => s.id === sid)?.shortName ?? "—";
  const teacherShort = (tid: string) => data.staff.find((s) => s.id === tid)?.shortName ?? "—";

  const [activeSection, setActiveSection] = useState<SectionKey>("9-12");
  const sectionClasses = data.classes.filter((c) => sectionOf(c.section) === activeSection);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Create Timetable</CardTitle>
          <CardDescription>Generate the schedule from your bell schedule and lessons.</CardDescription>
        </div>
        <div className="flex gap-2">
          {tt.generated && (
            <Button variant="outline" size="sm" onClick={clear}>Clear</Button>
          )}
          <Button onClick={generate} disabled={!canGenerate}>
            <Check className="mr-1 h-4 w-4" /> {tt.generated ? "Regenerate" : "Create Timetable"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canGenerate && (
          <p className="text-sm text-muted-foreground">
            Add active days, periods, and at least one lesson to enable generation.
          </p>
        )}

        {tt.generated && (
          <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionKey)}>
            <TabsList>
              {SECTIONS.map((s) => (
                <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
              ))}
            </TabsList>
            {SECTIONS.map((sec) => (
              <TabsContent key={sec} value={sec} className="mt-4">
                {(() => {
                  const g = tt.generated!;
                  const classesWith = sectionClasses.filter((c) => g.grid[c.id]?.some((day) => day.some((p) => p.length > 0)));
                  if (classesWith.length === 0) {
                    return <p className="text-sm text-muted-foreground">No classes in this section have a schedule yet.</p>;
                  }
                  return (
                    <div className="space-y-6">
                      {classesWith.map((c) => (
                        <div key={c.id} className="space-y-2">
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[640px] text-xs">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="p-2 text-left">Day</th>
                                  {tt.assembly && <th className="p-2 text-left text-primary">{tt.assembly.name}</th>}
                                  {g.periodNames.map((pn, i) => (
                                    <th key={i} className="p-2 text-left">{pn}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {g.days.map((day, di) => (
                                  <tr key={day} className="border-t">
                                    <td className="p-2 font-medium">{day}</td>
                                    {tt.assembly && (
                                      <td className="p-1 align-top">
                                        <div className="rounded bg-accent/30 p-1.5 text-[10px] leading-tight text-foreground/70">
                                          {tt.assembly.start}–{tt.assembly.end}
                                        </div>
                                      </td>
                                    )}
                                    {g.grid[c.id][di].map((cells, pi) => (
                                      <td key={pi} className="p-1 align-top">
                                        {cells.length === 0 ? (
                                          <div className="h-full min-h-[40px] rounded bg-muted/30" />
                                        ) : (
                                          <div className="space-y-1">
                                            {cells.map((cell, ci) => (
                                              <div key={ci} className="rounded bg-primary/10 p-1.5 leading-tight text-primary">
                                                {cell.groupLabel && (
                                                  <div className="text-[10px] font-semibold opacity-80">{cell.groupLabel}</div>
                                                )}
                                                <div className="font-semibold">{subjectShort(cell.subjectId)}</div>
                                                <div className="text-[10px] opacity-80">{teacherShort(cell.teacherId)}</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function AssemblyRow({ id }: { id: string }) {
  const { data, update } = useStore();
  const tt = data.timetables.find((t) => t.id === id)!;
  const asm = tt.assembly ?? null;

  const setAssembly = (a: Assembly | null) =>
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, assembly: a } : t)),
    }));

  if (!asm) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAssembly({ name: "Assembly", start: "07:45", end: "08:00" })}
      >
        <Sunrise className="mr-1 h-3.5 w-3.5" /> Add Assembly (before Period 1)
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/20 p-2 text-sm">
      <Sunrise className="h-4 w-4 text-primary" />
      <Input
        value={asm.name}
        onChange={(e) => setAssembly({ ...asm, name: e.target.value })}
        className="h-8 w-32"
      />
      <Input
        type="time"
        value={asm.start}
        onChange={(e) => setAssembly({ ...asm, start: e.target.value })}
        className="h-8 w-28"
      />
      <Input
        type="time"
        value={asm.end}
        onChange={(e) => setAssembly({ ...asm, end: e.target.value })}
        className="h-8 w-28"
      />
      <Button size="sm" variant="ghost" onClick={() => setAssembly(null)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function BellSchedule({ id }: { id: string }) {
  const { data, update } = useStore();
  const tt = data.timetables.find((t) => t.id === id)!;

  const toggleDay = (d: string) => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) =>
        t.id === id
          ? { ...t, days: t.days.includes(d) ? t.days.filter((x) => x !== d) : [...t.days, d] }
          : t
      ),
    }));
  };

  const addPeriod = () => {
    const last = tt.periods[tt.periods.length - 1];
    const start = last ? (last.breakAfter ? last.breakAfter.end : last.end) : "08:00";
    const end = addMinutes(start, 45);
    const p: Period = { id: uid(), name: `Period ${tt.periods.length + 1}`, start, end, breakAfter: null };
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, periods: [...t.periods, p] } : t)),
    }));
  };

  const updatePeriod = (pid: string, patch: Partial<Period>) => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) =>
        t.id === id ? { ...t, periods: t.periods.map((p) => (p.id === pid ? { ...p, ...patch } : p)) } : t
      ),
    }));
  };

  const removePeriod = (pid: string) => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) =>
        t.id === id ? { ...t, periods: t.periods.filter((p) => p.id !== pid) } : t
      ),
    }));
  };

  const snapAll = () => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => {
        if (t.id !== id) return t;
        let cursor = t.periods[0]?.start ?? "08:00";
        const next = t.periods.map((p, i) => {
          const start = i === 0 ? p.start : cursor;
          const durMins = Math.max(toMin(p.end) - toMin(p.start), 30);
          const end = addMinutes(start, durMins);
          const brkDur = p.breakAfter ? Math.max(toMin(p.breakAfter.end) - toMin(p.breakAfter.start), 5) : 0;
          cursor = p.breakAfter ? addMinutes(end, brkDur) : end;
          const brk = p.breakAfter ? { ...p.breakAfter, start: end, end: cursor } : null;
          return { ...p, start, end, breakAfter: brk };
        });
        return { ...t, periods: next };
      }),
    }));
    toast.success("Times snapped");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bell Schedule</CardTitle>
        <CardDescription>Weekly cycle. Pick active days, add periods, and optionally an assembly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="mb-2 block">Active Days</Label>
          <div className="flex flex-wrap gap-2">
            {WEEK.map((d) => {
              const active = tt.days.includes(d);
              return (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${active ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                >
                  <Checkbox checked={active} onCheckedChange={() => toggleDay(d)} />
                  <span className="text-sm">{d}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Periods</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={snapAll} disabled={tt.periods.length < 2}>
                Snap times
              </Button>
              <Button size="sm" onClick={addPeriod}>
                <Plus className="mr-1 h-4 w-4" /> Add Period
              </Button>
            </div>
          </div>

          <AssemblyRow id={id} />

          {tt.periods.length === 0 && (
            <p className="text-sm text-muted-foreground">No periods yet. Add your first period.</p>
          )}
          <div className="space-y-2">
            {tt.periods.map((p) => (
              <div key={p.id} className="rounded-lg border bg-card p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <Input
                    value={p.name}
                    onChange={(e) => updatePeriod(p.id, { name: e.target.value })}
                    placeholder="Period name"
                  />
                  <Input
                    type="time"
                    value={p.start}
                    onChange={(e) => updatePeriod(p.id, { start: e.target.value })}
                    className="w-32"
                  />
                  <Input
                    type="time"
                    value={p.end}
                    onChange={(e) => updatePeriod(p.id, { end: e.target.value })}
                    className="w-32"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removePeriod(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2">
                  {p.breakAfter ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
                      <Coffee className="h-4 w-4 text-amber-600" />
                      <Input
                        value={p.breakAfter.name}
                        onChange={(e) => updatePeriod(p.id, { breakAfter: { ...p.breakAfter!, name: e.target.value } })}
                        className="h-8 w-32"
                      />
                      <Input
                        type="time"
                        value={p.breakAfter.start}
                        onChange={(e) => updatePeriod(p.id, { breakAfter: { ...p.breakAfter!, start: e.target.value } })}
                        className="h-8 w-28"
                      />
                      <Input
                        type="time"
                        value={p.breakAfter.end}
                        onChange={(e) => updatePeriod(p.id, { breakAfter: { ...p.breakAfter!, end: e.target.value } })}
                        className="h-8 w-28"
                      />
                      <Button size="sm" variant="ghost" onClick={() => updatePeriod(p.id, { breakAfter: null })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updatePeriod(p.id, { breakAfter: { name: "Break", start: p.end, end: addMinutes(p.end, 15) } })
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Break
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LessonsStep({ id }: { id: string }) {
  const { data, update } = useStore();
  const tt = data.timetables.find((t) => t.id === id)!;

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [split, setSplit] = useState(false);
  const [groups, setGroups] = useState<LessonGroup[]>([
    { id: uid(), label: "Group A", subjectId: "", teacherId: "" },
    { id: uid(), label: "Group B", subjectId: "", teacherId: "" },
  ]);
  const [frequency, setFrequency] = useState(6);

  const addGroup = () =>
    setGroups((g) => [
      ...g,
      { id: uid(), label: `Group ${String.fromCharCode(65 + g.length)}`, subjectId: "", teacherId: "" },
    ]);
  const removeGroup = (gid: string) => setGroups((g) => g.filter((x) => x.id !== gid));
  const updateGroup = (gid: string, patch: Partial<LessonGroup>) =>
    setGroups((g) => g.map((x) => (x.id === gid ? { ...x, ...patch } : x)));

  const noSetup = data.classes.length === 0 || data.subjects.length === 0 || data.staff.length === 0;
  const canSave =
    !!classId && (split ? groups.every((g) => g.subjectId && g.teacherId) : !!subjectId && !!teacherId);

  const subjectOptions = data.subjects.map((s) => ({ id: s.id, label: s.name, sub: s.shortName }));
  const teacherOptions = data.staff.map((s) => ({
    id: s.id,
    label: s.name,
    sub: s.subject || s.shortName,
  }));
  const classOptions = data.classes.map((c) => ({
    id: c.id,
    label: c.name,
    sub: sectionOf(c.section),
  }));

  const save = () => {
    if (!canSave) return toast.error("Complete all fields");
    const lesson: Lesson = {
      id: uid(),
      classId,
      split,
      subjectId: split ? "" : subjectId,
      teacherId: split ? "" : teacherId,
      groups: split ? groups.map((g) => ({ ...g })) : [],
      frequency,
    };
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, lessons: [...t.lessons, lesson] } : t)),
    }));
    // Keep class selected — only reset the rest.
    setSubjectId("");
    setTeacherId("");
    setSplit(false);
    setFrequency(6);
    setGroups([
      { id: uid(), label: "Group A", subjectId: "", teacherId: "" },
      { id: uid(), label: "Group B", subjectId: "", teacherId: "" },
    ]);
    toast.success("Lesson added");
  };

  const removeLesson = (lid: string) =>
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) =>
        t.id === id ? { ...t, lessons: t.lessons.filter((l) => l.id !== lid) } : t
      ),
    }));

  const className = (cid: string) => data.classes.find((c) => c.id === cid)?.name ?? "—";
  const subjectName = (sid: string) => data.subjects.find((s) => s.id === sid)?.name ?? "—";
  const teacherName = (tid: string) => data.staff.find((s) => s.id === tid)?.name ?? "—";

  const [sectionFilter, setSectionFilter] = useState<SectionKey | "all">("all");
  const filteredLessons =
    sectionFilter === "all"
      ? tt.lessons
      : tt.lessons.filter((l) => {
          const c = data.classes.find((x) => x.id === l.classId);
          return sectionOf(c?.section) === sectionFilter;
        });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lessons</CardTitle>
        <CardDescription>Map Class → Subject → Faculty. Toggle split for parallel sub-groups.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {noSetup && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
            Add classes, subjects and staff in the Setup View before creating lessons.{" "}
            <Link to="/setup" className="font-medium underline">Go to Setup</Link>
          </div>
        )}

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Class</Label>
              <SearchCombobox
                value={classId}
                onChange={setClassId}
                options={classOptions}
                placeholder="Select class"
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <Switch checked={split} onCheckedChange={setSplit} id="split" />
                <Label htmlFor="split" className="cursor-pointer">Split into Groups</Label>
              </div>
              <p className="text-xs text-muted-foreground">Run different subjects/teachers in the same slot.</p>
            </div>
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
              {groups.map((g) => (
                <div key={g.id} className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[110px_1fr_1fr_auto]">
                  <Input value={g.label} onChange={(e) => updateGroup(g.id, { label: e.target.value })} />
                  <SearchCombobox
                    value={g.subjectId}
                    onChange={(v) => updateGroup(g.id, { subjectId: v })}
                    options={subjectOptions}
                    placeholder="Subject"
                  />
                  <SearchCombobox
                    value={g.teacherId}
                    onChange={(v) => updateGroup(g.id, { teacherId: v })}
                    options={teacherOptions}
                    placeholder="Teacher"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeGroup(g.id)}
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

          <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
            <div>
              <Label>Frequency / week</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={frequency}
                onChange={(e) => setFrequency(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </div>
            <div>
              <Label className="mb-1 block">Layout preview</Label>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: frequency }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-10 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary"
                  >
                    1P
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={!canSave} className="w-full sm:w-auto">
            <Plus className="mr-1 h-4 w-4" /> Add Lesson
          </Button>
        </div>

        {tt.lessons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Configured lessons ({tt.lessons.length})</Label>
              <Tabs value={sectionFilter} onValueChange={(v) => setSectionFilter(v as SectionKey | "all")}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="h-6 text-xs">All</TabsTrigger>
                  {SECTIONS.map((s) => (
                    <TabsTrigger key={s} value={s} className="h-6 text-xs">{s}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            {filteredLessons.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">
                    {className(l.classId)}{" "}
                    <Badge variant="outline" className="ml-1">{l.frequency}x/wk</Badge>
                    {l.split && <Badge className="ml-1" variant="secondary">Split</Badge>}
                  </div>
                  {l.split ? (
                    <div className="flex flex-wrap gap-1.5">
                      {l.groups.map((g) => (
                        <Badge key={g.id} variant="secondary">
                          {g.label}: {subjectName(g.subjectId)} — {teacherName(g.teacherId)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      {subjectName(l.subjectId)} · {teacherName(l.teacherId)}
                    </div>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeLesson(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
