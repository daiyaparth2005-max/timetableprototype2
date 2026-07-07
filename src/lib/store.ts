import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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

export type GeneratedCell = { subjectId: string; teacherId: string; groupLabel?: string };
export type GeneratedGrid = Record<string, GeneratedCell[][][]>; // classId -> day -> period -> cells

export type Timetable = {
  id: string;
  name: string;
  createdAt: number;
  days: string[];
  periods: Period[];
  lessons: Lesson[];
  generated?: { grid: GeneratedGrid; days: string[]; periodNames: string[]; createdAt: number } | null;
};


export type WorkspaceData = {
  staff: Staff[];
  subjects: Subject[];
  classes: ClassItem[];
  timetables: Timetable[];
};

const EMPTY: WorkspaceData = { staff: [], subjects: [], classes: [], timetables: [] };

const keyFor = (userId: string) => `tm_data_${userId}`;

export function shortNameOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]).join("").toUpperCase();
}

// Global in-memory cache per user, with subscribers
const cache = new Map<string, WorkspaceData>();
const subs = new Map<string, Set<() => void>>();

function load(userId: string): WorkspaceData {
  if (cache.has(userId)) return cache.get(userId)!;
  let data: WorkspaceData = EMPTY;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(keyFor(userId)) : null;
    if (raw) data = { ...EMPTY, ...JSON.parse(raw) };
  } catch {}
  cache.set(userId, data);
  return data;
}

function write(userId: string, next: WorkspaceData) {
  cache.set(userId, next);
  try { localStorage.setItem(keyFor(userId), JSON.stringify(next)); } catch {}
  subs.get(userId)?.forEach((fn) => fn());
}

function subscribe(userId: string, fn: () => void) {
  if (!subs.has(userId)) subs.set(userId, new Set());
  subs.get(userId)!.add(fn);
  return () => subs.get(userId)!.delete(fn);
}

export function useStore() {
  const { user } = useAuth();
  const userId = user?.id ?? "__anon__";

  const data = useSyncExternalStore(
    useCallback((cb) => subscribe(userId, cb), [userId]),
    useCallback(() => load(userId), [userId]),
    () => EMPTY
  );

  // Ensure cache is warm client-side after mount (for SSR consistency)
  useEffect(() => { load(userId); }, [userId]);

  const setData = useCallback((next: WorkspaceData) => write(userId, next), [userId]);
  const update = useCallback(
    (fn: (d: WorkspaceData) => WorkspaceData) => write(userId, fn(load(userId))),
    [userId]
  );

  return { data, setData, update };
}

export const uid = () => Math.random().toString(36).slice(2, 10);
