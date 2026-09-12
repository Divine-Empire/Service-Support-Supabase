import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Loader2Icon, LoaderIcon, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

// Public page — NOT behind ProtectedRoute (see App.jsx). Reached only via
// the link in the Senior Approval email
// (sss-send-tada-approval-email Edge Function), keyed entirely by the
// unguessable `token` query param — no login. This page's Approve/Reject
// action (not TADA.jsx or anything else) is what actually advances the
// ticket: Approve sets sss_tada.otp_verification_planned (via the same
// computeStagePlanned TAT logic every other stage transition uses), moving
// it into Site Visit (Verification OTP)'s Pending tab; Reject leaves it null
// forever, parking the ticket in TADA Approval's History with no path
// forward.
export default function TadaDecision() {
  const [loading, setLoading] = useState(true);
  const [approval, setApproval] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [tada, setTada] = useState(null);
  const [error, setError] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);
  const [decisionResult, setDecisionResult] = useState(null); // "approved" | "rejected" | null

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("Missing approval token.");
        setLoading(false);
        return;
      }

      try {
        const { data: approvalRow, error: approvalError } = await supabase
          .from("sss_senior_approval")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (approvalError) throw approvalError;

        if (!approvalRow) {
          setError("This approval link is invalid.");
          setLoading(false);
          return;
        }

        setApproval(approvalRow);

        const [{ data: ticketRow }, { data: tadaRow }] = await Promise.all([
          supabase.from("sss_tickets").select("*").eq("ticket_id", approvalRow.ticket_id).maybeSingle(),
          supabase.from("sss_tada").select("*").eq("ticket_id", approvalRow.ticket_id).maybeSingle(),
        ]);

        setTicket(ticketRow || null);
        setTada(tadaRow || null);
      } catch (err) {
        console.error("Error loading approval:", err);
        setError("Failed to load this approval request.");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleApprove = async () => {
    if (!approval || !tada) return;
    setIsDeciding(true);
    try {
      const otpVerificationPlanned = await computeStagePlanned("otpVerification", {
        // Base time is TADA's own submit-time timestamp — same rule every
        // other stage transition uses (see stagePlanning.js), not the
        // moment of this approval decision.
        tadaSubmittedAt: new Date(tada.created_at),
      });

      const { error: tadaError } = await supabase
        .from("sss_tada")
        .update({ otp_verification_planned: otpVerificationPlanned })
        .eq("ticket_id", approval.ticket_id);

      if (tadaError) throw tadaError;

      // Guard against a double-decision race (e.g. two tabs / double click):
      // only succeeds if this row was still 'pending'.
      const { data: updated, error: approvalError } = await supabase
        .from("sss_senior_approval")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("token", token)
        .eq("status", "pending")
        .select("id");

      if (approvalError) throw approvalError;

      if (!updated || updated.length === 0) {
        setError("This request has already been decided.");
        return;
      }

      setDecisionResult("approved");
    } catch (err) {
      console.error("Error approving:", err);
      setError("Failed to record approval. Please try again.");
    } finally {
      setIsDeciding(false);
    }
  };

  const handleReject = async () => {
    if (!approval) return;
    if (!rejectRemarks.trim()) {
      alert("Please enter a reason for rejection.");
      return;
    }
    setIsDeciding(true);
    try {
      const { data: updated, error: approvalError } = await supabase
        .from("sss_senior_approval")
        .update({
          status: "rejected",
          decided_at: new Date().toISOString(),
          reject_remarks: rejectRemarks.trim(),
        })
        .eq("token", token)
        .eq("status", "pending")
        .select("id");

      if (approvalError) throw approvalError;

      if (!updated || updated.length === 0) {
        setError("This request has already been decided.");
        return;
      }

      setDecisionResult("rejected");
    } catch (err) {
      console.error("Error rejecting:", err);
      setError("Failed to record rejection. Please try again.");
    } finally {
      setIsDeciding(false);
    }
  };

  const containerClass = "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4";

  if (loading) {
    return (
      <div className={containerClass}>
        <LoaderIcon className="animate-spin w-10 h-10 text-blue-600" />
      </div>
    );
  }

  if (decisionResult) {
    return (
      <div className={containerClass}>
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-3">
            {decisionResult === "approved" ? (
              <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            ) : (
              <XCircle className="w-14 h-14 text-red-600 mx-auto" />
            )}
            <h2 className="text-xl font-bold text-gray-800">
              Ticket {decisionResult === "approved" ? "Approved" : "Rejected"}
            </h2>
            <p className="text-gray-600">
              Thank you — your decision on ticket <strong>{approval?.ticket_id}</strong> has been recorded.
              {decisionResult === "approved"
                ? " It will now proceed to Site Visit OTP Verification."
                : " It will not proceed further."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClass}>
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Unable to process</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (approval?.status !== "pending") {
    return (
      <div className={containerClass}>
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-3">
            {approval?.status === "approved" ? (
              <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            ) : (
              <XCircle className="w-14 h-14 text-red-600 mx-auto" />
            )}
            <h2 className="text-xl font-bold text-gray-800">Already Decided</h2>
            <p className="text-gray-600">
              Ticket <strong>{approval?.ticket_id}</strong> was already{" "}
              <strong>{approval?.status === "approved" ? "approved" : "rejected"}</strong> on{" "}
              {formatDate(approval?.decided_at)}.
              {approval?.reject_remarks && (
                <>
                  <br />
                  Reason: {approval.reject_remarks}
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <Card className="max-w-2xl w-full border-0 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-lg">
          <CardTitle className="text-white">TADA / Travel Advance — Senior Approval</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="Ticket ID" value={approval.ticket_id} />
            <Field label="Company" value={ticket?.company_name} />
            <Field label="Client Name" value={ticket?.client_name} />
            <Field label="Machine Name" value={ticket?.machine_name} />
            <Field label="Engineer Assigned" value={tada?.engineer_assign || ticket?.engineer_assign} />
            <Field label="Site Address" value={ticket?.site_address} />
            <Field label="Travel Date" value={formatDate(tada?.travel_date)} />
            <Field label="Return Date" value={formatDate(tada?.return_date)} />
            <Field label="Destination" value={tada?.destination} />
            <Field label="Purpose of Travel" value={tada?.purpose_of_travel} />
            <Field label="Amount Requested" value={`₹${tada?.amount || 0}`} />
            <Field label="Previous Advance Date" value={formatDate(tada?.previous_advance_date)} />
            <Field label="Previous Advance Settlement Date" value={formatDate(tada?.previous_advance_settlement_date)} />
            <Field label="Previous Advance Balance" value={`₹${tada?.previous_advance_balance || 0}`} />
            <Field label="Balance Amount" value={`₹${tada?.balance_amount || 0}`} />
          </div>

          {!showRejectForm ? (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              <Button
                onClick={handleApprove}
                disabled={isDeciding}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {isDeciding ? <Loader2Icon className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                disabled={isDeciding}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <label className="text-sm font-medium text-gray-700">Reason for rejection *</label>
              <Textarea
                rows={3}
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Please explain why this request is being rejected"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleReject}
                  disabled={isDeciding}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeciding && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
                  Confirm Rejection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRejectForm(false)}
                  disabled={isDeciding}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 font-medium">{label}</p>
      <p className="text-gray-900">{value || "-"}</p>
    </div>
  );
}
