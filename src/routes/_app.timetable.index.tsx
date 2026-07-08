import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore, uid, type Timetable } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CalendarClock, ArrowRight, Trash2, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

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

  const downloadPdf = (t: Timetable) => {
    if (!t.generated) return toast.error("Generate the timetable first");
    const g = t.generated;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 32;

    const classIds = Object.keys(g.grid);
    if (classIds.length === 0) return toast.error("No classes in this timetable");

    classIds.forEach((classId, idx) => {
      if (idx > 0) doc.addPage();
      const cls = data.classes.find((c) => c.id === classId);
      const clsName = cls?.name ?? classId;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(t.name, margin, margin + 4);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Class: ${clsName}`, margin, margin + 22);

      // Table
      const cols = ["Day", ...g.periodNames];
      const startY = margin + 42;
      const availW = pageW - margin * 2;
      const dayColW = 80;
      const periodColW = (availW - dayColW) / Math.max(1, g.periodNames.length);
      const rowH = 44;
      const headerH = 22;

      // Header
      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(180);
      doc.rect(margin, startY, availW, headerH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      cols.forEach((c, i) => {
        const x = margin + (i === 0 ? 0 : dayColW + periodColW * (i - 1));
        const w = i === 0 ? dayColW : periodColW;
        doc.text(c, x + w / 2, startY + 14, { align: "center", maxWidth: w - 4 });
      });

      // Rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      g.days.forEach((day, dIdx) => {
        const y = startY + headerH + dIdx * rowH;
        if (y + rowH > pageH - margin) return; // overflow guard
        doc.rect(margin, y, availW, rowH);
        doc.setFont("helvetica", "bold");
        doc.text(day, margin + dayColW / 2, y + rowH / 2, { align: "center" });
        doc.setFont("helvetica", "normal");

        g.periodNames.forEach((_p, pIdx) => {
          const x = margin + dayColW + periodColW * pIdx;
          doc.rect(x, y, periodColW, rowH);
          const cells = g.grid[classId]?.[dIdx]?.[pIdx] ?? [];
          if (cells.length === 0) return;
          const lines: string[] = [];
          for (const cell of cells) {
            const subj = data.subjects.find((s) => s.id === cell.subjectId)?.shortName ?? "?";
            const teach = data.staff.find((s) => s.id === cell.teacherId)?.shortName ?? "?";
            const label = cell.groupLabel ? `[${cell.groupLabel}] ` : "";
            lines.push(`${label}${subj} · ${teach}`);
          }
          doc.text(lines, x + 4, y + 12, { maxWidth: periodColW - 8 });
        });
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Page ${idx + 1} of ${classIds.length}`,
        pageW - margin,
        pageH - margin / 2,
        { align: "right" }
      );
      doc.setTextColor(0);
    });

    const safe = t.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save(`${safe || "timetable"}-all-classes.pdf`);
    toast.success("Downloaded PDF");
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
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1 min-w-[110px]">
                  <Link to="/timetable/$id" params={{ id: t.id }}>
                    Open <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {t.generated ? (
                  <Button asChild variant="secondary" size="sm" className="flex-1 min-w-[110px]">
                    <Link to="/timetable/$id/preview" params={{ id: t.id }}>
                      <Eye className="mr-1 h-4 w-4" /> Preview
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="flex-1 min-w-[110px]" disabled title="Generate the timetable first">
                    <Eye className="mr-1 h-4 w-4" /> Preview
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[110px]"
                  disabled={!t.generated}
                  title={t.generated ? "Download all classes as PDF" : "Generate the timetable first"}
                  onClick={() => downloadPdf(t)}
                >
                  <Download className="mr-1 h-4 w-4" /> Download PDF
                </Button>
              </CardContent>

            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
