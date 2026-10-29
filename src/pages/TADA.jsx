import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Modal } from "../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import useAuth from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import { Eye, Loader2Icon } from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import TimePicker12 from "../components/ui/time-picker-12";
import { supabase } from "../lib/supabase/client";
import { sendTadaApprovalEmail } from "../lib/notifications/email";
import { formatDate, formatDelay, delayTone } from "../lib/format";

// Strips a leading "Quotation"/"Quo" prefix so only the number shows.
const cleanQuotationNo = (no) =>
  no ? String(no).replace(/^(Quotation|Quo|QUO|Quo\.)[:\-\s.]*/i, "").trim() : "";

const quotationPdfCell = (r) =>
  r.quotationPdfLink ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-primary"
      onClick={() => window.open(r.quotationPdfLink, "_blank")}
      title="View Quotation PDF"
      aria-label={`View quotation PDF for ${r.ticketId}`}
    >
      <Eye className="h-4 w-4" />
    </Button>
  ) : null;

// Pending: Action + ticket/site-visit columns. History: what was booked + delay.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onTada, onReschedule, canReschedule }) => (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => onTada(r)} data-testid={`button-tada-${r.ticketId}`}>
        <Eye className="mr-1.5 h-4 w-4" />
        TADA
      </Button>
      {canReschedule && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReschedule(r)}
          data-testid={`button-reschedule-${r.ticketId}`}
          title="Send this ticket back to Site Visit Plan for re-assignment"
        >
          Reschedule
        </Button>
      )}
    </div>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: true, text: (r) => r.machineName },
  { key: "category", label: "Category", defaultVisible: false, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: false, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "serviceLocation", label: "Service Location", defaultVisible: false, text: (r) => r.serviceLocation },
  { key: "quotationNo", label: "Quotation No.", defaultVisible: false, text: (r) => cleanQuotationNo(r.quotationNo) },
  { key: "warrantyCheck", label: "Warranty Check", defaultVisible: true, tabs: ["pending"], text: (r) => r.warrantyCheck },
  { key: "engineerAssign", label: "Engineer Assign", defaultVisible: true, text: (r) => r.engineerAssign },
  { key: "siteName", label: "Site Name", defaultVisible: false, tabs: ["pending"], text: (r) => r.siteName },
  { key: "dateOfVisit", label: "Date of Visit", defaultVisible: true, tabs: ["pending"], text: (r) => formatDate(r.dateOfVisit) },
  { key: "transportation", label: "Transportation", defaultVisible: true, tabs: ["pending"], cell: (r) =>
    r.transportation ? <StatusBadge tone="info">{r.transportation}</StatusBadge> : null },
  { key: "travelDate", label: "Travel Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.travelDate) },
  { key: "returnDate", label: "Return Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.returnDate) },
  { key: "destinationInput", label: "Destination", defaultVisible: true, tabs: ["history"], text: (r) => r.destinationInput },
  { key: "purposeOfTravel", label: "Purpose", defaultVisible: false, tabs: ["history"], wrap: true, width: 200, text: (r) => r.purposeOfTravel },
  { key: "amount", label: "Amount", defaultVisible: true, tabs: ["history"], text: (r) => `₹${r.amount || "0"}` },
  { key: "otpVerificationPlanned", label: "OTP Verification Planned", defaultVisible: true, tabs: ["history"], text: (r) =>
    r.otpVerificationPlanned ? new Date(r.otpVerificationPlanned).toLocaleString("en-IN") : "" },
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes, { lateOnly: true })}>{formatDelay(r.delayMinutes, { lateOnly: true })}</StatusBadge>
  ) },
  { key: "quotationPdf", label: "Quotation PDF", defaultVisible: true, cell: quotationPdfCell },
];

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

export default function TADA() {
  const [showTADAModal, setShowTADAModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const { toast } = useToast();
  const { userName, role } = useAuth();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTicket, setRescheduleTicket] = useState(null);
  const [rescheduleRemarks, setRescheduleRemarks] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for TADA (site_visit.tada_planned set). Excludes
      // rescheduled rows — once an engineer reschedules, that row's
      // tada_planned no longer counts and the ticket drops out of this
      // pending list (see migration 0054).
      const { data: siteVisitRows, error: siteVisitError } = await supabase
        .from("sss_site_visit")
        .select("ticket_id, ticket_uuid, engineer_assign, date_of_visit, transportation, tada_planned")
        .not("tada_planned", "is", null)
        .is("rescheduled_at", null)
        .order("created_at", { ascending: false });

      if (siteVisitError) throw siteVisitError;

      const ticketIds = [...new Set((siteVisitRows || []).map((s) => s.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const siteVisitByTicket = new Map((siteVisitRows || []).map((s) => [s.ticket_id, s]));

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      // Warranty Check and Quotation are display-only here — joined from
      // their owning stages.
      const { data: warrantyRows, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("ticket_id, warranty_check")
        .in("ticket_id", ticketIds);

      if (warrantyError) throw warrantyError;

      const warrantyByTicket = new Map((warrantyRows || []).map((w) => [w.ticket_id, w.warranty_check]));

      const { data: quotationRows, error: quotationError } = await supabase
        .from("sss_quotation")
        .select("ticket_id, quotation_no, quotation_pdf_link")
        .in("ticket_id", ticketIds);

      if (quotationError) throw quotationError;

      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_id, q]));

      const { data: tadaRows, error: tadaError } = await supabase
        .from("sss_tada")
        .select("*")
        .in("ticket_id", ticketIds);

      if (tadaError) throw tadaError;

      const tadaByTicket = new Map((tadaRows || []).map((t) => [t.ticket_id, t]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const sv = siteVisitByTicket.get(t.ticket_id);
        const q = quotationByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          sourceOfEnquiry: t.source_of_enquiry || "",
          callType: t.call_type || "",
          enquiryReceiverName: t.enquiry_receiver_name || "",
          clientType: t.client_type || "",
          companyName: t.company_name || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          siteAddress: t.site_address || "",
          gstNo: t.gst_no || "",
          machineName: t.machine_name || "",
          category: t.category || "",
          mentionIssue: t.mention_issue || "",
          serviceLocation: t.service_location || "",
          CREName: t.cre_name || "",
          engineerAssign: sv?.engineer_assign || t.engineer_assign || "",
          siteName: t.site_address || "",
          warrantyCheck: warrantyByTicket.get(t.ticket_id) || "",
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          dateOfVisit: sv?.date_of_visit || "",
          transportation: sv?.transportation || "",
        };

        const tada = tadaByTicket.get(t.ticket_id);
        if (tada) {
          history.push({
            ...base,
            travelDate: tada.travel_date || "",
            returnDate: tada.return_date || "",
            destinationInput: tada.destination || "",
            purposeOfTravel: tada.purpose_of_travel || "",
            amount: tada.amount || "",
            expectedCompletionDate: tada.expected_completion_date || "",
            expectedCompletionTime: tada.expected_completion_time || "",
            otpVerificationPlanned: tada.otp_verification_planned || "",
            delayMinutes: tada.delay_minutes,
          });
        } else {
          pending.push(base);
        }
      });

      setPendingData(pending);
      setHistoryData(history);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoadError(error.message || "Failed to load data");
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open modal when arriving via a TADA deep-link (e.g. /tada?ticketId=XXX)
  useEffect(() => {
    if (pendingData.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const ticketIdFromUrl = params.get("ticketId");
    if (ticketIdFromUrl) {
      const targetTicket = pendingData.find(
        (t) => t.ticketId === decodeURIComponent(ticketIdFromUrl)
      );
      if (targetTicket) {
        handleTADAClick(targetTicket);
        // Clean the query param from the URL without reloading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, [pendingData]);


  const handleTADAClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
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
    });
    setShowTADAModal(true);
  };

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

      setShowTADAModal(false);
      fetchData();
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

  const handleRescheduleClick = (ticket) => {
    setRescheduleTicket(ticket);
    setRescheduleRemarks("");
    setShowRescheduleModal(true);
  };

  // Marks the ticket's current (active) sss_site_visit row as rescheduled —
  // an UPDATE, not a delete, so it stays as a log/audit entry. This both
  // drops the ticket out of TADA's own pending query (tada_planned no
  // longer counts once rescheduled_at is set) and makes it pending again in
  // SiteVisitPlan.jsx (its "already planned" check only counts the active
  // row) for the admin to re-assign a different engineer. See migration 0054.
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleTicket) return;

    setIsRescheduling(true);
    try {
      const { error: siteVisitError } = await supabase
        .from("sss_site_visit")
        .update({
          rescheduled_at: new Date().toISOString(),
          rescheduled_by: userName || null,
          reschedule_remarks: rescheduleRemarks || null,
        })
        .eq("ticket_id", rescheduleTicket.ticketId)
        .is("rescheduled_at", null);

      if (siteVisitError) throw siteVisitError;

      // Cosmetic — keeps tickets.current_stage in sync with where the
      // ticket actually is now (back at Site Visit Plan).
      await supabase
        .from("sss_tickets")
        .update({ current_stage: "Site Visit Plan" })
        .eq("uuid", rescheduleTicket.ticketUuid);

      toast({
        title: "Rescheduled",
        description: `${rescheduleTicket.ticketId} sent back to Site Visit Plan for re-assignment.`,
      });
      setShowRescheduleModal(false);
      setRescheduleTicket(null);
      fetchData();
    } catch (error) {
      console.error("Error rescheduling ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reschedule ticket",
        variant: "destructive",
      });
    } finally {
      setIsRescheduling(false);
    }
  };

  const list = useClientList({
    key: "tada",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r.engineerAssign },
      { key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category },
      { key: "transportation", label: "Transportation", allLabel: "All Transportation", get: (r) => r.transportation, tabs: ["pending"] },
    ],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} filtersInDialog searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{
          onTada: handleTADAClick,
          onReschedule: handleRescheduleClick,
          canReschedule: role === "admin" || role === "engineer",
        }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending TADA requests found.", history: "No TADA history found." }}
        ariaLabel="TADA tickets"
      />

      {/* TADA Modal */}
      <Modal
        isOpen={showTADAModal}
        onClose={() => setShowTADAModal(false)}
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
                  onClick={() => setShowTADAModal(false)}
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

      {/* Reschedule Confirmation Modal */}
      <Modal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title="Reschedule Site Visit"
        size="md"
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4 p-1">
          <p className="text-sm text-muted-foreground">
            Ticket <span className="font-semibold text-foreground">{rescheduleTicket?.ticketId}</span> will be sent
            back to <span className="font-semibold text-foreground">Site Visit Plan</span>'s Pending tab for
            re-assignment to a different engineer. The current assignment (
            <span className="font-semibold text-foreground">{rescheduleTicket?.engineerAssign || "N/A"}</span>) will
            be kept as a log and tagged "Rescheduled" there.
          </p>

          <div className="space-y-1">
            <Label htmlFor="tada-rescheduleRemarks" className="text-muted-foreground">Reason (optional)</Label>
            <Textarea
              id="tada-rescheduleRemarks"
              rows={3}
              value={rescheduleRemarks}
              onChange={(e) => setRescheduleRemarks(e.target.value)}
              placeholder="Why is this being rescheduled?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRescheduleModal(false)}
              disabled={isRescheduling}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isRescheduling}>
              {isRescheduling && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Reschedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
