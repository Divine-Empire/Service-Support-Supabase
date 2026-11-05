import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";

// No advance payment is collected for these payment modes, so the Advance Payment Attachment
// field is not rendered (and not required / saved) for them.
export const NO_ADVANCE_MODES = ["FOC", "Full On Credit"];
export const needsAdvanceAttachment = (mode) => !!mode && !NO_ADVANCE_MODES.includes(mode);

// Uploads one Follow-Up attachment to the ticket_enquiry bucket and returns its public URL.
// Throws on failure (callers toast).
export async function uploadFollowUpFile(ticketId, file) {
  const path = `follow_up/${ticketId}_${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("ticket_enquiry").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("ticket_enquiry").getPublicUrl(path).data.publicUrl;
}

// Next stage once an order is confirmed and not on hold:
//   Site Visit ticket -> site_visit_planned (Site Visit -> TADA -> OTP -> CRM -> Invoice)
//   FOC               -> nothing (no invoice)
//   anything else     -> invoice_planned (Invoice TAT)
// existingSiteVisitPlanned keeps a legacy row's earlier stamp.
export const computeOrderPlanned = async ({ serviceType, paymentMode, baseTime, existingSiteVisitPlanned }) => {
  if (serviceType === "Site Visit") {
    return {
      site_visit_planned: existingSiteVisitPlanned || baseTime.toISOString(),
      invoice_planned: null,
    };
  }
  if (paymentMode === "FOC") return { site_visit_planned: null, invoice_planned: null };
  return {
    site_visit_planned: null,
    invoice_planned: await computeStagePlanned("invoice", { orderReceivedSubmittedAt: baseTime }),
  };
};
