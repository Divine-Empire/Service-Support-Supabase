import { supabase } from "../supabase/client";

// Sends the Senior Approval email (via Resend) for a ticket's TADA/Travel
// Advance request. Called from two places:
//   1. TADA.jsx's handleSubmit — automatically, right after the
//      sss_senior_approval row (with its token) is created.
//   2. TadaApproval.jsx's "Resend Email" button — manually, if the first
//      attempt didn't reach the senior/accounts team.
// Never throws — resolves with a { success, error? } shape so an email
// failure never blocks the TADA submission, which has already succeeded by
// the time this is called. All Resend credentials stay server-side in the
// sss-send-tada-approval-email Edge Function.
//
// Recipients (To/CC) are NOT passed here — the Edge Function reads them
// itself from sss_tada_approval_recipients (Master-page managed) plus the
// assigned engineer's own email (sss_engineer_contacts), so there's nothing
// to keep in sync on the frontend.
// supabase-js reports any non-2xx as the generic "Edge Function returned a non-2xx status code" and hides the
// real reason in error.context (the Response). Pull the function's own message out so the user sees it.
async function functionErrorMessage(error, fallback) {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // body was not JSON; use the generic message
  }
  return error?.message || fallback;
}

export async function sendTadaApprovalEmail({
  token,
  ticketId,
  companyName,
  siteAddress,
  machineName,
  travelDate,
  returnDate,
  amount,
  purposeOfTravel,
  previousAdvanceDate,
  previousAdvanceSettlementDate,
  previousAdvanceBalance,
  balanceAmount,
  engineerName,
}) {
  try {
    const { data, error } = await supabase.functions.invoke("sss-send-tada-approval-email", {
      body: {
        token,
        ticketId,
        companyName,
        siteAddress,
        machineName,
        travelDate,
        returnDate,
        // String() so a legitimate 0 is not mistaken for "missing" by the function's required-field check.
        amount: amount === null || amount === undefined ? "" : String(amount),
        purposeOfTravel,
        previousAdvanceDate,
        previousAdvanceSettlementDate,
        previousAdvanceBalance,
        balanceAmount,
        engineerName,
      },
    });

    if (error) {
      console.error("TADA approval email failed:", error);
      return { success: false, error: await functionErrorMessage(error, "Failed to send approval email") };
    }

    if (!data?.success) {
      console.error("TADA approval email failed:", data?.error);
      return { success: false, error: data?.error || "Failed to send approval email" };
    }

    return { success: true };
  } catch (error) {
    console.error("TADA approval email failed:", error);
    return { success: false, error: error.message || "Failed to send approval email" };
  }
}
