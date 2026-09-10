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

// Sends the video-call-scheduled WhatsApp templates for a new ticket with
// Video-Call = "Yes" — THREE messages, sent in this order:
//   1. "service_request_registered" to the client (immediately) — only
//      when companyName + category are passed; omit them to skip this and
//      only send the video-call template (e.g. if the caller already sent
//      the "registered" message itself).
//   2. "video_call_has_been_scheduled" to the client, after a fixed delay
//   3. "video_call_scheduled_for_engineers" to the assigned engineer
//      (looked up server-side from sss_engineer_contacts by name)
// The 1-then-2 ordering and delay both happen server-side in the Edge
// Function — NOT via a browser-side timer — so it holds even if this tab
// closes right after the request is sent. Never throws; the registered and
// engineer legs are best-effort, so neither blocks the video-call message.
//
// service_request_registered body:
//   {{1}} Client Name  {{2}} Company Name  {{3}} Ticket ID
//   {{4}} Category     {{5}} Issue         {{6}}/{{7}} Coordinator name/phone
// video_call_has_been_scheduled body:
//   {{1}} Client Name  {{2}} Ticket ID   {{3}} Issue        {{4}} Engineer
//   {{5}} Date         {{6}} Time        {{7}} Service Reference (OTP)
//   {{8}}/{{9}} Service Coordinator name/phone — static, filled in by the
//   Edge Function (WHATSAPP_COORDINATOR_NAME / _PHONE secrets).
// video_call_scheduled_for_engineers body:
//   {{1}} Engineer Name  {{2}} Ticket ID  {{3}} Issue
//   {{4}} Date           {{5}} Time       {{6}}/{{7}} Coordinator name/phone
export async function sendVideoCallScheduledNotifications({
  clientPhoneNumber,
  clientName,
  companyName,
  category,
  ticketId,
  issue,
  engineerName,
  dateStr,
  timeStr,
  otp,
}) {
  try {
    const { data, error } = await supabase.functions.invoke("send-video-call-notifications", {
      body: { clientPhoneNumber, clientName, companyName, category, ticketId, issue, engineerName, dateStr, timeStr, otp },
    });

    if (error) {
      console.error("Video-call WhatsApp notification failed:", error);
      return { success: false, error: error.message || "Failed to send video-call WhatsApp notifications" };
    }

    if (data?.registered && !data.registered.success) {
      console.error("Video-call WhatsApp notification (registered leg) failed:", data.registered.error);
    }
    if (!data?.success) {
      console.error("Video-call WhatsApp notification (client leg) failed:", data?.client?.error);
    }
    if (!data?.engineer?.success) {
      console.warn("Video-call WhatsApp notification (engineer leg) failed:", data?.engineer?.error);
    }

    return {
      success: !!data?.success,
      error: data?.success ? undefined : data?.client?.error || "Failed to send WhatsApp notification to client",
      engineerNotified: !!data?.engineer?.success,
      engineerError: data?.engineer?.success ? undefined : data?.engineer?.error,
    };
  } catch (error) {
    console.error("Video-call WhatsApp notification failed:", error);
    return { success: false, error: error.message || "Failed to send video-call WhatsApp notifications" };
  }
}

// Sends the video-call-rescheduled WhatsApp templates — one to the client
// ("your_video_call_has_been_rescheduled"), one to the newly-assigned
// Alternate Engineer ("video_call_rescheduled", looked up server-side from
// sss_engineer_contacts by name). Called only from VideoCallSolution.jsx
// when "Video Call Services Solve" = "Rescheduled". Never throws; the
// engineer leg is best-effort server-side, so a missing engineer contact
// never blocks the client's message.
//
// Client template body:
//   {{1}} Client Name  {{2}} Ticket ID        {{3}} Issue  {{4}} Engineer
//   {{5}} Rescheduled Date  {{6}} Rescheduled Time  {{7}} Service Reference (OTP)
//   {{8}}/{{9}} Service Coordinator name/phone — static, filled in by the
//   Edge Function (WHATSAPP_COORDINATOR_NAME / _PHONE secrets).
// Engineer template body (video_call_rescheduled_for_engineer):
//   {{1}} Engineer Name  {{2}} Ticket ID  {{3}} Issue
//   {{4}} Rescheduled Date  {{5}} Rescheduled Time  {{6}}/{{7}} Coordinator name/phone
export async function sendVideoCallRescheduledNotifications({
  clientPhoneNumber,
  clientName,
  ticketId,
  issue,
  engineerName,
  dateStr,
  timeStr,
  otp,
}) {
  try {
    const { data, error } = await supabase.functions.invoke("send-video-call-rescheduled-notifications", {
      body: { clientPhoneNumber, clientName, ticketId, issue, engineerName, dateStr, timeStr, otp },
    });

    if (error) {
      console.error("Video-call rescheduled WhatsApp notification failed:", error);
      return { success: false, error: error.message || "Failed to send video-call rescheduled WhatsApp notifications" };
    }

    if (!data?.success) {
      console.error("Video-call rescheduled WhatsApp notification (client leg) failed:", data?.client?.error);
    }
    if (!data?.engineer?.success) {
      console.warn("Video-call rescheduled WhatsApp notification (engineer leg) failed:", data?.engineer?.error);
    }

    return {
      success: !!data?.success,
      error: data?.success ? undefined : data?.client?.error || "Failed to send WhatsApp notification to client",
      engineerNotified: !!data?.engineer?.success,
      engineerError: data?.engineer?.success ? undefined : data?.engineer?.error,
    };
  } catch (error) {
    console.error("Video-call rescheduled WhatsApp notification failed:", error);
    return { success: false, error: error.message || "Failed to send video-call rescheduled WhatsApp notifications" };
  }
}
