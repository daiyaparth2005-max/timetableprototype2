import { useMemo, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useStore, SECTIONS, type Timetable, type SectionKey } from "@/lib/store";
import { moveCell, type Coord } from "@/lib/timetable-mutate";
import { GripVertical, Pencil } from "lucide-react";
import { PeriodEditDialog } from "@/components/PeriodEditDialog";

function sectionOf(s?: SectionKey): SectionKey {
  return s ?? "9-12";
}

export function TimetableGrid({
  tt,
  editable,
}: {
  tt: Timetable;
  editable: boolean;
}) {
  const { data, update } = useStore();
  const [activeSection, setActiveSection] = useState<SectionKey>("9-12");
  const [editingCoord, setEditingCoord] = useState<Coord | null>(null);
  const [pending, setPending] = useState<null | {
    src: Coord;
    dst: Coord;
    classNames: string[];
    teacherNames: string[];
  }>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const g = tt.generated;
  const subjectShort = (sid: string) => data.subjects.find((s) => s.id === sid)?.shortName ?? "—";
  const subjectName = (sid: string) => data.subjects.find((s) => s.id === sid)?.name ?? "";
  const teacherShort = (tid: string) => data.staff.find((s) => s.id === tid)?.shortName ?? "—";
  const className = (cid: string) => data.classes.find((c) => c.id === cid)?.name ?? cid;
  const teacherName = (tid: string) => data.staff.find((s) => s.id === tid)?.name ?? tid;

  const applyMove = (src: Coord, dst: Coord, combine = false) => {
    if (!g) return;
    const res = moveCell(g.grid, src, dst, { combine });
    if ("needsCombineConfirm" in res && res.needsCombineConfirm) {
      setPending({
        src,
        dst,
        classNames: res.conflictClassIds.map(className),
        teacherNames: res.teacherIds.map(teacherName),
      });
      return;
    }
    if (!res.ok) {
      toast.error("error" in res ? res.error : "Move failed");
      return;
    }
    update((cur) => ({
      ...cur,
      timetables: cur.timetables.map((t) =>
        t.id === tt.id && t.generated ? { ...t, generated: { ...t.generated, grid: res.grid } } : t
      ),
    }));
    toast.success(res.ripple ? `Moved. ${res.ripple}` : "Moved");
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!g || !e.over) return;
    const src = parseCoord(String(e.active.id));
    const dst = parseCoord(String(e.over.id));
    if (!src || !dst) return;
    applyMove(src, dst);
  };

  const classesForSection = useMemo(
    () => data.classes.filter((c) => sectionOf(c.section) === activeSection),
    [data.classes, activeSection]
  );
  const classesWith = g
    ? classesForSection.filter(
        (c) => editable || g.grid[c.id]?.some((day) => day.some((p) => p.length > 0))
      )
    : [];

  if (!g) {
    return <p className="text-sm text-muted-foreground">No timetable generated yet.</p>;
  }

  const gridBody = (
    <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionKey)}>
      <TabsList>
        {SECTIONS.map((s) => {
          const count = data.classes.filter((c) => sectionOf(c.section) === s).length;
          return (
            <TabsTrigger key={s} value={s}>
              {s}
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{count}</Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {SECTIONS.map((sec) => (
        <TabsContent key={sec} value={sec} className="mt-4">
          {classesWith.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No classes in this section have a schedule.
            </p>
          ) : (
            <div className="space-y-6">
              {classesWith.map((c) => (
                <div key={c.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    {editable && (
                      <span className="text-[11px] text-muted-foreground">
                        Drag a period onto another to move or swap
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border bg-card">
                    <table className="w-full min-w-[820px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/60">
                          <th className="w-[110px] border-r border-b p-2.5 text-left font-semibold">Day</th>
                          {tt.assembly && (
                            <th className="w-[90px] border-r border-b p-2.5 text-left font-semibold text-primary">
                              {tt.assembly.name}
                              <div className="text-[10px] font-normal text-muted-foreground">
                                {tt.assembly.start}–{tt.assembly.end}
                              </div>
                            </th>
                          )}
                          {g.periodNames.map((pn, i) => (
                            <th key={i} className="border-r border-b p-2.5 text-left font-semibold last:border-r-0">
                              {pn}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.days.map((day, di) => (
                          <tr key={day} className="even:bg-muted/20">
                            <td className="border-r border-b p-2.5 align-top font-medium">{day}</td>
                            {tt.assembly && (
                              <td className="border-r border-b p-2 align-top text-[10px] text-muted-foreground">
                                {tt.assembly.start}–{tt.assembly.end}
                              </td>
                            )}
                            {g.grid[c.id][di].map((cells, pi) => {
                              const coord = { classId: c.id, day: di, period: pi };
                              return (
                                <CellSlot
                                  key={pi}
                                  editable={editable}
                                  coord={coord}
                                  onEdit={() => setEditingCoord(coord)}
                                >
                                  {cells.length === 0 ? (
                                    <div
                                      className={`min-h-[52px] rounded-md border border-dashed ${
                                        editable
                                          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                                          : "border-muted-foreground/20"
                                      }`}
                                      onClick={() => editable && setEditingCoord(coord)}
                                      role={editable ? "button" : undefined}
                                    />
                                  ) : (
                                    <div className="space-y-1">
                                      {cells.map((cell, ci) => (
                                        <div
                                          key={ci}
                                          className={`rounded-md p-2 leading-tight ${
                                            cell.combinedId
                                              ? "bg-accent-amber/20 ring-1 ring-accent-amber/40"
                                              : "bg-gradient-to-br from-primary/15 to-fuchsia-500/10"
                                          } text-primary`}
                                          title={subjectName(cell.subjectId)}
                                        >
                                          {cell.groupLabel && (
                                            <div className="text-[10px] font-semibold opacity-80">
                                              {cell.groupLabel}
                                            </div>
                                          )}
                                          <div className="text-sm font-semibold">
                                            {subjectShort(cell.subjectId)}
                                          </div>
                                          <div className="text-[10px] opacity-80">
                                            {teacherShort(cell.teacherId)}
                                          </div>
                                          {cell.combinedId && (
                                            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-amber">
                                              combined
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CellSlot>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );

  return (
    <>
      {editable ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {gridBody}
        </DndContext>
      ) : (
        gridBody
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Combine this period across classes?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  <span className="font-medium text-foreground">
                    {pending.teacherNames.join(", ")}
                  </span>{" "}
                  is already teaching in{" "}
                  <span className="font-medium text-foreground">
                    {pending.classNames.join(", ")}
                  </span>{" "}
                  at that slot. Combine so the same teacher takes both classes together, or cancel to
                  pick a different slot.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) applyMove(pending.src, pending.dst, true);
                setPending(null);
              }}
            >
              Yes, combine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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

function CellSlot({
  coord,
  editable,
  children,
}: {
  coord: Coord;
  editable: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: coordId(coord), disabled: !editable });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: coordId(coord),
    disabled: !editable,
  });

  return (
    <td
      ref={setDropRef}
      className={`border-r border-b p-1.5 align-top last:border-r-0 ${
        isOver ? "bg-accent/50 ring-2 ring-inset ring-primary/40" : ""
      }`}
    >
      {editable ? (
        <div
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className={`group relative cursor-grab touch-none active:cursor-grabbing ${
            isDragging ? "opacity-40" : ""
          }`}
        >
          <GripVertical className="pointer-events-none absolute right-0.5 top-0.5 h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100" />
          {children}
        </div>
      ) : (
        children
      )}
    </td>
  );
}
