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

// Who is assigned at each stage, per ticket. They are stored separately:
//   siteVisit -> sss_site_visit.engineer_assign (active, non-rescheduled row)
//   videoCall -> sss_video_call.alternate_engineer (latest non-empty)
// Returns Map(ticket_id -> { siteVisit, videoCall }).
export async function fetchTicketEngineers(ticketIds) {
  const out = new Map();
  if (!ticketIds || ticketIds.length === 0) return out;
  const get = (id) => {
    if (!out.has(id)) out.set(id, { siteVisit: "", videoCall: "" });
    return out.get(id);
  };

  const [sv, vc] = await Promise.all([
    supabase
      .from("sss_site_visit")
      .select("ticket_id, engineer_assign, created_at")
      .in("ticket_id", ticketIds)
      .is("rescheduled_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("sss_video_call")
      .select("ticket_id, alternate_engineer, created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: false }),
  ]);
  if (sv.error) throw sv.error;
  if (vc.error) throw vc.error;

  (sv.data || []).forEach((r) => {
    const e = get(r.ticket_id);
    if (!e.siteVisit && r.engineer_assign) e.siteVisit = r.engineer_assign;
  });
  (vc.data || []).forEach((r) => {
    const e = get(r.ticket_id);
    if (!e.videoCall && r.alternate_engineer) e.videoCall = r.alternate_engineer;
  });
  return out;
}

// Engineer name + WhatsApp number pairs from Master > Engineer List, for dropdowns that need both.
export async function fetchEngineerContacts() {
  const { data, error } = await supabase
    .from("sss_engineer_contacts")
    .select("engineer_name, phone_number")
    .order("engineer_name", { ascending: true });

  if (error) throw error;
  return (data || []).filter((r) => r.engineer_name);
}
