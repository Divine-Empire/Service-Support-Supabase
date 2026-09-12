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
        amount,
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
      return { success: false, error: error.message || "Failed to send approval email" };
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
