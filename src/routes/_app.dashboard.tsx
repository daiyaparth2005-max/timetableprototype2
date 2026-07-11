import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Sparkles, GitBranch, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const LOCKED_MSG = "Purchase full API keys for the AI to access these.";

function DashboardPage() {
  const navigate = useNavigate();
  const { data } = useStore();

  const cards = [
    { title: "My Timetable", desc: "View & manage schedules", icon: CalendarDays, action: () => navigate({ to: "/timetable" }), tint: "from-primary/20 to-fuchsia-500/20", ring: "ring-primary/30" },
    { title: "AI Auto-Generate", desc: "Let AI build the perfect timetable", icon: Sparkles, locked: true, tint: "from-fuchsia-500/20 to-cyan-500/20", ring: "ring-fuchsia-400/30" },
    { title: "Conflict Analyzer", desc: "AI-powered conflict detection", icon: GitBranch, locked: true, tint: "from-cyan-500/20 to-emerald-500/20", ring: "ring-cyan-400/30" },
    { title: "Smart Suggestions", desc: "AI recommendations", icon: Wand2, locked: true, tint: "from-amber-500/20 to-rose-500/20", ring: "ring-amber-400/30" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-fuchsia-500/10 to-cyan-500/10 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl animate-float" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl animate-float" />
        <h1 className="relative font-display text-4xl font-bold bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="relative text-muted-foreground">
          {data.timetables.length} timetable{data.timetables.length === 1 ? "" : "s"} · {data.classes.length} class{data.classes.length === 1 ? "" : "es"} · {data.staff.length} staff
        </p>
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl font-semibold">Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card
              key={c.title}
              className={`group relative cursor-pointer overflow-hidden border-transparent bg-gradient-to-br ${c.tint} ring-1 ${c.ring} transition-all hover:-translate-y-1 hover:shadow-lg`}
              onClick={() => (c.locked ? toast.info(LOCKED_MSG) : c.action?.())}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 text-primary shadow-sm backdrop-blur transition-transform group-hover:scale-110">
                    <c.icon className="h-5 w-5" />
                  </div>
                  {c.locked && <Badge variant="secondary">Locked</Badge>}
                </div>
                <CardTitle className="mt-3 text-base">{c.title}</CardTitle>
                <CardDescription>{c.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
