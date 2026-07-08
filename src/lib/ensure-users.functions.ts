import { createServerFn } from "@tanstack/react-start";

const SEED_USERS = [
  { email: "test1@timetablemaster.local", password: "test 1" },
  { email: "test2@timetablemaster.local", password: "test 2" },
];

// Idempotently ensure both shared prototype accounts exist. Safe to call every
// time the login page mounts — createUser is a no-op if the user is already there.
export const ensureTestUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const u of SEED_USERS) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    // Ignore "already exists" errors; surface anything else.
    if (error && !/already|registered|exists/i.test(error.message)) {
      throw new Error(`Failed to seed ${u.email}: ${error.message}`);
    }
  }
  return { ok: true };
});
