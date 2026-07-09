import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, SECTIONS, type SectionKey } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit3, Printer, CircleAlert } from "lucide-react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { moveCell, validateGenerated, type Coord } from "@/lib/timetable-mutate";

export const Route = createFileRoute("/_app/timetable/$id/preview")({
  component: PreviewPage,
});

function sectionOf(s?: SectionKey): SectionKey {
  return s ?? "9-12";
}

function PreviewPage() {
  const { id } = Route.useParams();
  const { data, update } = useStore();
  const tt = data.timetables.find((t) => t.id === id);
  const [activeSection, setActiveSection] = useState<SectionKey>("9-12");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  const g = tt.generated;
  const subjectShort = (sid: string) => data.subjects.find((s) => s.id === sid)?.shortName ?? "—";
  const subjectName = (sid: string) => data.subjects.find((s) => s.id === sid)?.name ?? "";
  const teacherShort = (tid: string) => data.staff.find((s) => s.id === tid)?.shortName ?? "—";

  const classesForSection = data.classes.filter((c) => sectionOf(c.section) === activeSection);
  const classesWith = g
    ? classesForSection.filter((c) => g.grid[c.id]?.some((day) => day.some((p) => p.length > 0)))
    : [];

  const onDragEnd = (e: DragEndEvent) => {
    if (!g || !e.over) return;
    const src = parseCoord(String(e.active.id));
    const dst = parseCoord(String(e.over.id));
    if (!src || !dst) return;
    const res = moveCell(g.grid, src, dst);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) =>
        t.id === id && t.generated ? { ...t, generated: { ...t.generated, grid: res.grid } } : t
      ),
    }));
    toast.success(res.ripple ? `Moved. ${res.ripple}` : "Moved");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/timetable"><ArrowLeft className="mr-1 h-4 w-4" /> All timetables</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{tt.name}</h1>
            <p className="text-sm text-muted-foreground">Preview · drag to rearrange</p>
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

      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionKey)}>
        <TabsList>
          {SECTIONS.map((s) => {
            const count = data.classes.filter((c) => sectionOf(c.section) === s).length;
            return (
              <TabsTrigger key={s} value={s}>
                {s} <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {SECTIONS.map((sec) => (
          <TabsContent key={sec} value={sec} className="mt-4">
            {!g ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No timetable generated yet.{" "}
                  <Link to="/timetable/$id" params={{ id }} className="text-primary underline">Generate one</Link>.
                </CardContent>
              </Card>
            ) : classesWith.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No classes in this section have a schedule.</CardContent></Card>
            ) : (
              <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                <div className="space-y-8">
                  {classesWith.map((c) => (
                    <Card key={c.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{c.name}</CardTitle>
                        <CardDescription>
                          {g.days.length} days · {g.periodNames.length} periods · drag any cell to move it
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full min-w-[720px] text-xs">
                            <thead className="bg-muted/60">
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
                                    <DroppableTd
                                      key={pi}
                                      coord={{ classId: c.id, day: di, period: pi }}
                                    >
                                      {cells.length === 0 ? (
                                        <div className="h-full min-h-[44px] rounded bg-muted/30" />
                                      ) : (
                                        <DraggableCell coord={{ classId: c.id, day: di, period: pi }}>
                                          <div className="space-y-1">
                                            {cells.map((cell, ci) => (
                                              <div
                                                key={ci}
                                                className="rounded bg-primary/10 p-1.5 leading-tight text-primary transition-colors hover:bg-primary/20"
                                                title={subjectName(cell.subjectId)}
                                              >
                                                {cell.groupLabel && (
                                                  <div className="text-[10px] font-semibold opacity-80">{cell.groupLabel}</div>
                                                )}
                                                <div className="font-semibold">{subjectShort(cell.subjectId)}</div>
                                                <div className="text-[10px] opacity-80">{teacherShort(cell.teacherId)}</div>
                                              </div>
                                            ))}
                                          </div>
                                        </DraggableCell>
                                      )}
                                    </DroppableTd>
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
              </DndContext>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function coordId(c: Coord) {
  return `${c.classId}|${c.day}|${c.period}`;
}
function parseCoord(s: string): Coord | null {
  const [classId, d, p] = s.split("|");
  if (!classId) return null;
  return { classId, day: Number(d), period: Number(p) };
}

function DraggableCell({ coord, children }: { coord: Coord; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: coordId(coord) });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      {children}
    </div>
  );
}

function DroppableTd({ coord, children }: { coord: Coord; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: coordId(coord) });
  return (
    <td
      ref={setNodeRef}
      className={`p-1 align-top ${isOver ? "bg-accent/40" : ""}`}
    >
      {children}
    </td>
  );
}
