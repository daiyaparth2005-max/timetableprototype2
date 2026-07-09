import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useStore, shortNameOf, uid, SECTIONS, type Staff, type Subject, type ClassItem, type SectionKey } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Users, BookOpen, School, CalendarClock } from "lucide-react";
import { AddWithBulk } from "@/components/AddWithBulk";

export const Route = createFileRoute("/_app/setup")({
  component: SetupPage,
});

function SetupPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Setup</h1>
        <p className="text-muted-foreground">Build your data library: staff, subjects and classes.</p>
      </div>
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff"><Users className="mr-2 h-4 w-4" /> Staff</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="mr-2 h-4 w-4" /> Subjects</TabsTrigger>
          <TabsTrigger value="classes"><School className="mr-2 h-4 w-4" /> Classes</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="mt-4"><StaffSection /></TabsContent>
        <TabsContent value="subjects" className="mt-4"><SubjectsSection /></TabsContent>
        <TabsContent value="classes" className="mt-4"><ClassesSection /></TabsContent>
      </Tabs>
    </div>
  );
}

function StaffSection() {
  const { data, update } = useStore();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Omit<Staff, "id" | "shortName">>({
    name: "", email: "", number: "", designation: "Teacher", subject: "", employment: "Full-Time",
  });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name required");
    const staff: Staff = { ...form, id: uid(), shortName: shortNameOf(form.name) };
    update((d) => ({ ...d, staff: [...d.staff, staff] }));
    setForm({ name: "", email: "", number: "", designation: "Teacher", subject: "", employment: "Full-Time" });
    toast.success(`${staff.name} added`);
  };

  const remove = (id: string) => update((d) => ({ ...d, staff: d.staff.filter((s) => s.id !== id) }));

  const bulkImport = async (rows: Record<string, string>[]) => {
    let added = 0, skipped = 0;
    const valid: Staff[] = [];
    for (const r of rows) {
      if (!r.name) { skipped++; continue; }
      const emp = /part/i.test(r.employment || "") ? "Part-Time" : "Full-Time";
      valid.push({
        id: uid(),
        name: r.name,
        shortName: shortNameOf(r.name),
        email: r.email || "",
        number: r.number || "",
        designation: r.designation || "Teacher",
        subject: r.subject || "",
        employment: emp,
      });
      added++;
    }
    update((d) => ({ ...d, staff: [...d.staff, ...valid] }));
    return { added, skipped };
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
          <div>
            <CardTitle>Add Teacher</CardTitle>
            <CardDescription>Short name is auto-generated.</CardDescription>
          </div>
          <AddWithBulk
            addLabel="Add Staff"
            onAddClick={() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus()}
            templateName="staff-template.xlsx"
            columns={[
              { key: "name", label: "Name", required: true, example: "Jane Doe" },
              { key: "email", label: "Email", example: "jane@school.edu" },
              { key: "number", label: "Number", example: "+1 555 0100" },
              { key: "designation", label: "Designation", example: "Teacher" },
              { key: "subject", label: "Subject", example: "Math" },
              { key: "employment", label: "Employment", example: "Full-Time" },
            ]}
            onImport={bulkImport}
          />
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={add} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
              {form.name && <p className="mt-1 text-xs text-muted-foreground">Short: <b>{shortNameOf(form.name)}</b></p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Number</Label>
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </div>
            <div>
              <Label>Designation</Label>
              <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Principal", "Vice Principal", "Head of Department", "Teacher", "Assistant Teacher"].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject Taught</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g., Math" />
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select value={form.employment} onValueChange={(v) => setForm({ ...form, employment: v as Staff["employment"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-Time">Full-Time</SelectItem>
                  <SelectItem value="Part-Time">Part-Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Staff</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Staff Library ({data.staff.length})</CardTitle></CardHeader>
        <CardContent>
          {data.staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Short</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary">{s.shortName}</Badge></TableCell>
                    <TableCell>{s.designation}</TableCell>
                    <TableCell>{s.subject}</TableCell>
                    <TableCell>{s.employment}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/teacher/$id" params={{ id: s.id }}>
                            <CalendarClock className="mr-1 h-3.5 w-3.5" /> Daily Schedule
                          </Link>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubjectsSection() {
  const { data, update } = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    const s: Subject = { id: uid(), name: name.trim(), shortName: shortNameOf(name) };
    update((d) => ({ ...d, subjects: [...d.subjects, s] }));
    setName(""); setAdding(false);
    toast.success(`${s.name} added`);
  };

  const bulkImport = async (rows: Record<string, string>[]) => {
    let added = 0, skipped = 0;
    const valid: Subject[] = [];
    for (const r of rows) {
      if (!r.name) { skipped++; continue; }
      valid.push({ id: uid(), name: r.name, shortName: r.shortName || shortNameOf(r.name) });
      added++;
    }
    update((d) => ({ ...d, subjects: [...d.subjects, ...valid] }));
    return { added, skipped };
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Subject Library ({data.subjects.length}/25)</CardTitle>
          <CardDescription>Scale up to 20–25 subjects.</CardDescription>
        </div>
        <AddWithBulk
          addLabel="Add Subject"
          onAddClick={() => setAdding(true)}
          templateName="subjects-template.xlsx"
          columns={[
            { key: "name", label: "Name", required: true, example: "Mathematics" },
            { key: "shortName", label: "Short Name", example: "MAT" },
          ]}
          onImport={bulkImport}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="flex gap-2 rounded-lg border bg-muted/30 p-3">
            <Input autoFocus placeholder="Subject name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <Button onClick={submit}>Save</Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setName(""); }}>Cancel</Button>
          </div>
        )}
        {data.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.subjects.map((s) => (
              <div key={s.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <span className="font-medium">{s.name}</span>
                <Badge variant="secondary">{s.shortName}</Badge>
                <button className="opacity-40 hover:opacity-100" onClick={() => update((d) => ({ ...d, subjects: d.subjects.filter((x) => x.id !== s.id) }))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClassesSection() {
  const { data, update } = useStore();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Class name required");
    const c: ClassItem = { id: uid(), name: name.trim(), shortName: shortNameOf(name), classTeacherId: teacherId };
    update((d) => ({ ...d, classes: [...d.classes, c] }));
    setName(""); setTeacherId("");
    toast.success(`${c.name} added`);
  };

  const bulkImport = async (rows: Record<string, string>[]) => {
    let added = 0, skipped = 0;
    const valid: ClassItem[] = [];
    for (const r of rows) {
      if (!r.name) { skipped++; continue; }
      // Resolve teacher by name (case-insensitive)
      let tId = "";
      if (r.classTeacher) {
        const t = data.staff.find((s) => s.name.trim().toLowerCase() === r.classTeacher.trim().toLowerCase());
        if (t) tId = t.id;
      }
      valid.push({ id: uid(), name: r.name, shortName: r.shortName || shortNameOf(r.name), classTeacherId: tId });
      added++;
    }
    update((d) => ({ ...d, classes: [...d.classes, ...valid] }));
    return { added, skipped };
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
          <div>
            <CardTitle>Add Class</CardTitle>
            <CardDescription>Assign a class teacher.</CardDescription>
          </div>
          <AddWithBulk
            addLabel="Add Class"
            onAddClick={() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus()}
            templateName="classes-template.xlsx"
            columns={[
              { key: "name", label: "Name", required: true, example: "12th Science" },
              { key: "shortName", label: "Short Name", example: "12S" },
              { key: "classTeacher", label: "Class Teacher", example: "Jane Doe" },
            ]}
            onImport={bulkImport}
          />
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={add} className="space-y-3">
            <div>
              <Label>Class Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., 12th Science" />
              {name && <p className="mt-1 text-xs text-muted-foreground">Short: <b>{shortNameOf(name)}</b></p>}
            </div>
            <div>
              <Label>Class Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger><SelectValue placeholder={data.staff.length ? "Select teacher" : "Add staff first"} /></SelectTrigger>
                <SelectContent>
                  {data.staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.shortName})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Class</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Classes ({data.classes.length})</CardTitle></CardHeader>
        <CardContent>
          {data.classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Class</TableHead><TableHead>Short</TableHead><TableHead>Class Teacher</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data.classes.map((c) => {
                  const teacher = data.staff.find((s) => s.id === c.classTeacherId);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="secondary">{c.shortName}</Badge></TableCell>
                      <TableCell>{teacher ? teacher.name : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => update((d) => ({ ...d, classes: d.classes.filter((x) => x.id !== c.id) }))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
