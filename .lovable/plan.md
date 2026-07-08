## Problem

Right now all workspace data (staff, subjects, classes, timetables) is saved in the browser's `localStorage` under keys like `tm_data_space1`. That storage is **per-device, per-browser** — so logging in as `test 1` on a different phone/laptop starts from an empty slate, and edits made on device A never reach device B.

Also, the current "login" is fake: `test 1 / test 1` is checked against a hardcoded map in `src/lib/auth.tsx` and never talks to any server, so there is no shared identity behind the two spaces.

## Goal

Make `test 1` and `test 2` behave like real shared accounts — whichever device signs in as `test 1` sees the exact same staff / subjects / classes / timetables that any other device signed in as `test 1` has saved (like Gmail).

## Approach

Move the two spaces off `localStorage` and onto **Lovable Cloud** (managed Postgres + Auth), keeping the same two-account UX.

### 1. Enable Lovable Cloud
Turn on Cloud so we get a real database + auth. No external accounts needed.

### 2. Seed the two shared accounts
Create exactly two real auth users up-front, mapped to the existing credentials:
- `test1@timetablemaster.local` / password `test 1` → Space 1
- `test2@timetablemaster.local` / password `test 2` → Space 2

The login screen keeps showing "test 1 / test 1" and "test 2 / test 2". Under the hood it translates that to the real email + password and signs into Cloud. No signup UI — only these two fixed accounts exist.

### 3. Database schema (per-space rows)
One table per data type, each row tagged with `space_id` (`'space1'` or `'space2'`):
- `staff`, `subjects`, `classes`, `timetables`

`timetables` stores `days`, `periods`, `lessons`, and the generated `grid` as JSONB so the wizard keeps working with minimal changes.

RLS: any authenticated user can read/write rows for their own space. Since both real users are trusted shared accounts, a signed-in `test 1` session sees all `space1` rows regardless of device.

### 4. Replace the store
Rewrite `src/lib/store.ts` so instead of reading/writing `localStorage`, it:
- loads all four tables for the current `space_id` from Cloud on login,
- keeps the same `useStore()` API (`data`, `update`, `setData`) so Setup / Dashboard / Wizard / Preview / Teacher pages don't need rewrites,
- persists every change back to Cloud (upsert on edit, delete on remove).

### 5. Rewrite auth
`src/lib/auth.tsx` becomes a thin wrapper around Supabase Auth: `login("test 1","test 1")` → `signInWithPassword` with the mapped email; `logout()` → `signOut`; `user` derived from the session, with `space_id` inferred from which of the two emails is signed in.

### 6. Migration of existing local data
Existing browser `localStorage` data (what you've entered so far) is device-local and won't automatically appear in the new cloud store. Options:
- **(A) Fresh start** — cloud starts empty; re-enter data once and it syncs everywhere after that. Simplest.
- **(B) One-time push** — on first login after the switch, if `localStorage` has data for that space and cloud is empty, upload it. Preserves what you already typed on this device.

I'll implement **(B)** so you don't lose your current setup.

## Result

After this:
- Log in as `test 1` on your laptop → add a teacher → log in as `test 1` on your phone → the teacher is already there.
- `test 1` and `test 2` remain fully isolated from each other.
- Data survives cache clears, new browsers, new devices — anything.

## Files touched

- **Enable Lovable Cloud** (adds Supabase integration files)
- **New migration**: create `staff`, `subjects`, `classes`, `timetables` tables + RLS + GRANTs
- **Seed**: create the two auth users (`test1@…` / `test2@…`)
- `src/lib/auth.tsx` — swap fake auth for Supabase auth, keep same `useAuth()` API
- `src/lib/store.ts` — swap localStorage for Cloud-backed store, keep same `useStore()` API
- `src/routes/login.tsx` — translate "test 1" → email under the hood; keep UI identical
- No changes needed to Setup / Dashboard / Wizard / Preview / Teacher pages (they use `useStore`)

## One quick confirmation

Do you want me to keep the visible login exactly as **"test 1 / test 1"** and **"test 2 / test 2"** (I map to hidden emails internally), or switch the UI to real emails? I'll go with the first — same UI as today — unless you say otherwise.
