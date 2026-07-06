import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Sparkles, GitBranch, Wand2, UserX } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const LOCKED_MSG = "Purchase full API keys for the AI to access these.";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function DashboardPage() {
  const navigate = useNavigate();
  const { data } = useStore();
  const [absentId, setAbsentId] = useState<string>("");
  const [day, setDay] = useState<string>("Monday");
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  // Build a pseudo-schedule from timetables data
  const firstTt = data.timetables[0];
  const periods = firstTt?.periods ?? [];

  // Deterministic assignment: teacher assigned to period i if i % staff.length === teacherIdx
  const teacherPeriods = (teacherId: string): number[] => {
    if (!periods.length) return [];
    const idx = data.staff.findIndex((s) => s.id === teacherId);
    if (idx < 0) return [];
    return periods.map((_, i) => i).filter((i) => (i + idx) % Math.max(data.staff.length, 1) === 0);
  };

  const freeFaculty = (periodIdx: number) => {
    return data.staff.filter((s) => !teacherPeriods(s.id).includes(periodIdx) && s.id !== absentId);
  };

  const cards = [
    { title: "My Timetable", desc: "View & manage schedules", icon: CalendarDays, action: () => navigate({ to: "/timetable" }) },
    { title: "AI Auto-Generate", desc: "Let AI build the perfect timetable", icon: Sparkles, locked: true },
    { title: "Conflict Analyzer", desc: "AI-powered conflict detection", icon: GitBranch, locked: true },
    { title: "Smart Suggestions", desc: "AI recommendations", icon: Wand2, locked: true },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview, timetables and substitution.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="substitution">Substitution</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card
                key={c.title}
                className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                onClick={() => (c.locked ? toast.info(LOCKED_MSG) : c.action?.())}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <c.icon className="h-5 w-5" />
                    </div>
                    {c.locked && <Badge variant="secondary">Locked</Badge>}
                  </div>
                  <CardTitle className="mt-3 text-base">{c.title}</CardTitle>
                  <CardDescription>{c.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="substitution" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserX className="h-5 w-5" /> Manual Substitution</CardTitle>
              <CardDescription>Select an absent teacher and day to view their scheduled periods.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Absent Teacher</label>
                  <Select value={absentId} onValueChange={(v) => { setAbsentId(v); setSelectedPeriod(null); }}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      {data.staff.length === 0 && <div className="p-2 text-sm text-muted-foreground">No staff added yet.</div>}
                      {data.staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.shortName})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Day</label>
                  <Select value={day} onValueChange={(v) => { setDay(v); setSelectedPeriod(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {absentId && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Scheduled periods on {day}</div>
                  {periods.length === 0 && <p className="text-sm text-muted-foreground">Create a timetable first to see periods.</p>}
                  <div className="grid gap-2">
                    {teacherPeriods(absentId).map((i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPeriod(i)}
                        className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted ${selectedPeriod === i ? "border-primary bg-muted" : ""}`}
                      >
                        <div>
                          <div className="font-medium">{periods[i]?.name ?? `Period ${i + 1}`}</div>
                          <div className="text-xs text-muted-foreground">{periods[i]?.start} – {periods[i]?.end}</div>
                        </div>
                        <Badge variant="destructive">Needs Substitution</Badge>
                      </button>
                    ))}
                    {teacherPeriods(absentId).length === 0 && periods.length > 0 && (
                      <p className="text-sm text-muted-foreground">No scheduled periods for this teacher on {day}.</p>
                    )}
                  </div>
                </div>
              )}

              {selectedPeriod !== null && (
                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base">Free Faculty — one-click swap</CardTitle>
                    <CardDescription>Available teachers for {periods[selectedPeriod]?.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {freeFaculty(selectedPeriod).map((s) => (
                        <Button
                          key={s.id}
                          variant="outline"
                          size="sm"
                          onClick={() => toast.success(`${s.name} assigned to ${periods[selectedPeriod!]?.name}`)}
                        >
                          {s.name} <Badge className="ml-2" variant="secondary">{s.shortName}</Badge>
                        </Button>
                      ))}
                      {freeFaculty(selectedPeriod).length === 0 && <p className="text-sm text-muted-foreground">No free faculty available.</p>}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
