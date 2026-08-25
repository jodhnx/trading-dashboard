import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PipelineUser = {
  id: string;
  email: string | null;
};

export async function listActiveUsers(): Promise<PipelineUser[]> {
  const admin = createAdminSupabaseClient();
  const users: PipelineUser[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data.users.length) {
      break;
    }
    for (const user of data.users) {
      users.push({ id: user.id, email: user.email ?? null });
    }
    if (data.users.length < 200) {
      break;
    }
    page += 1;
  }

  return users;
}
