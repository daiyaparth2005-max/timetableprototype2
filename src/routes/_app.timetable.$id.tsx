import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, uid, type Period, type Lesson, type LessonGroup } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Check, CircleAlert, Plus, Trash2, Coffee, Edit3 } from "lucide-react";

export const Route = createFileRoute("/_app/timetable/$id")({
  component: WizardPage,
});

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function WizardPage() {
  const { id } = Route.useParams();
  const { data, loaded } = useStore();
  const navigate = useNavigate();
  const tt = data.timetables.find((t) => t.id === id);

  if (!loaded) {
    return <div className="mx-auto max-w-3xl p-8 text-sm text-muted-foreground">Loading…</div>;
  }

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

  const basicOk = !!tt.name;
  const classesOk = data.classes.length > 0;
  const teachersOk = data.staff.length > 0;

  const steps = [
    { key: "basic", label: "Basic Information", done: basicOk, editTo: "/setup" as const },
    { key: "classes", label: "Classes", done: classesOk, editTo: "/setup" as const },
    { key: "teachers", label: "Teachers", done: teachersOk, editTo: "/setup" as const },
    { key: "bell", label: "Bell Schedule", done: tt.periods.length > 0, editTo: null },
    { key: "lessons", label: "Lessons", done: tt.lessons.length > 0, editTo: null },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/timetable" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{tt.name}</h1>
          <p className="text-sm text-muted-foreground">Setup Progress</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification</CardTitle>
          <CardDescription>These steps auto-verify from your Setup data.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {steps.slice(0, 3).map((s) => (
              <li key={s.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  {s.done ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      <Check className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <CircleAlert className="h-4 w-4" />
                    </div>
                  )}
                  <span className="font-medium">{s.label}</span>
                  {s.done && <Badge variant="secondary">Verified</Badge>}
                </div>
                {s.editTo && (
                  <Button asChild variant="ghost" size="sm">
                    <Link to={s.editTo}><Edit3 className="mr-1 h-3.5 w-3.5" /> Edit</Link>
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <BellSchedule id={id} />
      <LessonsStep id={id} />
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
        t.id === id
          ? {
              ...t,
              periods: t.periods.map((p, i, arr) => {
                if (p.id !== pid) return p;
                const merged = { ...p, ...patch };
                return merged;
              }),
            }
          : t
      ),
    }));
  };

  const removePeriod = (pid: string) => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, periods: t.periods.filter((p) => p.id !== pid) } : t)),
    }));
  };

  // Snap-align: recompute each period start from previous end/break-end if needed
  const snapAll = () => {
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => {
        if (t.id !== id) return t;
        let cursor = t.periods[0]?.start ?? "08:00";
        const next = t.periods.map((p, i) => {
          const start = i === 0 ? p.start : cursor;
          const durMins =
            (Number(p.end.split(":")[0]) * 60 + Number(p.end.split(":")[1])) -
            (Number(p.start.split(":")[0]) * 60 + Number(p.start.split(":")[1]));
          const end = addMinutes(start, Math.max(durMins, 30));
          cursor = p.breakAfter ? addMinutes(end, 15) : end;
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
        <CardDescription>Weekly cycle (inbuilt). Select active days and add periods.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="mb-2 block">Active Days</Label>
          <div className="flex flex-wrap gap-3">
            {WEEK.map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted">
                <Checkbox checked={tt.days.includes(d)} onCheckedChange={() => toggleDay(d)} />
                <span className="text-sm">{d}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Periods</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={snapAll} disabled={tt.periods.length < 2}>Snap times</Button>
              <Button size="sm" onClick={addPeriod}><Plus className="mr-1 h-4 w-4" /> Add Period</Button>
            </div>
          </div>
          {tt.periods.length === 0 && <p className="text-sm text-muted-foreground">No periods yet. Add your first period.</p>}
          <div className="space-y-2">
            {tt.periods.map((p) => (
              <div key={p.id} className="rounded-lg border bg-card p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                  <Input value={p.name} onChange={(e) => updatePeriod(p.id, { name: e.target.value })} />
                  <Input type="time" value={p.start} onChange={(e) => updatePeriod(p.id, { start: e.target.value })} />
                  <Input type="time" value={p.end} onChange={(e) => updatePeriod(p.id, { end: e.target.value })} />
                  <Button size="icon" variant="ghost" onClick={() => removePeriod(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {p.breakAfter ? (
                    <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
                      <Coffee className="h-4 w-4 text-amber-600" />
                      <Input value={p.breakAfter.name} onChange={(e) => updatePeriod(p.id, { breakAfter: { ...p.breakAfter!, name: e.target.value } })} className="h-8 max-w-40" />
                      <Input type="time" value={p.breakAfter.start} onChange={(e) => updatePeriod(p.id, { breakAfter: { ...p.breakAfter!, start: e.target.value } })} className="h-8" />
                      <Input type="time" value={p.breakAfter.end} onChange={(e) => updatePeriod(p.id, { breakAfter: { ...p.breakAfter!, end: e.target.value } })} className="h-8" />
                      <Button size="sm" variant="ghost" onClick={() => updatePeriod(p.id, { breakAfter: null })}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => updatePeriod(p.id, { breakAfter: { name: "Break", start: p.end, end: addMinutes(p.end, 15) } })}>
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

  const addGroup = () => setGroups((g) => [...g, { id: uid(), label: `Group ${String.fromCharCode(65 + g.length)}`, subjectId: "", teacherId: "" }]);
  const removeGroup = (gid: string) => setGroups((g) => g.filter((x) => x.id !== gid));
  const updateGroup = (gid: string, patch: Partial<LessonGroup>) =>
    setGroups((g) => g.map((x) => (x.id === gid ? { ...x, ...patch } : x)));

  const canSave = classId && (split ? groups.every((g) => g.subjectId && g.teacherId) : subjectId && teacherId);

  const save = () => {
    if (!canSave) return toast.error("Complete all fields");
    const lesson: Lesson = {
      id: uid(),
      classId,
      split,
      subjectId: split ? "" : subjectId,
      teacherId: split ? "" : teacherId,
      groups: split ? groups : [],
      frequency,
    };
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, lessons: [...t.lessons, lesson] } : t)),
    }));
    setClassId(""); setSubjectId(""); setTeacherId(""); setSplit(false); setFrequency(6);
    toast.success("Lesson added");
  };

  const removeLesson = (lid: string) =>
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) => (t.id === id ? { ...t, lessons: t.lessons.filter((l) => l.id !== lid) } : t)),
    }));

  const className = (cid: string) => data.classes.find((c) => c.id === cid)?.name ?? "—";
  const subjectName = (sid: string) => data.subjects.find((s) => s.id === sid)?.name ?? "—";
  const teacherName = (tid: string) => data.staff.find((s) => s.id === tid)?.name ?? "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lessons</CardTitle>
        <CardDescription>Map Class → Subject → Faculty. Enable split for parallel sub-groups.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {data.classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-end gap-3">
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
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {data.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Faculty</Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {data.staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[100px_1fr_1fr_auto]">
                  <Input value={g.label} onChange={(e) => updateGroup(g.id, { label: e.target.value })} />
                  <Select value={g.subjectId} onValueChange={(v) => updateGroup(g.id, { subjectId: v })}>
                    <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>
                      {data.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={g.teacherId} onValueChange={(v) => updateGroup(g.id, { teacherId: v })}>
                    <SelectTrigger><SelectValue placeholder="Teacher" /></SelectTrigger>
                    <SelectContent>
                      {data.staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => removeGroup(g.id)} disabled={groups.length <= 2}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addGroup}><Plus className="mr-1 h-4 w-4" /> Add Group</Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
            <div>
              <Label>Frequency / week</Label>
              <Input type="number" min={1} max={20} value={frequency} onChange={(e) => setFrequency(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <Label className="mb-1 block">Preview</Label>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: frequency }).map((_, i) => (
                  <div key={i} className="flex h-8 w-10 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">1P</div>
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
            <Label>Configured lessons</Label>
            {tt.lessons.map((l) => (
              <div key={l.id} className="flex items-start justify-between rounded-lg border p-3">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{className(l.classId)} <Badge variant="outline" className="ml-1">{l.frequency}x/wk</Badge></div>
                  {l.split ? (
                    <div className="flex flex-wrap gap-1.5">
                      {l.groups.map((g) => (
                        <Badge key={g.id} variant="secondary">
                          {g.label}: {subjectName(g.subjectId)} — {teacherName(g.teacherId)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">{subjectName(l.subjectId)} · {teacherName(l.teacherId)}</div>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeLesson(l.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
