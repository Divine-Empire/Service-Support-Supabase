import { supabase } from "./client";

// Single source of truth for engineer names across the app. Replaces the
// old 'engineer_assign_name' dropdown category (public.sss_dropdown) —
// engineers are now added/removed exclusively from Master > Engineer
// Contacts (public.sss_engineer_contacts), which also holds their WhatsApp
// number, email, and bank details. Every page that used to read the
// dropdown category for engineer names now calls this instead.
export async function fetchEngineerNames() {
  const { data, error } = await supabase
    .from("sss_engineer_contacts")
    .select("engineer_name")
    .order("engineer_name", { ascending: true });

  if (error) throw error;
  return [...new Set((data || []).map((r) => r.engineer_name))].filter(Boolean);
}
