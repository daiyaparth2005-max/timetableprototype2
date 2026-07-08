import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronDown, Plus, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";

export type BulkColumn = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
};

type Props = {
  addLabel: string;
  onAddClick: () => void;
  templateName: string; // e.g. staff-template.xlsx
  columns: BulkColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<{ added: number; skipped: number }>;
};

export function AddWithBulk({ addLabel, onAddClick, templateName, columns, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const header = columns.map((c) => c.label);
    const example = [columns.map((c) => c.example ?? "")];
    const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
    // Set column widths for readability
    ws["!cols"] = columns.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateName);
    toast.success("Template downloaded");
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      // Normalize keys by matching column labels case-insensitively
      const normalized = json.map((raw) => {
        const out: Record<string, string> = {};
        for (const col of columns) {
          const found = Object.keys(raw).find((k) => k.trim().toLowerCase() === col.label.toLowerCase());
          out[col.key] = found ? String(raw[found] ?? "").trim() : "";
        }
        return out;
      });
      const cleaned = normalized.filter((r) => Object.values(r).some((v) => v !== ""));
      setRows(cleaned);
      if (cleaned.length === 0) toast.error("No data rows found in the file");
    } catch (err) {
      console.error(err);
      toast.error("Could not read the file. Make sure it's a valid .xlsx.");
    }
  };

  const doImport = async () => {
    if (!rows || rows.length === 0) return;
    setBusy(true);
    try {
      const { added, skipped } = await onImport(rows);
      toast.success(`Imported ${added} row${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}`);
      setOpen(false);
      setRows(null);
      setFileName("");
    } catch (err) {
      console.error(err);
      toast.error("Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="inline-flex items-center rounded-md shadow-sm">
        <Button onClick={onAddClick} className="rounded-r-none">
          <Plus className="mr-2 h-4 w-4" /> {addLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-l-none border-l border-primary-foreground/20 px-2" aria-label="More add options">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Add Bulk (Excel)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={downloadTemplate}>
              <FileDown className="mr-2 h-4 w-4" /> Download Template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows(null); setFileName(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk import — {addLabel.replace(/^Add\s*/i, "")}</DialogTitle>
            <DialogDescription>
              Upload a filled Excel file. Need the format? Download the template first — it contains the correct column headers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <FileDown className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Choose Excel File
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = "";
                }}
              />
              {fileName && <span className="self-center text-sm text-muted-foreground">{fileName}</span>}
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <p className="mb-1 font-medium">Expected columns:</p>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c) => (
                  <span key={c.key} className="rounded bg-background px-2 py-0.5 border">
                    {c.label}{c.required ? " *" : ""}
                  </span>
                ))}
              </div>
            </div>

            {rows && rows.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr>{columns.map((c) => <th key={c.key} className="px-2 py-1.5 text-left font-medium">{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        {columns.map((c) => <td key={c.key} className="px-2 py-1">{r[c.key]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && <p className="p-2 text-center text-xs text-muted-foreground">…and {rows.length - 50} more rows</p>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={!rows || rows.length === 0 || busy}>
              {busy ? "Importing…" : `Import ${rows?.length ?? 0} row${(rows?.length ?? 0) === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
