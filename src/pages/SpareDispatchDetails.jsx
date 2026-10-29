import { useState, useEffect } from "react";
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
import { useToast } from "../hooks/use-toast";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import { Loader2Icon } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { formatDate, formatDelayLabel, delayTone } from "../lib/format";

const linkCell = (url) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
      View
    </a>
  ) : null;

const PENDING_TABS = ["pending-spare", "pending-warehouse"];

// Pending (Spare / Warehouse): ticket + spare invoice. History: adds the dispatch details.
const COLUMNS = [
  { key: "action", label: "Action", fixed: true, tabs: PENDING_TABS, cell: (r, { onProcess }) => (
    <Button size="sm" variant="outline" onClick={() => onProcess(r)} data-testid={`button-dispatch-${r.ticketId}`}>Process</Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 220, text: (r) => r.companyName },
  { key: "clientName", label: "Person Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "mentionIssue", label: "Issue", defaultVisible: true, wrap: true, width: 240, text: (r) => r.mentionIssue },
  { key: "invoiceNoSpare", label: "Spare Invoice No.", defaultVisible: true, strong: true, text: (r) => r.invoiceNoSpare },
  { key: "attachmentSpare", label: "Spare Invoice Copy", defaultVisible: true, cell: (r) => linkCell(r.attachmentSpare) },
  { key: "transporterName", label: "Transporter Name", defaultVisible: true, tabs: ["history"], text: (r) => r.transporterName },
  { key: "docketBiltyNo", label: "Docket/Bilty No.", defaultVisible: true, tabs: ["history"], text: (r) => r.docketBiltyNo },
  { key: "dispatchDate", label: "Dispatch Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.dispatchDate) },
  { key: "courierTransportDetails", label: "Courier/Transport Details", defaultVisible: true, tabs: ["history"], wrap: true, width: 220, text: (r) => r.courierTransportDetails },
  { key: "biltyCopy", label: "Bilty Copy", defaultVisible: true, tabs: ["history"], cell: (r) => linkCell(r.biltyCopyAttachment) },
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes)}>{formatDelayLabel(r.delayMinutes)}</StatusBadge>
  ) },
];

export default function SpareDispatchDetails() {
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [masterData, setMasterData] = useState({});
  const { toast } = useToast();

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // File is only HELD here on selection — actual upload happens at submit
  // time in handleSubmit, so cancelling the form never leaves an orphaned
  // upload behind, and nothing hits Storage until Submit is clicked.
  const [biltyCopyFile, setBiltyCopyFile] = useState(null);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Tickets ready for Spare Dispatch Details (invoice.spare_dispatch_planned
      // set — only true when tickets.enquiry_type = 'SPARE').
      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("sss_invoice")
        .select("ticket_id, spare_dispatch_planned")
        .not("spare_dispatch_planned", "is", null);

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

      const { data: invoiceFullRows } = await supabase
        .from("sss_invoice")
        .select("ticket_id, invoice_no_spare, attachment_spare, invoice_no_service, attachment_service, invoice_no_nabl, attachment_nabl")
        .in("ticket_id", ticketIds);

      const { data: dispatchRows, error: dispatchError } = await supabase
        .from("sss_spare_dispatch_details")
        .select("*")
        .in("ticket_id", ticketIds);

      if (dispatchError) throw dispatchError;

      const invoiceByTicket = new Map((invoiceFullRows || []).map((i) => [i.ticket_id, i]));
      const dispatchByTicket = new Map((dispatchRows || []).map((d) => [d.ticket_id, d]));

      const pending = [];
      const history = [];

      (ticketsData || []).forEach((t) => {
        const inv = invoiceByTicket.get(t.ticket_id);

        const base = {
          ticketId: t.ticket_id,
          ticketUuid: t.uuid,
          timeStemp: t.created_at || "",
          clientName: t.client_name || "",
          phoneNumber: t.phone_number || "",
          companyName: t.company_name || "",
          mentionIssue: t.mention_issue || "",
          CREName: t.cre_name || "",
          invoiceNoSpare: inv?.invoice_no_spare || inv?.invoice_no_service || inv?.invoice_no_nabl || "",
          // Which condition put this ticket in Spare Dispatch: Pending (Spare) =
          // enquiry_type 'SPARE', Pending (Warehouse) = service_location 'Warehouse'.
          isSpare: t.enquiry_type === "SPARE",
          isWarehouse: String(t.service_location || "").trim().toLowerCase() === "warehouse",
          attachmentSpare: inv?.attachment_spare || inv?.attachment_service || inv?.attachment_nabl || "",
        };

        const d = dispatchByTicket.get(t.ticket_id);
        if (d) {
          history.push({
            ...base,
            transporterName: d.transporter_name || "",
            docketBiltyNo: d.docket_bilty_no || "",
            dispatchDate: d.dispatch_date || "",
            courierTransportDetails: d.courier_transport_details || "",
            biltyCopyAttachment: d.bilty_copy_attachment || "",
            delayMinutes: d.delay_minutes,
          });
        } else {
          pending.push(base);
        }
      });

      setPendingData(pending);
      setHistoryData(history);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchMasterSheet = async () => {
    try {
      const data = await fetchDropdownRows(["courier_transport_details"]);
      setMasterData([{ "Courier/Transport Details": (data || []).map((d) => d.value) }]);
    } catch (error) {
      console.error("Error fetching master data:", error);
    }
  };

  useEffect(() => {
    fetchMasterSheet();
    fetchData();
  }, []);

  const handleClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      transporterName: "",
      docketBiltyNo: "",
      dispatchDate: "",
      courierTransportDetails: "",
    });
    setBiltyCopyFile(null);
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadToStorage = async (file) => {
    const path = `spare_dispatch/${selectedTicket?.ticketId}_${Date.now()}_${file.name}`;

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
    setBiltyCopyFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.transporterName) {
      alert("Please enter Transporter Name");
      return;
    }
    if (!formData.docketBiltyNo) {
      alert("Please enter Docket/Bilty No.");
      return;
    }
    if (!formData.dispatchDate) {
      alert("Please select Dispatch Date");
      return;
    }
    if (!biltyCopyFile) {
      alert("Please select a Bilty Copy file");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload only now that Submit was actually clicked — nothing was
      // uploaded on file selection.
      const biltyCopyUrl = biltyCopyFile ? await uploadToStorage(biltyCopyFile) : null;

      const { error } = await supabase.from("sss_spare_dispatch_details").insert({
        ticket_id: selectedTicket.ticketId,
        ticket_uuid: selectedTicket.ticketUuid,
        transporter_name: formData.transporterName || null,
        docket_bilty_no: formData.docketBiltyNo || null,
        dispatch_date: formData.dispatchDate || null,
        courier_transport_details: formData.courierTransportDetails || null,
        bilty_copy_attachment: biltyCopyUrl,
        // No <next_stage>_planned column — nothing comes after this stage yet.
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Spare dispatch details saved successfully",
      });

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting spare dispatch details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save spare dispatch details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // A ticket meeting both conditions shows in both tabs; one with neither
  // (enquiry type edited after the invoice) stays reachable under Spare.
  const list = useClientList({
    key: "spare-dispatch",
    data: {
      "pending-spare": pendingData.filter((t) => t.isSpare || !t.isWarehouse),
      "pending-warehouse": pendingData.filter((t) => t.isWarehouse),
      history: historyData,
    },
    tabLabels: { "pending-spare": "Pending (Spare)", "pending-warehouse": "Pending (Warehouse)", history: "History" },
    loading: fetchLoading,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber", "mentionIssue", "invoiceNoSpare"],
    columns: COLUMNS,
  });

  return (
    <div className="space-y-3">
      <ListToolbar list={list} searchPlaceholder="Search by ticket ID, client, company or phone..." />
      <ListTable
        list={list}
        ctx={{ onProcess: handleClick }}
        rowKey={(r, tab) => tab + "-" + r.ticketId}
        cardTitle={(r) => r.ticketId}
        emptyTitle={{
          "pending-spare": "No pending spare dispatches found.",
          "pending-warehouse": "No pending warehouse dispatches found.",
          history: "No dispatch history found.",
        }}
        ariaLabel="Spare dispatch tickets"
      />

      {/* Spare Dispatch Details Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Spare Dispatch Details"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Ticket ID</Label>
            <Input value={formData.ticketId || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label>Client Name</Label>
            <Input value={formData.clientName || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input value={formData.phoneNumber || ""} disabled className="bg-slate-50" />
          </div>
          <div>
            <Label>Company Name</Label>
            <Input value={formData.companyName || ""} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label>Transporter Name *</Label>
            <Input
              placeholder="Enter transporter name"
              value={formData.transporterName || ""}
              onChange={(e) => handleInputChange("transporterName", e.target.value)}
              data-testid="input-transporter-name"
            />
          </div>
          <div>
            <Label>Docket/Bilty No. *</Label>
            <Input
              placeholder="Enter docket/bilty no."
              value={formData.docketBiltyNo || ""}
              onChange={(e) => handleInputChange("docketBiltyNo", e.target.value)}
              data-testid="input-docket-bilty-no"
            />
          </div>
          <div>
            <Label>Dispatch Date *</Label>
            <Input
              type="date"
              value={formData.dispatchDate || ""}
              onChange={(e) => handleInputChange("dispatchDate", e.target.value)}
              data-testid="input-dispatch-date"
            />
          </div>
          <div>
            <Label>Courier/Transport Details</Label>
            <Select
              value={formData.courierTransportDetails || undefined}
              onValueChange={(value) => handleInputChange("courierTransportDetails", value)}
            >
              <SelectTrigger data-testid="select-courier-transport-details">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                {masterData.length > 0 && masterData[0]["Courier/Transport Details"] ? (
                  masterData[0]["Courier/Transport Details"].map(
                    (item, ind) =>
                      item && (
                        <SelectItem
                          key={ind}
                          value={item}
                          className="hover:bg-blue-50 focus:bg-blue-50"
                        >
                          {item}
                        </SelectItem>
                      )
                  )
                ) : (
                  <SelectItem value="loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Bilty Copy Upload *</Label>
            <Input
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              data-testid="input-bilty-copy"
              required
            />
            {biltyCopyFile && (
              <p className="text-xs text-emerald-700 mt-1 truncate">Selected: {biltyCopyFile.name}</p>
            )}
          </div>

          <div className="md:col-span-2 flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-dispatch"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
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
              data-testid="button-cancel-dispatch"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
