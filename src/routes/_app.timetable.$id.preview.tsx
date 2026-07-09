import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit3, Printer, CircleAlert } from "lucide-react";
import { validateGenerated } from "@/lib/timetable-mutate";
import { TimetableGrid } from "@/components/TimetableGrid";

export const Route = createFileRoute("/_app/timetable/$id/preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const { id } = Route.useParams();
  const { data } = useStore();
  const tt = data.timetables.find((t) => t.id === id);

  const issues = useMemo(() => (tt ? validateGenerated(tt, data.classes) : []), [tt, data.classes]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/timetable"><ArrowLeft className="mr-1 h-4 w-4" /> All timetables</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{tt.name}</h1>
            <p className="text-sm text-muted-foreground">Preview — read only</p>
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

      {issues.length > 0 && (
        <Card className="border-amber-300/60 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-2 py-3 text-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 text-amber-700" />
            <div>
              <div className="font-medium">{issues.length} issue{issues.length === 1 ? "" : "s"} detected</div>
              <div className="text-xs text-muted-foreground">
                {issues.slice(0, 3).map((i) => i.message).join(" · ")}
                {issues.length > 3 && ` +${issues.length - 3} more`}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <TimetableGrid tt={tt} editable={false} />
    </div>
  );
}
