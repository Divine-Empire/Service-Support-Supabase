import { useState, useEffect } from "react";
import { Eye, Loader2Icon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Modal } from "../components/ui/modal";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import { useToast } from "../hooks/use-toast";
import { supabase } from "../lib/supabase/client";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";
import { formatDate, delayTone } from "../lib/format";

const billLink = (r) =>
  r.billAttachment ? (
    <a
      href={r.billAttachment}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      <Eye className="h-4 w-4" aria-hidden="true" />
      View Bill
    </a>
  ) : (
    "N/A"
  );

// Pending: Action + ticket/enquiry columns. History: same plus the warranty outcome.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onProcess }) => (
    <Button onClick={() => onProcess(r)} size="sm" variant="outline" className="font-medium">Process</Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 200, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: false, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: true, wrap: true, width: 160, text: (r) => r.machineName },
  { key: "category", label: "Category", defaultVisible: true, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: false, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "serviceLocation", label: "Service Location", defaultVisible: true, text: (r) => r.serviceLocation },
  { key: "warrantyCheck", label: "Warranty Check", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={r.warrantyCheck === "yes" ? "success" : "danger"}>{r.warrantyCheck === "yes" ? "Yes" : "No"}</StatusBadge>
  ) },
  { key: "billNumber", label: "Bill Number", defaultVisible: true, tabs: ["history"], text: (r) => r.billNumber || "N/A" },
  { key: "billAttachment", label: "Bill Copy", defaultVisible: true, tabs: ["history"], cell: billLink },
  { key: "delay", label: "Delay (min)", defaultVisible: true, tabs: ["history"], cell: (r) =>
    r.delayMinutes === null || r.delayMinutes === undefined ? "N/A" : (
      <StatusBadge tone={delayTone(r.delayMinutes)}>{r.delayMinutes}</StatusBadge>
    ) },
];

const EMPTY_FORM = { warrantyCheck: "", billNumber: "", billAttachment: null };

export default function WarrantyCheck() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("sss_tickets")
        .select("*")
        .not("warranty_check_planned", "is", null)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;

      const { data: warrantyData, error: warrantyError } = await supabase
        .from("sss_warranty_check")
        .select("*");

      if (warrantyError) throw warrantyError;

      const warrantyByTicket = new Map(
        (warrantyData || []).map((w) => [w.ticket_id, w])
      );

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
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
          engineerAssign: t.engineer_assign || "",
          videoCall: t.video_call || "",
        };

        const w = warrantyByTicket.get(t.ticket_id);
        if (w) {
          history.push({
            ...base,
            actual3: w.created_at || "",
            warrantyCheck: w.warranty_check || "",
            billNumber: w.bill_number || "",
            billAttachment: w.bill_attachment || "",
            delayMinutes: w.delay_minutes,
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

  const handleProcessClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadBillAttachment = async (file) => {
    const path = `warranty/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!formData.warrantyCheck) {
      toast({
        title: "Validation Error",
        description: "Please select Warranty Check option.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.warrantyCheck === "yes") {
      if (!formData.billNumber) {
        toast({
          title: "Validation Error",
          description: "Please enter the Bill Number.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      if (!formData.billAttachment) {
        toast({
          title: "Validation Error",
          description: "Please attach the Bill file.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    try {
      let billAttachmentUrl = "";
      if (formData.warrantyCheck === "yes" && formData.billAttachment) {
        billAttachmentUrl = await uploadBillAttachment(formData.billAttachment);
      }

      const submittedAt = new Date();

      // Warranty-Check branches into exactly one of three outcomes — see
      // stagePlanning.js: service_location='Warehouse' wins first, then
      // video_call='Yes', then a direct-to-Quotation fallback. Only one of
      // these three ever comes back non-null.
      const planningCtx = { ticket: selectedTicket, warrantyCheckSubmittedAt: submittedAt };
      const warehousePlanned = await computeStagePlanned("warehouse", planningCtx);
      const videoCallPlanned = await computeStagePlanned("videoCall", planningCtx);
      const quotationPlanned = await computeStagePlanned("quotationDirect", planningCtx);

      const { error } = await supabase.from("sss_warranty_check").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        warranty_check: formData.warrantyCheck,
        bill_number: formData.warrantyCheck === "yes" ? formData.billNumber : "",
        bill_attachment: formData.warrantyCheck === "yes" ? billAttachmentUrl : "",
        // Mutually exclusive — exactly one of these three is non-null. See
        // stagePlanning.js's warehouse/videoCall/quotationDirect rules.
        warehouse_planned: warehousePlanned,
        video_call_planned: videoCallPlanned,
        quotation_planned: quotationPlanned,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Warranty check submitted successfully",
      });
      setShowModal(false);
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

  const list = useClientList({
    key: "warranty-check",
    data: { pending: pendingData, history: historyData },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [
      { key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category },
      { key: "serviceLocation", label: "Service Location", allLabel: "All Locations", get: (r) => r.serviceLocation },
      { key: "clientType", label: "Client Type", allLabel: "All Client Types", get: (r) => r.clientType },
      { key: "warranty", label: "Warranty", allLabel: "All Warranty", get: (r) => (r.warrantyCheck === "yes" ? "Yes" : "No"), tabs: ["history"] },
    ],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{ onProcess: handleProcessClick }}
        rowKey={(r) => r.ticketId}
        emptyTitle={{ pending: "No pending warranty checks found.", history: "No history found." }}
        ariaLabel="Warranty checks"
      />

      {/* Warranty Check Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          if (!isSubmitting) setShowModal(false);
        }}
        title="Warranty Check"
        size="lg"
      >
        <div className="rounded-lg bg-card">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Pre-filled info for context */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="wc-ticketId" className="font-medium text-muted-foreground">Ticket ID</Label>
                  <Input id="wc-ticketId" value={selectedTicket?.ticketId || ""} disabled className="bg-secondary" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wc-clientName" className="font-medium text-muted-foreground">Client Name</Label>
                  <Input id="wc-clientName" value={selectedTicket?.clientName || ""} disabled className="bg-secondary" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wc-phoneNumber" className="font-medium text-muted-foreground">Phone Number</Label>
                  <Input id="wc-phoneNumber" value={selectedTicket?.phoneNumber || ""} disabled className="bg-secondary" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wc-machineName" className="font-medium text-muted-foreground">Machine Name</Label>
                  <Input id="wc-machineName" value={selectedTicket?.machineName || ""} disabled className="bg-secondary" />
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-1">
                  <Label htmlFor="wc-warrantyCheck" className="font-medium text-muted-foreground">Warranty Check *</Label>
                  <Select
                    value={formData.warrantyCheck}
                    onValueChange={(value) => handleInputChange("warrantyCheck", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="wc-warrantyCheck">
                      <SelectValue placeholder="Select Yes/No" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-slate-200 shadow-md">
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.warrantyCheck === "yes" && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="wc-billNumber" className="font-medium text-muted-foreground">Bill Number Input *</Label>
                      <Input
                        id="wc-billNumber"
                        placeholder="Enter bill number"
                        value={formData.billNumber}
                        onChange={(e) => handleInputChange("billNumber", e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="wc-billAttachment" className="font-medium text-muted-foreground">Bill Attachment *</Label>
                      <Input
                        id="wc-billAttachment"
                        type="file"
                        onChange={(e) => handleInputChange("billAttachment", e.target.files[0] || null)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Uploading & Submitting...
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
    </div>
  );
}
