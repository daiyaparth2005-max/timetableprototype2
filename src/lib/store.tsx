import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth";

export type Staff = {
  id: string;
  name: string;
  shortName: string;
  email: string;
  number: string;
  designation: string;
  subject: string;
  employment: "Full-Time" | "Part-Time";
};

export type Subject = { id: string; name: string; shortName: string };

export type ClassItem = { id: string; name: string; shortName: string; classTeacherId: string };

export type Period = {
  id: string;
  name: string;
  start: string;
  end: string;
  breakAfter?: { name: string; start: string; end: string } | null;
};

export type LessonGroup = { id: string; label: string; subjectId: string; teacherId: string };

export type Lesson = {
  id: string;
  classId: string;
  split: boolean;
  subjectId: string;
  teacherId: string;
  groups: LessonGroup[];
  frequency: number;
};

export type Timetable = {
  id: string;
  name: string;
  createdAt: number;
  days: string[];
  periods: Period[];
  lessons: Lesson[];
  schedule?: Record<string, Array<{ classId: string; subjectId: string; teacherId: string } | null>>;
};

export type WorkspaceData = {
  staff: Staff[];
  subjects: Subject[];
  classes: ClassItem[];
  timetables: Timetable[];
};

const EMPTY: WorkspaceData = { staff: [], subjects: [], classes: [], timetables: [] };

function keyFor(userId: string) {
  return `tm_data_${userId}`;
}

export function shortNameOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]).join("").toUpperCase();
}

type StoreCtx = {
  data: WorkspaceData;
  loaded: boolean;
  setData: (d: WorkspaceData) => void;
  update: (fn: (d: WorkspaceData) => WorkspaceData) => void;
};

const StoreContext = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<WorkspaceData>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!user) {
      setData(EMPTY);
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(keyFor(user.id));
      setData(raw ? JSON.parse(raw) : EMPTY);
    } catch {
      setData(EMPTY);
    }
    setLoaded(true);
  }, [user]);

  const persist = useCallback(
    (next: WorkspaceData) => {
      if (user) localStorage.setItem(keyFor(user.id), JSON.stringify(next));
      setData(next);
    },
    [user]
  );

  const update = useCallback(
    (fn: (d: WorkspaceData) => WorkspaceData) => {
      setData((cur) => {
        const next = fn(cur);
        if (user) localStorage.setItem(keyFor(user.id), JSON.stringify(next));
        return next;
      });
    },
    [user]
  );

  return (
    <StoreContext.Provider value={{ data, loaded, setData: persist, update }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreContext);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
