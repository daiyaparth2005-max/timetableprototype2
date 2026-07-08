import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureTestUsers } from "./ensure-users.functions";

export type SpaceId = "space1" | "space2";
type User = { id: SpaceId; name: string; email: string };

const CREDENTIALS: Record<string, { email: string; user: User }> = {
  "test 1": { email: "test1@timetablemaster.local", user: { id: "space1", name: "Space 1", email: "test1@timetablemaster.local" } },
  "test 2": { email: "test2@timetablemaster.local", user: { id: "space2", name: "Space 2", email: "test2@timetablemaster.local" } },
};

function userFromEmail(email: string | undefined | null): User | null {
  if (!email) return null;
  for (const v of Object.values(CREDENTIALS)) if (v.email === email) return v.user;
  return null;
}

type Ctx = {
  user: User | null;
  hydrated: boolean;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(userFromEmail(data.session?.user?.email));
      setHydrated(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(userFromEmail(session?.user?.email));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (u: string, p: string) => {
    const entry = CREDENTIALS[u.trim()];
    if (!entry || p !== u.trim()) return false;

    // First attempt: sign in.
    let { error } = await supabase.auth.signInWithPassword({ email: entry.email, password: p });
    if (error) {
      // User might not be seeded yet on this fresh Cloud project; seed and retry.
      try {
        await ensureTestUsers();
      } catch {
        return false;
      }
      const retry = await supabase.auth.signInWithPassword({ email: entry.email, password: p });
      if (retry.error) return false;
    }
    setUser(entry.user);
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, hydrated, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
