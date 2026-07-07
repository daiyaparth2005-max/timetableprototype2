import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/teacher/$id")({
  component: TeacherSchedulePage,
});

function TeacherSchedulePage() {
  const { id } = Route.useParams();
  const { data } = useStore();
  const teacher = data.staff.find((s) => s.id === id);

  if (!teacher) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Teacher not found</CardTitle></CardHeader>
          <CardContent><Button asChild><Link to="/setup">Back to Setup</Link></Button></CardContent>
        </Card>
      </div>
    );
  }

  const subjectShort = (sid: string) => data.subjects.find((s) => s.id === sid)?.shortName ?? "—";
  const className = (cid: string) => data.classes.find((c) => c.id === cid)?.name ?? "—";

  // Show one card per timetable with a generated grid that references this teacher.
  const timetables = data.timetables.filter((t) => t.generated);

  type Cell = { classId: string; subjectId: string; groupLabel?: string };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/setup"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Setup</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{teacher.name}</h1>
          <p className="text-sm text-muted-foreground">
            {teacher.designation} · <Badge variant="secondary">{teacher.shortName}</Badge>
          </p>
        </div>
      </div>

      {timetables.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No generated timetables yet. Create one to view a teacher's weekly schedule.
        </CardContent></Card>
      )}

      {timetables.map((tt) => {
        const g = tt.generated!;
        // per-day per-period array of cells for this teacher
        const teacherGrid: Cell[][][] = g.days.map(() => g.periodNames.map(() => [] as Cell[]));
        let total = 0;
        for (const c of data.classes) {
          const cg = g.grid[c.id];
          if (!cg) continue;
          for (let d = 0; d < g.days.length; d++) {
            for (let p = 0; p < g.periodNames.length; p++) {
              for (const cell of cg[d][p]) {
                if (cell.teacherId === teacher.id) {
                  teacherGrid[d][p].push({ classId: c.id, subjectId: cell.subjectId, groupLabel: cell.groupLabel });
                  total++;
                }
              }
            }
          }
        }
        return (
          <Card key={tt.id}>
            <CardHeader>
              <CardTitle className="text-lg">{tt.name}</CardTitle>
              <CardDescription>{total} periods per week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left">Day</th>
                      {g.periodNames.map((pn, i) => (
                        <th key={i} className="p-2 text-left">{pn}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.days.map((day, di) => (
                      <tr key={day} className="border-t">
                        <td className="p-2 font-medium">{day}</td>
                        {teacherGrid[di].map((cells, pi) => (
                          <td key={pi} className="p-1 align-top">
                            {cells.length === 0 ? (
                              <div className="h-full min-h-[44px] rounded bg-muted/30" />
                            ) : (
                              <div className="space-y-1">
                                {cells.map((cell, ci) => (
                                  <div key={ci} className="rounded bg-primary/10 p-1.5 leading-tight text-primary">
                                    {cell.groupLabel && <div className="text-[10px] font-semibold opacity-80">{cell.groupLabel}</div>}
                                    <div className="font-semibold">{subjectShort(cell.subjectId)}</div>
                                    <div className="text-[10px] opacity-80">{className(cell.classId)}</div>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
