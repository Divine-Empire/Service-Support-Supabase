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
import { formatDate, formatDelayLabel, delayTone } from "../lib/format";

const linkCell = (url) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
      View
    </a>
  ) : null;

// Pending: Action + ticket/quotation/invoice. History adds the certificate dispatch details + delay.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onProcess }) => (
    <Button size="sm" variant="outline" onClick={() => onProcess(r)} data-testid={`button-certificate-${r.ticketId}`}>
      Process
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, text: (r) => r.enquiryType },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Person Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: false, text: (r) => r.phoneNumber },
  { key: "quotationNo", label: "Quotation Number", defaultVisible: true, strong: true, text: (r) => r.quotationNo },
  { key: "quotationCopy", label: "Quotation Copy", defaultVisible: false, cell: (r) => linkCell(r.quotationPdfLink) },
  { key: "invoiceNo", label: "Invoice Number", defaultVisible: true, strong: true, text: (r) => r.invoiceNo },
  { key: "invoiceCopy", label: "Invoice Copy", defaultVisible: false, cell: (r) => linkCell(r.invoiceCopy) },
  { key: "certificateTypeName", label: "Certificate Type/Name", defaultVisible: true, tabs: ["history"], text: (r) => r.certificateTypeName },
  { key: "numberOfCertificates", label: "No. of Certificates", defaultVisible: false, tabs: ["history"], text: (r) => r.numberOfCertificatesDocuments },
  { key: "destinationAddress", label: "Destination Address", defaultVisible: false, tabs: ["history"], wrap: true, width: 200, text: (r) => r.fullDestinationAddress },
  { key: "dateOfDispatch", label: "Date of Dispatch", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.dateOfDispatch) },
  { key: "courierCompany", label: "Courier Company", defaultVisible: true, tabs: ["history"], text: (r) => r.courierCompanyName },
  { key: "trackingNo", label: "Tracking No.", defaultVisible: false, tabs: ["history"], text: (r) => r.courierTrackingNumber },
  { key: "expectedDelivery", label: "Expected Delivery", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.expectedDeliveryDate) },
  { key: "attachment", label: "Attachment", defaultVisible: false, tabs: ["history"], cell: (r) => linkCell(r.attachment) },
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes)}>{formatDelayLabel(r.delayMinutes)}</StatusBadge>
  ) },
];

export default function CalibrationCertificate() {
  const [showModal, setShowModal] = useState(false);
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
  const [attachmentFile, setAttachmentFile] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      // Tickets ready for Calibration Certificate
      // (calibration.calibration_certificate_planned set).
      const { data: calibrationRows, error: calibrationError } = await supabase
        .from("sss_calibration")
        .select("ticket_id, calibration_certificate_planned")
        .not("calibration_certificate_planned", "is", null);

      if (calibrationError) throw calibrationError;

      const ticketIds = [...new Set((calibrationRows || []).map((c) => c.ticket_id))];

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

      const { data: certificateRows, error: certificateError } = await supabase
        .from("sss_calibration_certificate")
        .select("*")
        .in("ticket_id", ticketIds);

      if (certificateError) throw certificateError;

      const { data: quotationRows } = await supabase
        .from("sss_quotation")
        .select("ticket_id, quotation_no, quotation_pdf_link")
        .in("ticket_id", ticketIds);

      const { data: invoiceFullRows } = await supabase
        .from("sss_invoice")
        .select("ticket_id, invoice_no_nabl, invoice_no_service, invoice_no_spare, attachment_nabl, attachment_service, attachment_spare")
        .in("ticket_id", ticketIds);

      const certificateByTicket = new Map((certificateRows || []).map((c) => [c.ticket_id, c]));
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
          quotationNo: q?.quotation_no || "",
          quotationPdfLink: q?.quotation_pdf_link || "",
          invoiceNo: inv?.invoice_no_nabl || inv?.invoice_no_service || inv?.invoice_no_spare || "",
          invoiceCopy: inv?.attachment_nabl || inv?.attachment_service || inv?.attachment_spare || "",
        };

        const cert = certificateByTicket.get(t.ticket_id);
        if (cert) {
          history.push({
            ...base,
            certificateTypeName: cert.certificate_type_name || "",
            numberOfCertificatesDocuments: cert.number_of_certificates_documents ?? "",
            fullDestinationAddress: cert.full_destination_address || "",
            dateOfDispatch: cert.date_of_dispatch || "",
            courierCompanyName: cert.courier_company_name || "",
            courierTrackingNumber: cert.courier_tracking_number || "",
            expectedDeliveryDate: cert.expected_delivery_date || "",
            attachment: cert.attachment || "",
            delayMinutes: cert.delay_minutes,
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
    key: "calibrationCertificate",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "quotationNo", "invoiceNo"],
    filters: [
      { key: "enquiryType", label: "Enquiry Type", allLabel: "All Enquiry Types", get: (r) => r.enquiryType },
      { key: "courier", label: "Courier", allLabel: "All Couriers", get: (r) => r.courierCompanyName, tabs: ["history"] },
    ],
    columns: COLUMNS,
  });

  const handleClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      certificateTypeName: "",
      numberOfCertificatesDocuments: "",
      fullDestinationAddress: "",
      dateOfDispatch: "",
      courierCompanyName: "",
      courierTrackingNumber: "",
      expectedDeliveryDate: "",
    });
    setAttachmentFile(null);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file) => {
    const path = `calibration_certificate/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

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
    setAttachmentFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.certificateTypeName) {
      toast({ title: "Validation Error", description: "Please enter Certificate Type/Name", variant: "destructive" });
      return;
    }
    if (!formData.numberOfCertificatesDocuments) {
      toast({ title: "Validation Error", description: "Please enter Number of Certificates/Documents", variant: "destructive" });
      return;
    }
    if (!formData.dateOfDispatch) {
      toast({ title: "Validation Error", description: "Please select Date of Dispatch", variant: "destructive" });
      return;
    }
    if (!formData.courierCompanyName) {
      toast({ title: "Validation Error", description: "Please enter Courier Company Name", variant: "destructive" });
      return;
    }
    if (!formData.courierTrackingNumber) {
      toast({ title: "Validation Error", description: "Please enter Courier Tracking Number", variant: "destructive" });
      return;
    }
    if (!formData.fullDestinationAddress) {
      toast({ title: "Validation Error", description: "Please enter Full Destination Address", variant: "destructive" });
      return;
    }
    if (!formData.expectedDeliveryDate) {
      toast({ title: "Validation Error", description: "Please select Expected Delivery Date", variant: "destructive" });
      return;
    }
    if (!attachmentFile) {
      toast({ title: "Validation Error", description: "Please select an Attachment file", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked — nothing was
      // uploaded on file selection.
      const attachmentUrl = attachmentFile ? await uploadToStorage(attachmentFile) : null;

      const { error } = await supabase.from("sss_calibration_certificate").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        certificate_type_name: formData.certificateTypeName || null,
        number_of_certificates_documents: formData.numberOfCertificatesDocuments || null,
        full_destination_address: formData.fullDestinationAddress || null,
        date_of_dispatch: formData.dateOfDispatch || null,
        courier_company_name: formData.courierCompanyName || null,
        courier_tracking_number: formData.courierTrackingNumber || null,
        expected_delivery_date: formData.expectedDeliveryDate || null,
        attachment: attachmentUrl,
        // No <next_stage>_planned column — nothing comes after this stage yet.
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Calibration certificate details saved successfully",
      });

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting calibration certificate:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save calibration certificate details",
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
        ctx={{ onProcess: handleClick }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending calibration certificates found.", history: "No calibration certificate history found." }}
        ariaLabel="Calibration certificates"
      />

      {/* Calibration Certificate Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Calibration Certificate"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cc-ticketId">Ticket ID</Label>
            <Input id="cc-ticketId" value={formData.ticketId || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cc-clientName">Client Name</Label>
            <Input id="cc-clientName" value={formData.clientName || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cc-phone">Phone Number</Label>
            <Input id="cc-phone" value={formData.phoneNumber || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label htmlFor="cc-company">Company Name</Label>
            <Input id="cc-company" value={formData.companyName || ""} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label htmlFor="cc-type">Certificate Type/Name *</Label>
            <Input
              id="cc-type"
              placeholder="Enter certificate type"
              value={formData.certificateTypeName || ""}
              onChange={(e) => handleInputChange("certificateTypeName", e.target.value)}
              data-testid="input-certificate-type"
              required
            />
          </div>
          <div>
            <Label htmlFor="cc-count">Number of Certificates/Documents *</Label>
            <Input
              id="cc-count"
              type="number"
              min="0"
              placeholder="Enter number"
              value={formData.numberOfCertificatesDocuments || ""}
              onChange={(e) => handleInputChange("numberOfCertificatesDocuments", e.target.value)}
              data-testid="input-certificate-count"
              required
            />
          </div>
          <div>
            <Label htmlFor="cc-dispatch">Date of Dispatch *</Label>
            <Input
              id="cc-dispatch"
              type="date"
              value={formData.dateOfDispatch || ""}
              onChange={(e) => handleInputChange("dateOfDispatch", e.target.value)}
              data-testid="input-dispatch-date"
              required
            />
          </div>
          <div>
            <Label htmlFor="cc-courier">Courier Company Name *</Label>
            <Input
              id="cc-courier"
              placeholder="Enter courier company"
              value={formData.courierCompanyName || ""}
              onChange={(e) => handleInputChange("courierCompanyName", e.target.value)}
              data-testid="input-courier-company"
              required
            />
          </div>
          <div>
            <Label htmlFor="cc-tracking">Courier Tracking Number *</Label>
            <Input
              id="cc-tracking"
              placeholder="Enter tracking number"
              value={formData.courierTrackingNumber || ""}
              onChange={(e) => handleInputChange("courierTrackingNumber", e.target.value)}
              data-testid="input-tracking-number"
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="cc-address">Full Destination Address *</Label>
            <Input
              id="cc-address"
              placeholder="Enter full address"
              value={formData.fullDestinationAddress || ""}
              onChange={(e) => handleInputChange("fullDestinationAddress", e.target.value)}
              data-testid="input-destination-address"
              required
            />
          </div>
          <div>
            <Label htmlFor="cc-delivery">Expected Delivery Date *</Label>
            <Input
              id="cc-delivery"
              type="date"
              value={formData.expectedDeliveryDate || ""}
              onChange={(e) => handleInputChange("expectedDeliveryDate", e.target.value)}
              data-testid="input-delivery-date"
              required
            />
          </div>
          <div>
            <Label htmlFor="cc-attachment">Attachment *</Label>
            <Input
              id="cc-attachment"
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              data-testid="input-attachment"
              required
            />
            {attachmentFile && (
              <p className="text-xs text-muted-foreground mt-1 truncate">Selected: {attachmentFile.name}</p>
            )}
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-certificate"
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
              onClick={() => setShowModal(false)}
              data-testid="button-cancel-certificate"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
