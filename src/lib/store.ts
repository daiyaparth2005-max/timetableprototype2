import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth, type SpaceId } from "./auth";
import { supabase } from "@/integrations/supabase/client";

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

export const SECTIONS = ["N-3", "4-5", "6-8", "9-12"] as const;
export type SectionKey = typeof SECTIONS[number];

export type ClassItem = {
  id: string;
  name: string;
  shortName: string;
  classTeacherId: string;
  section?: SectionKey;
};

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

export type GeneratedCell = { subjectId: string; teacherId: string; groupLabel?: string; combinedId?: string };
export type GeneratedGrid = Record<string, GeneratedCell[][][]>;

export type Assembly = { name: string; start: string; end: string };

export type Preference = {
  id: string;
  text: string;
  createdAt: number;
};

export type Timetable = {
  id: string;
  name: string;
  createdAt: number;
  days: string[];
  periods: Period[];
  lessons: Lesson[];
  assembly?: Assembly | null;
  preferences?: Preference[];
  generated?: { grid: GeneratedGrid; days: string[]; periodNames: string[]; createdAt: number } | null;
};

export type WorkspaceData = {
  staff: Staff[];
  subjects: Subject[];
  classes: ClassItem[];
  timetables: Timetable[];
};

const EMPTY: WorkspaceData = { staff: [], subjects: [], classes: [], timetables: [] };

export function shortNameOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]).join("").toUpperCase();
}

export const uid = () => Math.random().toString(36).slice(2, 10);

// ---- Cloud-backed store ----
// One row per space in public.workspace_data. Data is cached in memory,
// hydrated once on login, and every mutation is upserted back.

const cache = new Map<SpaceId, WorkspaceData>();
const subs = new Map<SpaceId, Set<() => void>>();
const loaded = new Set<SpaceId>();
const loading = new Map<SpaceId, Promise<void>>();

const LEGACY_KEY = (id: SpaceId) => `tm_data_${id}`;

function notify(space: SpaceId) {
  subs.get(space)?.forEach((fn) => fn());
}

function subscribe(space: SpaceId, fn: () => void) {
  if (!subs.has(space)) subs.set(space, new Set());
  subs.get(space)!.add(fn);
  return () => subs.get(space)!.delete(fn);
}

function readLegacyLocal(space: SpaceId): WorkspaceData | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LEGACY_KEY(space)) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return { ...EMPTY, ...parsed };
  } catch {
    return null;
  }
}

function isEmpty(d: WorkspaceData) {
  return d.staff.length === 0 && d.subjects.length === 0 && d.classes.length === 0 && d.timetables.length === 0;
}

async function hydrate(space: SpaceId) {
  if (loaded.has(space)) return;
  if (loading.has(space)) return loading.get(space);

  const p = (async () => {
    const { data, error } = await supabase
      .from("workspace_data")
      .select("staff,subjects,classes,timetables")
      .eq("space_id", space)
      .maybeSingle();

    let next: WorkspaceData = EMPTY;
    if (!error && data) {
      next = {
        staff: (data.staff as Staff[]) ?? [],
        subjects: (data.subjects as Subject[]) ?? [],
        classes: (data.classes as ClassItem[]) ?? [],
        timetables: (data.timetables as Timetable[]) ?? [],
      };
    }

    // One-time migration: if cloud is empty but this device has legacy
    // localStorage data, upload it so the user doesn't lose their setup.
    if (isEmpty(next)) {
      const legacy = readLegacyLocal(space);
      if (legacy && !isEmpty(legacy)) {
        next = legacy;
        await supabase.from("workspace_data").update(next).eq("space_id", space);
        try { localStorage.removeItem(LEGACY_KEY(space)); } catch {}
      }
    }

    cache.set(space, next);
    loaded.add(space);
    notify(space);
  })();

  loading.set(space, p);
  try { await p; } finally { loading.delete(space); }
}

async function persist(space: SpaceId, next: WorkspaceData) {
  cache.set(space, next);
  notify(space);
  const { error } = await supabase.from("workspace_data").update(next).eq("space_id", space);
  if (error) console.error("[store] persist failed", error);
}

function getSnapshot(space: SpaceId): WorkspaceData {
  return cache.get(space) ?? EMPTY;
}

export function useStore() {
  const { user } = useAuth();
  const space = (user?.id ?? "space1") as SpaceId;

  const data = useSyncExternalStore(
    useCallback((cb) => subscribe(space, cb), [space]),
    useCallback(() => getSnapshot(space), [space]),
    () => EMPTY
  );

  useEffect(() => {
    if (user) void hydrate(space);
  }, [space, user]);

  const setData = useCallback((next: WorkspaceData) => { void persist(space, next); }, [space]);
  const update = useCallback(
    (fn: (d: WorkspaceData) => WorkspaceData) => { void persist(space, fn(getSnapshot(space))); },
    [space]
  );

  return { data, setData, update };
}
