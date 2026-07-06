import { useCallback, useEffect, useState } from "react";
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
  days: string[]; // Sunday-Saturday
  periods: Period[];
  lessons: Lesson[];
  // schedule[day][periodIdx] = { classId, subjectId, teacherId } or split array
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
  return parts
    .slice(0, 3)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function useStore() {
  const { user } = useAuth();
  const [data, setData] = useState<WorkspaceData>(EMPTY);

  useEffect(() => {
    if (!user) {
      setData(EMPTY);
      return;
    }
    try {
      const raw = localStorage.getItem(keyFor(user.id));
      setData(raw ? JSON.parse(raw) : EMPTY);
    } catch {
      setData(EMPTY);
    }
  }, [user]);

  const persist = useCallback(
    (next: WorkspaceData) => {
      if (!user) return;
      localStorage.setItem(keyFor(user.id), JSON.stringify(next));
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

  return { data, setData: persist, update };
}

export const uid = () => Math.random().toString(36).slice(2, 10);
