import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { briefFromRow, toBriefInsertRow, type BriefInsert } from "./map-row";
import type { DailyBriefRecord } from "./types";

export async function findBriefByDate(input: {
  userId: string;
  briefDate: string;
  now?: Date;
}): Promise<DailyBriefRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("user_id", input.userId)
    .eq("brief_date", input.briefDate)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return briefFromRow(data, input.now);
}

export async function listBriefHistory(input: {
  userId: string;
  limit: number;
  now?: Date;
}): Promise<DailyBriefRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("user_id", input.userId)
    .order("brief_date", { ascending: false })
    .limit(input.limit);
  if (error || !data) {
    return [];
  }
  return data.map((row) => briefFromRow(row, input.now));
}

export async function persistBrief(
  input: BriefInsert,
): Promise<DailyBriefRecord | null> {
  const supabase = await createServerSupabaseClient();
  const row = toBriefInsertRow(input);
  const inserted = await supabase
    .from("daily_briefs")
    .insert(row)
    .select("*")
    .single();
  if (inserted.error || !inserted.data) {
    return null;
  }
  return briefFromRow(inserted.data);
}
