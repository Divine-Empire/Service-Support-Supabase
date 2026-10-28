import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Modal } from "../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";
import { formatDate, formatDelayLabel, delayTone } from "../lib/format";

const linkCell = (url) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
      View
    </a>
  ) : null;

// Pending: Action + invoice attachments. History: invoice number/copy + calibration details.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onCalibrate }) => (
    <Button size="sm" variant="outline" onClick={() => onCalibrate(r)} data-testid={`button-calibration-${r.ticketId}`}>
      Calibration
    </Button>
  ) },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "quotationNo", label: "Quotation Number", defaultVisible: true, strong: true, text: (r) => r.quotationNo },
  { key: "quotationCopy", label: "Quotation Copy", defaultVisible: true, cell: (r) => linkCell(r.quotationPdfLink) },
  { key: "attachmentService", label: "Attachment (Service)", defaultVisible: false, tabs: ["pending"], cell: (r) => linkCell(r.attachmentService) },
  { key: "attachmentNabl", label: "Attachment (NABL)", defaultVisible: false, tabs: ["pending"], cell: (r) => linkCell(r.attachmentNabl) },
  { key: "invoiceNo", label: "Invoice Number", defaultVisible: true, strong: true, tabs: ["history"], text: (r) => r.invoiceNo },
  { key: "invoiceCopy", label: "Invoice Copy", defaultVisible: true, tabs: ["history"], cell: (r) => linkCell(r.invoiceCopy) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "invoiceDate", label: "Invoice Date", defaultVisible: true, text: (r) => formatDate(r.invoiceDate) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, text: (r) => r.enquiryType },
  { key: "serviceLocation", label: "Service Location", defaultVisible: true, cell: (r) =>
    r.serviceLocation ? <StatusBadge tone="info">{r.serviceLocation}</StatusBadge> : null },
  { key: "calibrationDate", label: "Calibration Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.calibrationDate) },
  { key: "calibrationPeriodMonth", label: "Calibration Period (Month)", defaultVisible: false, tabs: ["history"], text: (r) => r.calibrationPeriodMonth },
  { key: "calibrationDueDate", label: "Calibration Due Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.calibrationDueDate) },
  { key: "upload", label: "Upload", defaultVisible: false, tabs: ["history"], cell: (r) => linkCell(r.calibrationUploadFile) },
  { key: "softCopyName", label: "Soft Copy Shared - Person Name", defaultVisible: false, tabs: ["history"], text: (r) => r.softCopySharedPersonName },
  { key: "softCopyNumber", label: "Soft Copy Shared - Person Number", defaultVisible: false, tabs: ["history"], text: (r) => r.softCopySharedPersonNumber },
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes)}>{formatDelayLabel(r.delayMinutes)}</StatusBadge>
  ) },
];

export default function Calibration() {
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // File is only HELD here on selection — actual upload happens at submit
  // time in handleSubmit, so cancelling the form never leaves an orphaned
  // upload behind, and nothing hits Storage until Submit is clicked.
  const [calibrationUploadFile, setCalibrationUploadFile] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Calibration (invoice.calibration_planned set —
      // true for tickets with enquiry_type = 'NABL' or 'NON-NABL').
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("sss_invoice")
        .select("ticket_id, calibration_planned")
        .not("calibration_planned", "is", null);

      if (invoiceError) throw invoiceError;

      const ticketIds = [...new Set((invoiceRows || []).map((i) => i.ticket_id))];

      if (ticketIds.length === 0) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      const { data: calibrationRows, error: calibrationError } = await supabase
        .from("sss_calibration")
        .select("*")
        .in("ticket_id", ticketIds);

      if (calibrationError) throw calibrationError;

      const { data: quotationRows } = await supabase
        .from("sss_quotation")
        .select("ticket_id, quotation_no, quotation_pdf_link")
        .in("ticket_id", ticketIds);

      const { data: invoiceFullRows } = await supabase
        .from("sss_invoice")
        .select("ticket_id, invoice_date, invoice_no_nabl, invoice_no_service, invoice_no_spare, attachment_nabl, attachment_service, attachment_spare")
        .in("ticket_id", ticketIds);

      const calibrationByTicket = new Map((calibrationRows || []).map((c) => [c.ticket_id, c]));
      const quotationByTicket = new Map((quotationRows || []).map((q) => [q.ticket_id, q]));
      const invoiceByTicket = new Map((invoiceFullRows || []).map((i) => [i.ticket_id, i]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const q = quotationByTicket.get(t.ticket_id);
        const inv = invoiceByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          CREName: t.cre_name || "",
          enquiryType: t.enquiry_type || "",
          serviceLocation: t.service_location || "",
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          invoiceDate: inv?.invoice_date || "",
          invoiceNo: inv?.invoice_no_nabl || inv?.invoice_no_service || inv?.invoice_no_spare || "",
          invoiceCopy: inv?.attachment_nabl || inv?.attachment_service || inv?.attachment_spare || "",
          // Shown as separate columns on the Pending tab (NABL/Service only —
          // Calibration is gated by enquiry_type='NABL', so Spare never
          // applies here, unlike the combined fallback chain above).
          invoiceNoService: inv?.invoice_no_service || "",
          invoiceNoNabl: inv?.invoice_no_nabl || "",
          attachmentService: inv?.attachment_service || "",
          attachmentNabl: inv?.attachment_nabl || "",
        };

        const cal = calibrationByTicket.get(t.ticket_id);
        if (cal) {
          history.push({
            ...base,
            calibrationDate: cal.calibration_date || "",
            calibrationPeriodMonth: cal.calibration_period_month ?? "",
            calibrationDueDate: cal.calibration_due_date || "",
            calibrationUploadFile: cal.calibration_upload_file || "",
            softCopySharedPersonName: cal.soft_copy_shared_person_name || "",
            softCopySharedPersonNumber: cal.soft_copy_shared_person_number || "",
            delayMinutes: cal.delay_minutes,
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

  const list = useClientList({
    key: "calibration",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "quotationNo", "invoiceNo"],
    filters: [
      { key: "enquiryType", label: "Enquiry Type", allLabel: "All Enquiry Types", get: (r) => r.enquiryType },
      { key: "serviceLocation", label: "Service Location", allLabel: "All Locations", get: (r) => r.serviceLocation },
    ],
    columns: COLUMNS,
  });

  const handleCalibrationClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      calibrationDate: "",
      calibrationPeriodMonth: "",
      softCopySharedPersonName: "",
      softCopySharedPersonNumber: "",
    });
    setCalibrationUploadFile(null);
    setShowCalibrationModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calibration Due Date is derived (calibration date + period in months) —
  // purely informational (when this calibration itself expires), not a
  // stage-gating column.
  const calibrationDueDate = (() => {
    if (!formData.calibrationDate || !formData.calibrationPeriodMonth) return "";
    const months = parseInt(formData.calibrationPeriodMonth, 10);
    if (isNaN(months) || months <= 0) return "";
    const d = new Date(formData.calibrationDate);
    if (isNaN(d.getTime())) return "";
    const due = new Date(d);
    due.setMonth(due.getMonth() + months);
    if (due.getDate() !== d.getDate()) due.setDate(0);
    return due.toISOString().split("T")[0];
  })();

  const uploadToStorage = async (file) => {
    const path = `calibration/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCalibrationUploadFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.calibrationDate) {
      toast({ title: "Validation Error", description: "Please select Calibration Date", variant: "destructive" });
      return;
    }
    if (!formData.calibrationPeriodMonth) {
      toast({ title: "Validation Error", description: "Please enter Calibration Period (Month)", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked — nothing was
      // uploaded on file selection.
      const calibrationUploadUrl = calibrationUploadFile
        ? await uploadToStorage(calibrationUploadFile)
        : null;

      const submittedAt = new Date();
      const calibrationCertificatePlanned = await computeStagePlanned("calibrationCertificate", {
        calibrationSubmittedAt: submittedAt,
      });

      const { error } = await supabase.from("sss_calibration").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        calibration_date: formData.calibrationDate || null,
        calibration_period_month: formData.calibrationPeriodMonth || null,
        calibration_due_date: calibrationDueDate || null,
        calibration_upload_file: calibrationUploadUrl,
        soft_copy_shared_person_name: formData.softCopySharedPersonName || null,
        soft_copy_shared_person_number: formData.softCopySharedPersonNumber || null,
        // Readiness stamp for the next stage (Calibration Certificate) —
        // every Calibration submission gets this. See stagePlanning.js.
        calibration_certificate_planned: calibrationCertificatePlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Calibration details saved successfully",
      });

      setShowCalibrationModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting calibration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save calibration details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{ onCalibrate: handleCalibrationClick }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending calibrations found.", history: "No calibration history found." }}
        ariaLabel="Calibration tickets"
      />

      {/* Calibration Modal */}
      <Modal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        title="Calibration"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cal-ticketId">Ticket ID</Label>
            <Input id="cal-ticketId" value={formData.ticketId || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cal-clientName">Client Name</Label>
            <Input id="cal-clientName" value={formData.clientName || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cal-phone">Phone Number</Label>
            <Input id="cal-phone" value={formData.phoneNumber || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cal-company">Company Name</Label>
            <Input id="cal-company" value={formData.companyName || ""} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label htmlFor="cal-date">Calibration Date *</Label>
            <Input
              id="cal-date"
              type="date"
              value={formData.calibrationDate || ""}
              onChange={(e) => handleInputChange("calibrationDate", e.target.value)}
              data-testid="input-calibration-date"
            />
          </div>
          <div>
            <Label htmlFor="cal-period">Calibration Period (Month) *</Label>
            <Input
              id="cal-period"
              type="number"
              min="1"
              placeholder="Enter number of months"
              value={formData.calibrationPeriodMonth || ""}
              onChange={(e) => handleInputChange("calibrationPeriodMonth", e.target.value)}
              data-testid="input-calibration-period"
            />
          </div>
          <div>
            <Label htmlFor="cal-due">Calibration Due Date</Label>
            <Input id="cal-due" value={calibrationDueDate ? formatDate(calibrationDueDate) : ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cal-upload">Calibration Upload</Label>
            <Input
              id="cal-upload"
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              data-testid="input-calibration-upload"
            />
            {calibrationUploadFile && (
              <p className="text-xs text-muted-foreground mt-1 truncate">Selected: {calibrationUploadFile.name}</p>
            )}
          </div>

          <div className="md:col-span-2 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Soft Copy Shared</h3>
          </div>
          <div>
            <Label htmlFor="cal-softName">Person Name</Label>
            <Input
              id="cal-softName"
              placeholder="Enter person name"
              value={formData.softCopySharedPersonName || ""}
              onChange={(e) => handleInputChange("softCopySharedPersonName", e.target.value)}
              data-testid="input-soft-copy-person-name"
            />
          </div>
          <div>
            <Label htmlFor="cal-softNumber">Person Number</Label>
            <Input
              id="cal-softNumber"
              type="tel"
              placeholder="Enter phone number"
              value={formData.softCopySharedPersonNumber || ""}
              onChange={(e) => handleInputChange("softCopySharedPersonNumber", e.target.value)}
              data-testid="input-soft-copy-person-number"
            />
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-calibration"
              className="px-6"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <Loader2Icon className="animate-spin mr-2 w-4 h-4" />
                  Uploading & Submitting...
                </span>
              ) : (
                "Submit"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCalibrationModal(false)}
              data-testid="button-cancel-calibration"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
