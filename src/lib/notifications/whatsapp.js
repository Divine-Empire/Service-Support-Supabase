import { supabase } from "../supabase/client";

// Sends the "service_request_registered" WhatsApp template to the customer
// right after a new ticket/enquiry is created. Fire-and-forget from the
// caller's point of view: this never throws — it always resolves with a
// { success, error? } shape so a WhatsApp failure never blocks ticket
// creation. All Meta credentials stay server-side in the
// send-whatsapp-notification Edge Function; nothing sensitive is sent from
// or held in the browser.
//
// Template body (Meta > WhatsApp Manager > Manage templates):
//   {{1}} Client Name   {{2}} Company Name   {{3}} Ticket ID
//   {{4}} Category      {{5}} Issue
//   {{6}}/{{7}} Service Coordinator name/phone — static, filled in by the
//   Edge Function itself (WHATSAPP_COORDINATOR_NAME / _PHONE secrets).
export async function sendServiceRequestRegisteredNotification({
  phoneNumber,
  clientName,
  companyName,
  ticketId,
  category,
  issue,
}) {
  try {
    const { data, error } = await supabase.functions.invoke("send-whatsapp-notification", {
      body: { phoneNumber, clientName, companyName, ticketId, category, issue },
    });

    if (error) {
      console.error("WhatsApp notification failed:", error);
      return { success: false, error: error.message || "Failed to send WhatsApp notification" };
    }

    if (!data?.success) {
      console.error("WhatsApp notification failed:", data?.error);
      return { success: false, error: data?.error || "Failed to send WhatsApp notification" };
    }

    return { success: true };
  } catch (error) {
    console.error("WhatsApp notification failed:", error);
    return { success: false, error: error.message || "Failed to send WhatsApp notification" };
  }
}
