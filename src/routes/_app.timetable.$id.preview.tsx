import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit3, Printer } from "lucide-react";

export const Route = createFileRoute("/_app/timetable/$id/preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const { id } = Route.useParams();
  const { data } = useStore();
  const tt = data.timetables.find((t) => t.id === id);

  if (!tt) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Timetable not found</CardTitle></CardHeader>
          <CardContent><Button asChild><Link to="/timetable">Back</Link></Button></CardContent>
        </Card>
      </div>
    );
  }

  const g = tt.generated;
  const subjectShort = (sid: string) => data.subjects.find((s) => s.id === sid)?.shortName ?? "—";
  const subjectName = (sid: string) => data.subjects.find((s) => s.id === sid)?.name ?? "";
  const teacherShort = (tid: string) => data.staff.find((s) => s.id === tid)?.shortName ?? "—";

  const classesWith = g ? data.classes.filter((c) => g.grid[c.id]?.some((day) => day.some((p) => p.length > 0))) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/timetable"><ArrowLeft className="mr-1 h-4 w-4" /> All timetables</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tt.name}</h1>
            <p className="text-sm text-muted-foreground">Preview · per-class schedule</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/timetable/$id" params={{ id }}><Edit3 className="mr-1 h-4 w-4" /> Edit</Link>
          </Button>
        </div>
      </div>

      {!g ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No timetable generated yet.{" "}
            <Link to="/timetable/$id" params={{ id }} className="text-primary underline">Generate one</Link>.
          </CardContent>
        </Card>
      ) : classesWith.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing scheduled.</CardContent></Card>
      ) : (
        <div className="space-y-8">
          {classesWith.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <CardDescription>{g.days.length} days · {g.periodNames.length} periods</CardDescription>
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
                          {g.grid[c.id][di].map((cells, pi) => (
                            <td key={pi} className="p-1 align-top">
                              {cells.length === 0 ? (
                                <div className="h-full min-h-[44px] rounded bg-muted/30" />
                              ) : (
                                <div className="space-y-1">
                                  {cells.map((cell, ci) => (
                                    <div key={ci} className="rounded bg-primary/10 p-1.5 leading-tight text-primary" title={subjectName(cell.subjectId)}>
                                      {cell.groupLabel && <div className="text-[10px] font-semibold opacity-80">{cell.groupLabel}</div>}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
