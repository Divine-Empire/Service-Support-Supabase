import { ltoSupabase } from "./ltoClient";

const PAGE_SIZE = 1000;

// Single source of truth for the item catalog across the app. Replaces the
// old 'item_name' dropdown category (public.sss_dropdown) — items are now
// added/removed exclusively from Master > Items (src/pages/Master/Dropdown.jsx),
// which writes straight to `lto_items`, the same shared catalog table
// Lead-To-Order-Supabase-New itself uses (see ltoClient.js). Every page that
// used to read the dropdown category for item names now calls this instead.
//
// Paginated past Supabase's default 1000-row cap -- the catalog is ~3,500
// rows, so a single unpaginated .select() would silently truncate it.
export async function fetchItemNames() {
  let names = [];
  let from = 0;

  while (true) {
    const { data, error } = await ltoSupabase
      .from("lto_items")
      .select("item_name")
      .order("item_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    names = names.concat((data || []).map((r) => r.item_name).filter(Boolean));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...new Set(names)];
}
