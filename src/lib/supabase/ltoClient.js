import { createClient } from "@supabase/supabase-js";

// Read-only client for the production Lead-To-Order-Supabase-New project.
// Used only to source master/dropdown data (consignor details, bank details,
// product master, prepared-by/reference lists) for the GST quotation builder
// (src/pages/Quotation/) — never for writes. All quotation data is still
// saved into this testing project's own Supabase (see ./client.js).
const ltoSupabaseUrl = import.meta.env.VITE_LTO_SUPABASE_URL;
const ltoSupabaseAnonKey = import.meta.env.VITE_LTO_SUPABASE_ANON_KEY;

export const ltoSupabase = createClient(ltoSupabaseUrl, ltoSupabaseAnonKey);
