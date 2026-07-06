import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type User = { id: "space1" | "space2"; name: string };

const USERS: Record<string, { pass: string; user: User }> = {
  "test 1": { pass: "test 1", user: { id: "space1", name: "Space 1" } },
  "test 2": { pass: "test 2", user: { id: "space2", name: "Space 2" } },
};

type Ctx = {
  user: User | null;
  login: (u: string, p: string) => boolean;
  logout: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tm_current_user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const login = (u: string, p: string) => {
    const entry = USERS[u.trim()];
    if (entry && entry.pass === p) {
      localStorage.setItem("tm_current_user", JSON.stringify(entry.user));
      setUser(entry.user);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("tm_current_user");
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
