import { supabase } from "./client";

// Read-only client for the production Lead-To-Order-Supabase-New project's
// tables (lto_client_master, lto_dropdown, etc.) — used to source master/
// dropdown data (consignor details, bank details, product master,
// prepared-by/reference lists) for the GST quotation builder
// (src/pages/Quotation/) — never for writes there.
//
// Historically this pointed at a separate Supabase project via its own
// VITE_LTO_SUPABASE_URL/VITE_LTO_SUPABASE_ANON_KEY and a second createClient()
// call. Since the schema migration into the Divine production project
// (2026-09-04), this app's own sss_/engg_dsb_ schema and the lto_* schema
// live in the SAME Supabase project — so `ltoSupabase` is now just an alias
// for the one client in ./client.js. Kept as a separate named export (rather
// than updating every lto_* call site to import `supabase` directly) so the
// naming at each call site still signals "this is LTO production data",
// and to avoid a large mechanical diff across the 5 files that use it.
export const ltoSupabase = supabase;
