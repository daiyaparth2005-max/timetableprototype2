import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatTimetableAssistant } from "@/lib/timetable-ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Trash2 } from "lucide-react";
import { useStore, uid, type Timetable, type Preference } from "@/lib/store";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const PREF_RE = /<preference>\s*({[^}]+})\s*<\/preference>/i;

export function TimetableChat({ tt }: { tt: Timetable }) {
  const { data, update } = useStore();
  const chat = useServerFn(chatTimetableAssistant);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm your timetable co-pilot. Ask me anything, or tell me a preference like 'keep coding classes in the last period for grade 12' and I'll save it for the generator.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({
        data: {
          messages: next.slice(-8),
          context: {
            timetableName: tt.name,
            days: tt.days,
            periodNames: tt.periods.map((p) => p.name),
            classes: data.classes.map((c) => ({ id: c.id, name: c.name, section: c.section })),
            subjects: data.subjects.map((s) => ({ id: s.id, name: s.name, shortName: s.shortName })),
            staff: data.staff.map((s) => ({
              id: s.id,
              name: s.name,
              shortName: s.shortName,
              subject: s.subject,
            })),
            lessons: tt.lessons.map((l) => ({
              classId: l.classId,
              subject: data.subjects.find((s) => s.id === l.subjectId)?.name ?? "?",
              teacher: data.staff.find((s) => s.id === l.teacherId)?.name ?? "?",
              frequency: l.frequency,
              split: l.split,
            })),
            preferences: (tt.preferences ?? []).map((p) => ({ id: p.id, text: p.text })),
            hasGenerated: !!tt.generated,
          },
        },
      });

      let reply = res.text ?? "";
      const match = reply.match(PREF_RE);
      let capturedPref: string | null = null;
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed?.text) capturedPref = String(parsed.text);
        } catch {}
        reply = reply.replace(PREF_RE, "").trim();
      }
      setMessages((m) => [...m, { role: "assistant", content: reply || "…" }]);

      if (capturedPref) {
        const pref: Preference = { id: uid(), text: capturedPref, createdAt: Date.now() };
        update((d) => ({
          ...d,
          timetables: d.timetables.map((t) =>
            t.id === tt.id ? { ...t, preferences: [...(t.preferences ?? []), pref] } : t
          ),
        }));
        toast.success("Preference saved");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  };

  const removePref = (pid: string) =>
    update((d) => ({
      ...d,
      timetables: d.timetables.map((t) =>
        t.id === tt.id ? { ...t, preferences: (t.preferences ?? []).filter((p) => p.id !== pid) } : t
      ),
    }));

  const prefs = tt.preferences ?? [];

  return (
    <Card className="border-primary/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prefs.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Saved preferences</div>
            <div className="flex flex-wrap gap-1.5">
              {prefs.map((p) => (
                <Badge key={p.id} variant="secondary" className="group gap-1 pr-1">
                  <span className="max-w-[240px] truncate">{p.text}</span>
                  <button
                    onClick={() => removePref(p.id)}
                    className="opacity-40 hover:opacity-100"
                    aria-label="Remove preference"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div
          ref={scrollRef}
          className="max-h-72 space-y-2 overflow-y-auto rounded-lg border bg-background/40 p-3 text-sm"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-foreground"
                  : "mr-8 whitespace-pre-wrap text-foreground/90"
              }
            >
              {m.content}
            </div>
          ))}
          {busy && <div className="mr-8 animate-pulse text-muted-foreground">Thinking…</div>}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="e.g. keep CUET in last periods for grade 12"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
