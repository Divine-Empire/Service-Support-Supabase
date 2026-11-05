import { supabase } from "../../lib/supabase/client";

// Uploads to the shared "ticket_enquiry" Storage bucket (same convention as Ticket-and-Enquiry's
// uploads) and returns the public URL.
export async function uploadFileToStorage(file, folder, prefix) {
  const path = `${folder}/${prefix}_${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("ticket_enquiry")
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
  return data.publicUrl;
}
