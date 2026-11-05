import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Modal } from "../../components/ui/modal";
import TimePicker12 from "../../components/ui/time-picker-12";
import { Loader2Icon } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { sendTadaApprovalEmail } from "../../lib/notifications/email";

const formatInputDate = (dateStr) => {
  if (!dateStr) return "";
  const str = String(dateStr).trim().split(" ")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) {
      year = "20" + year;
    }
    return `${year}-${month}-${day}`;
  }

  const matchY = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (matchY) {
    const year = matchY[1];
    const month = matchY[2].padStart(2, "0");
    const day = matchY[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch { /* fall through to blank */ }

  return "";
};

// The TADA request form for one pending ticket. Render it only while a ticket is selected;
// `onClose` closes it, `onSaved` runs after a successful save (the page reloads its lists).
export default function TadaFormModal({ ticket: selectedTicket, onClose, onSaved }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const ticket = selectedTicket;
  const [formData, setFormData] = useState(() => (
    {
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      enquiryReceiverName: ticket.enquiryReceiverName || "",
      warrantyCheck: ticket.warrantyCheck || "",
      machineName: ticket.machineName || "",
      engineerAssign: ticket.engineerAssign || "",
      siteName: ticket.siteAddress || ticket.siteName || "",
      dateOfVisit: ticket.dateOfVisit || "",
      transportation: ticket.transportation || "",
      travelDate: formatInputDate(ticket.dateOfVisit),
      returnDate: "",
      destination: "",
      purposeOfTravel: "",
      amount: "",
      expectedCompletionDate: "",
      expectedCompletionTime: "",
      // Accounts/approval-email fields — NOT yet wired into handleSubmit's
      // insert payload (sss_tada has no columns for these yet). UI-only
      // pending approval of the layout; see the Senior Approval feature plan.
      previousAdvanceDate: "",
      previousAdvanceSettlementDate: "",
      previousAdvanceBalance: "",
      balanceAmount: "",
    }
  ));

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // TimePicker12 isn't a native input, so it can't carry a `required`
    // attribute like the rest of this form's fields — validate manually.
    if (!formData.expectedCompletionTime) {
      toast({
        title: "Error",
        description: "Please select Expected Completion Time",
        variant: "destructive",
      });
      return;
    }

    if (
      !formData.previousAdvanceDate ||
      !formData.previousAdvanceSettlementDate ||
      formData.previousAdvanceBalance === "" ||
      formData.previousAdvanceBalance === undefined ||
      formData.previousAdvanceBalance === null ||
      formData.balanceAmount === "" ||
      formData.balanceAmount === undefined ||
      formData.balanceAmount === null
    ) {
      toast({
        title: "Error",
        description: "Please fill in all Previous Advance Details fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true); // Start loading

    try {
      // otp_verification_planned is NOT set here anymore — a new Senior
      // Approval stage now sits between TADA and Site Visit (Verification
      // OTP). It only gets set once a senior approves this ticket's
      // TADA/advance request on the public /tada-decision page; rejecting
      // leaves it null forever, parking the ticket in TADA Approval's
      // History with no path forward.
      const { error } = await supabase.from("sss_tada").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        travel_date: formData.travelDate || null,
        return_date: formData.returnDate || null,
        destination: formData.destination || null,
        purpose_of_travel: formData.purposeOfTravel || null,
        amount: formData.amount || null,
        expected_completion_date: formData.expectedCompletionDate || null,
        expected_completion_time: formData.expectedCompletionTime || null,
        previous_advance_date: formData.previousAdvanceDate || null,
        previous_advance_settlement_date: formData.previousAdvanceSettlementDate || null,
        previous_advance_balance: formData.previousAdvanceBalance || null,
        balance_amount: formData.balanceAmount || null,
      });

      if (error) throw error;

      // Create the Senior Approval tracking row + fire its email. Neither
      // failing should undo the TADA submission above — worst case, the
      // ticket just sits in TADA Approval's Pending tab until someone uses
      // its "Resend Email" button.
      const token = crypto.randomUUID();
      const { error: approvalError } = await supabase.from("sss_senior_approval").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        token,
      });

      if (approvalError) {
        console.error("Error creating senior approval record:", approvalError);
        toast({
          title: "Warning",
          description: "TADA saved, but the approval request record could not be created.",
          variant: "destructive",
        });
      } else {
        sendTadaApprovalEmail({
          token,
          ticketId: selectedTicket.ticketId,
          companyName: selectedTicket.companyName,
          siteAddress: formData.siteName || selectedTicket.siteAddress,
          machineName: formData.machineName,
          travelDate: formData.travelDate,
          returnDate: formData.returnDate,
          amount: formData.amount,
          purposeOfTravel: formData.purposeOfTravel,
          previousAdvanceDate: formData.previousAdvanceDate,
          previousAdvanceSettlementDate: formData.previousAdvanceSettlementDate,
          previousAdvanceBalance: formData.previousAdvanceBalance,
          balanceAmount: formData.balanceAmount,
          engineerName: formData.engineerAssign || selectedTicket.engineerAssign,
        }).then(({ success, error: emailError }) => {
          if (!success) {
            toast({
              title: "Approval email not sent",
              description: emailError || "TADA saved, but the approval email could not be sent. Use 'Resend Email' from the TADA Approval page.",
              variant: "destructive",
            });
          }
        });
      }

      toast({
        title: "Success",
        description: "Ticket details saved — sent for Senior Approval.",
      });

      onClose();
      onSaved();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save ticket details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <Modal
        isOpen
        onClose={onClose}
        title="TADA (Travel and Daily Allowance)"
        size="2xl"
      >
        <div className="max-h-[70vh] overflow-y-auto rounded-lg bg-card">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Pre-filled fields */}
              {[
                ["tada-ticketId", "Ticket ID", "ticketId"],
                ["tada-clientName", "Client Name", "clientName"],
                ["tada-phoneNumber", "Phone Number", "phoneNumber"],
                ["tada-machineName", "Machine Name", "machineName"],
                ["tada-engineerAssign", "Engineer Assign", "engineerAssign"],
                ["tada-siteName", "Site Name", "siteName"],
              ].map(([id, label, field]) => (
                <div key={id} className="space-y-1">
                  <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
                  <Input id={id} value={formData[field] || ""} disabled className="bg-muted" />
                </div>
              ))}

              {/* Editable fields */}
              <div className="space-y-1">
                <Label htmlFor="tada-travelDate" className="text-muted-foreground">Travel Date *</Label>
                <Input
                  id="tada-travelDate"
                  type="date"
                  value={formData.travelDate || ""}
                  data-testid="input-travel-date"
                  className="cursor-not-allowed bg-muted"
                  disabled
                  readOnly
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tada-returnDate" className="text-muted-foreground">Return Date *</Label>
                <Input
                  id="tada-returnDate"
                  type="date"
                  value={formData.returnDate || ""}
                  onChange={(e) => handleInputChange("returnDate", e.target.value)}
                  data-testid="input-return-date"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tada-destination" className="text-muted-foreground">Destination *</Label>
                <Input
                  id="tada-destination"
                  placeholder="Enter destination"
                  value={formData.destination || ""}
                  onChange={(e) => handleInputChange("destination", e.target.value)}
                  data-testid="input-destination"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tada-purpose" className="text-muted-foreground">Purpose of Travel *</Label>
                <Input
                  id="tada-purpose"
                  placeholder="Enter purpose"
                  value={formData.purposeOfTravel || ""}
                  onChange={(e) => handleInputChange("purposeOfTravel", e.target.value)}
                  data-testid="input-purpose"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tada-expectedCompletionDate" className="text-muted-foreground">Expected Completion Date *</Label>
                <Input
                  id="tada-expectedCompletionDate"
                  type="date"
                  value={formData.expectedCompletionDate || ""}
                  onChange={(e) => handleInputChange("expectedCompletionDate", e.target.value)}
                  required
                  data-testid="input-expected-completion-date"
                />
              </div>

              <div className="space-y-1">
                <Label id="tada-expectedCompletionTime-label" className="text-muted-foreground">Expected Completion Time *</Label>
                {/* UI shows 12-hour AM/PM; underlying value stays 24-hour
                    "HH:MM" (same as the DB column) — see TimePicker12. */}
                <div role="group" aria-labelledby="tada-expectedCompletionTime-label">
                  <TimePicker12
                    value={formData.expectedCompletionTime || ""}
                    onChange={(val) => handleInputChange("expectedCompletionTime", val)}
                  />
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="tada-amount" className="text-muted-foreground">Amount *</Label>
                <Input
                  id="tada-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={formData.amount || ""}
                  onChange={(e) => handleInputChange("amount", e.target.value)}
                  data-testid="input-amount"
                />
              </div>

              {/* Accounts / approval-email fields — pending DB columns +
                  backend wiring (see Senior Approval feature plan). Captured
                  in formData already, but not yet sent to sss_tada. */}
              <div className="border-t border-border pt-4 md:col-span-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Previous Advance Details (for Accounts Approval Email)
                </h4>
              </div>

              <div className="space-y-1">
                <Label htmlFor="tada-previousAdvanceDate" className="text-muted-foreground">Previous Advance Date *</Label>
                <Input
                  id="tada-previousAdvanceDate"
                  type="date"
                  value={formData.previousAdvanceDate || ""}
                  onChange={(e) => handleInputChange("previousAdvanceDate", e.target.value)}
                  data-testid="input-previous-advance-date"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tada-previousAdvanceSettlementDate" className="text-muted-foreground">Previous Advance Settlement Date *</Label>
                <Input
                  id="tada-previousAdvanceSettlementDate"
                  type="date"
                  value={formData.previousAdvanceSettlementDate || ""}
                  onChange={(e) => handleInputChange("previousAdvanceSettlementDate", e.target.value)}
                  data-testid="input-previous-advance-settlement-date"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tada-previousAdvanceBalance" className="text-muted-foreground">Previous Advance Balance (₹) *</Label>
                <Input
                  id="tada-previousAdvanceBalance"
                  type="number"
                  placeholder="Amount left over from the previous advance"
                  value={formData.previousAdvanceBalance || ""}
                  onChange={(e) => handleInputChange("previousAdvanceBalance", e.target.value)}
                  data-testid="input-previous-advance-balance"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="tada-balanceAmount" className="text-muted-foreground">Balance Amount (₹) *</Label>
                <Input
                  id="tada-balanceAmount"
                  type="number"
                  placeholder="Net amount receivable/payable this time"
                  value={formData.balanceAmount || ""}
                  onChange={(e) => handleInputChange("balanceAmount", e.target.value)}
                  data-testid="input-balance-amount"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-6 md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  data-testid="button-cancel-tada"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} data-testid="button-submit-tada">
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
  );
}
