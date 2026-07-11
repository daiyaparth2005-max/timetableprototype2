import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Settings, LogOut, CalendarClock, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, hydrated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !user) navigate({ to: "/login" });
  }, [user, hydrated, navigate]);

  if (!hydrated || !user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar userName={user.name} onLogout={() => { logout(); navigate({ to: "/login" }); }} />
        <div className="flex flex-1 flex-col">
          <div className="relative overflow-hidden border-b bg-gradient-to-r from-primary/15 via-fuchsia-500/15 to-cyan-500/15">
            <div className="flex whitespace-nowrap py-1.5 text-xs font-medium tracking-wide animate-marquee">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex shrink-0 items-center gap-8 px-6">
                  <span>✨ TimetableMaster</span>
                  <span className="text-fuchsia-600">◆ Drag & drop periods</span>
                  <span className="text-cyan-600">✦ Click any slot to edit</span>
                  <span className="text-emerald-600">● AI co-pilot below</span>
                  <span className="text-amber-600">★ Cross-device sync</span>
                  <span className="text-primary">◇ Colorful schedules</span>
                </div>
              ))}
            </div>
          </div>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/70 px-4 backdrop-blur-lg">
            <SidebarTrigger />
            <div className="flex items-center gap-2 font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-vibrant text-white shadow-sm">
                <CalendarClock className="h-4 w-4" />
              </div>
              <span className="font-display text-gradient-rainbow">TimetableMaster</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">{user.name}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-ring" />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const items = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Setup", url: "/setup", icon: Settings },
    { title: "Substitution", url: "/substitution", icon: UserX },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-vibrant text-white shadow-md">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-semibold text-gradient-rainbow">TimetableMaster</span>
            <span className="text-xs text-muted-foreground">{userName}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button variant="ghost" size="sm" onClick={onLogout} className="justify-start">
          <LogOut className="mr-2 h-4 w-4" /> <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
