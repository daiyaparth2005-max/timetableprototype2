import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore, uid, type Timetable } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CalendarClock, ArrowRight, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/timetable/")({
  component: TimetableListPage,
});

function TimetableListPage() {
  const { data, update } = useStore();
  const navigate = useNavigate();

  const add = () => {
    const t: Timetable = {
      id: uid(),
      name: `Timetable ${data.timetables.length + 1}`,
      createdAt: Date.now(),
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      periods: [],
      lessons: [],
    };
    update((d) => ({ ...d, timetables: [...d.timetables, t] }));
    toast.success("Timetable created");
    navigate({ to: "/timetable/$id", params: { id: t.id } });
  };

  const remove = (id: string) => {
    update((d) => ({ ...d, timetables: d.timetables.filter((x) => x.id !== id) }));
    toast.success("Timetable deleted");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">My Timetables</h1>
          <p className="text-muted-foreground">Your saved schedules.</p>
        </div>
        <Button onClick={add}><Plus className="mr-2 h-4 w-4" /> Add Timetable</Button>
      </div>

      {data.timetables.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarClock className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No timetables yet</p>
              <p className="text-sm text-muted-foreground">Create your first schedule to get started.</p>
            </div>
            <Button onClick={add}><Plus className="mr-2 h-4 w-4" /> Add Timetable</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.timetables.map((t) => (
            <Card key={t.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="truncate">{t.name}</span>
                  <button
                    aria-label="Delete timetable"
                    onClick={() => remove(t.id)}
                    className="opacity-40 hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardTitle>
                <CardDescription>
                  {t.periods.length} periods · {t.days.length} days · {t.lessons.length} lessons
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/timetable/$id" params={{ id: t.id }}>
                    Open <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {t.generated ? (
                  <Button asChild variant="secondary" size="sm" className="flex-1">
                    <Link to="/timetable/$id/preview" params={{ id: t.id }}>
                      <Eye className="mr-1 h-4 w-4" /> Preview
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="flex-1" disabled title="Generate the timetable first">
                    <Eye className="mr-1 h-4 w-4" /> Preview
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
