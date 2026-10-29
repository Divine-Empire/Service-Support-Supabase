import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import TimePicker12 from "../components/ui/time-picker-12";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import {
  ClipboardList,
  Loader2Icon,
  Plus,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { supabase } from "../lib/supabase/client";
import { ltoSupabase } from "../lib/supabase/ltoClient";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { fetchEngineerNames } from "../lib/supabase/engineers";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";
import {
  sendServiceRequestRegisteredNotification,
  sendVideoCallScheduledNotifications,
} from "../lib/notifications/whatsapp";
import { ListToolbar, ListTable, StatusBadge } from "../components/shared";
import { useClientList } from "../hooks/useClientList";
import { formatDate, formatTime12hr } from "../lib/format";

const EMPTY_FORM = {
  clientType: "New",
  sourceOfEnquiry: "",
  callType: "",
  enquiryReceiverName: "",
  companyName: "",
  clientName: "",
  phoneNumber: "",
  siteAddress: "",
  gstNo: "",
  gstAddress: "",
  machineName: "",
  enquiryType: "",
  category: "",
  mentionIssue: "",
  serviceLocation: "",
  challanCopy: "",
  machinePhoto: "",
  videoCall: "",
  subCategory: "",
  videoCallTime: "",
  engineerAssign: "",
  enquiryItemList: "",
  remarks: "",
};

// Once a ticket reaches one of these stages, editing it here no longer
// makes sense (billing/downstream paperwork has already started on it) —
// it's dropped from this page's list entirely, not just its Edit button.
// "Cancelled" is set by the sss_cancelled_tickets trigger (migration 0054).
const EDIT_EXCLUDED_STAGES = ["Invoice", "Calibration", "Calibration Certificate", "Spare Dispatch Details", "Cancelled"];

const COLUMNS = [
  { key: "actions", label: "Actions", fixed: true, cell: (r, { onEdit }) => (
    <Button variant="outline" size="sm" onClick={() => onEdit(r)}>Edit</Button>
  ) },
  { key: "currentStage", label: "Current Stage", defaultVisible: true, cell: (r) => (
    r.currentStage ? <StatusBadge tone="info">{r.currentStage}</StatusBadge> : ""
  ) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 180, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: true, wrap: true, width: 200, text: (r) => r.machineName },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: false, text: (r) => r.enquiryType },
  { key: "category", label: "Category", defaultVisible: true, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: true, wrap: true, width: 250, text: (r) => r.mentionIssue },
  { key: "serviceLocation", label: "Service Location", defaultVisible: true, text: (r) => r.serviceLocation },
];

export default function TicketAndEnquiry() {
  const [pendingData, setPendingData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [masterData, setMasterData] = useState({});
  const [loadError, setLoadError] = useState(null);

  // Filter States
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  // New Enquiry Form States
  const [showNewEnquiryForm, setShowNewEnquiryForm] = useState(false);
  const [newEnquiryData, setNewEnquiryData] = useState(EMPTY_FORM);
  const [newFormSelectedMachines, setNewFormSelectedMachines] = useState([]);
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [machineSearchQuery, setMachineSearchQuery] = useState("");
  const [newFormSelectedCategories, setNewFormSelectedCategories] = useState([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  // Warehouse attachments are only uploaded on final form submit (not on
  // file selection) — picking a file just holds it here until then, so
  // cancelling the form never leaves an orphaned upload behind.
  const [warehouseFiles, setWarehouseFiles] = useState({
    challanCopy: null,
    machinePhoto: null,
  });
  // Same held-until-submit pattern as warehouseFiles above.
  const [enquiryItemListFile, setEnquiryItemListFile] = useState(null);

  const [companyDetails, setCompanyDetails] = useState([]);

  const { toast } = useToast();

  const handleEditClick = (ticket) => {
    setIsEditMode(true);
    setEditingTicket(ticket);
    setNewEnquiryData({
      clientType: ticket.clientType || "New",
      sourceOfEnquiry: ticket.sourceOfEnquiry || "",
      callType: ticket.callType || "",
      enquiryReceiverName: ticket.enquiryReceiverName || "",
      companyName: ticket.companyName || "",
      clientName: ticket.clientName || "",
      phoneNumber: ticket.phoneNumber || "",
      siteAddress: ticket.siteAddress || "",
      gstNo: ticket.gstNo || "",
      gstAddress: ticket.gstAddress || "",
      machineName: ticket.machineName || "",
      enquiryType: ticket.enquiryType || "",
      category: ticket.category || "",
      mentionIssue: ticket.mentionIssue || "",
      serviceLocation: ticket.serviceLocation || "",
      challanCopy: ticket.challanCopy || "",
      machinePhoto: ticket.machinePhoto || "",
      videoCall: ticket.videoCall || "",
      subCategory: ticket.subCategory || "",
      videoCallTime: ticket.videoCallTime || "",
      engineerAssign: ticket.engineerAssign || "",
      enquiryItemList: ticket.enquiryItemList || "",
      remarks: ticket.remarks || "",
    });

    const machines = ticket.machineName
      ? ticket.machineName.split(",").map((m) => m.trim()).filter(Boolean)
      : [];
    setNewFormSelectedMachines(machines);

    const categories = ticket.subCategory
      ? ticket.subCategory.split(",").map((c) => c.trim()).filter(Boolean)
      : [];
    setNewFormSelectedCategories(categories);
    setWarehouseFiles({ challanCopy: null, machinePhoto: null });
    setEnquiryItemListFile(null);

    setShowNewEnquiryForm(true);
  };

  // Just holds the picked file for later — actual upload happens at submit
  // time in handleNewEnquirySubmit, so cancelling the form uploads nothing.
  const handleWarehouseFileSelect = (field, file) => {
    setWarehouseFiles(prev => ({ ...prev, [field]: file }));
  };

  const removeWarehouseFile = (field) => {
    setWarehouseFiles(prev => ({ ...prev, [field]: null }));
    setNewEnquiryData(prev => ({ ...prev, [field]: "" }));
  };

  const uploadWarehouseFile = async (file, field) => {
    const path = `warehouse/${field}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  // Same held-until-submit pattern as the warehouse attachments above —
  // optional, applies to every ticket regardless of service location.
  const handleEnquiryItemListFileSelect = (file) => {
    setEnquiryItemListFile(file);
  };

  const removeEnquiryItemListFile = () => {
    setEnquiryItemListFile(null);
    setNewEnquiryData((prev) => ({ ...prev, enquiryItemList: "" }));
  };

  const uploadEnquiryItemListFile = async (file) => {
    const path = `enquiry_item_list/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const fetchData = async () => {
    setFetchLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("sss_tickets")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const allData = (data || []).map((row) => ({
        ticketId: row.ticket_id,
        timeStemp: row.created_at || "",
        sourceOfEnquiry: row.source_of_enquiry || "",
        callType: row.call_type || "",
        enquiryReceiverName: row.enquiry_receiver_name || "",
        clientType: row.client_type || "",
        companyName: row.company_name || "",
        clientName: row.client_name || "",
        phoneNumber: row.phone_number || "",
        siteAddress: row.site_address || "",
        gstNo: row.gst_no || "",
        gstAddress: row.gst_address || "",
        machineName: row.machine_name || "",
        enquiryType: row.enquiry_type || "",
        category: row.category || "",
        mentionIssue: row.mention_issue || "",
        serviceLocation: row.service_location || "",
        challanCopy: row.challan_copy || "",
        machinePhoto: row.machine_photo || "",
        videoCall: row.video_call || "",
        subCategory: row.sub_category || "",
        videoCallTime: row.video_call_time || "",
        engineerAssign: row.engineer_assign || "",
        otp: row.otp || "",
        CREName: row.cre_name || "",
        currentStage: row.current_stage || "",
        enquiryItemList: row.enquiry_item_list || "",
        remarks: row.remarks || "",
      }));

      // Show all tickets in the system
      setPendingData(allData);
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

  // Maps public.dropdown's `category` keys to the display keys the rest of
  // this component's JSX already expects (masterData[0]["Call type"], etc.)
  // Maps public.dropdown's `category` keys to the display keys the rest of
  // this component's JSX expects. Renamed in migration 0043 to match the
  // renamed tickets columns: dropdown category='category' now holds the
  // NABL/Service/Spare-style values (source for the "Category" field,
  // formerly "Enquiry-Type"), 'sub_category' holds the machine-group values
  // (source for "Sub-Category", formerly "Category"), and 'enquiry_type' is
  // a brand new, initially-empty category sourcing the brand new "Enquiry
  // Type" field.
  const DROPDOWN_CATEGORY_TO_KEY = {
    call_type: "Call type",
    source_of_enquiry: "Source of enquiry",
    enquiry_receiver_name: "Enquiry Receiver Name",
    category: "Category",
    sub_category: "Sub-Category",
    enquiry_type: "Enquiry Type",
    service_location: "Service Location",
    machine_name: "Machine Name",
  };

  const fetchDropdown = async () => {
    try {
      const [data, engineerNames] = await Promise.all([
        fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY)),
        fetchEngineerNames(),
      ]);

      const structuredData = {};
      (data || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      if (!structuredData["Call type"] || structuredData["Call type"].filter(Boolean).length === 0) {
        structuredData["Call type"] = ["Incoming", "Outgoing"];
      }

      // Engineer names now come from Master > Engineer Contacts, not the
      // old 'engineer_assign_name' dropdown category — see engineers.js.
      structuredData["Engineer Assign Name"] = engineerNames;

      setMasterData([structuredData]);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
      toast({
        title: "Error",
        description: "Failed to load dropdown data",
        variant: "destructive",
      });
    }
  };

  // Sourced live from the production Lead-To-Order-Supabase-New project's
  // client master, not this project's own (now-retired) company_details
  // table — see [[servicesupport_migration_project]] memory.
  const fetchCompanyDetails = async () => {
    try {
      const { data, error } = await ltoSupabase
        .from("lto_client_master")
        .select("company_name, billing_address, gst_number")
        .order("company_name", { ascending: true });

      if (error) throw error;
      setCompanyDetails(data || []);
    } catch (error) {
      console.error("Error fetching company details:", error);
      toast({
        title: "Error",
        description: "Failed to load company details",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDropdown();
    fetchCompanyDetails();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowMachineDropdown(false);
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const generateSixDigitOTP = () => {
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    return result;
  };

  const handleNewEnquiryCompanyChange = (value) => {
    setNewEnquiryData((prev) => {
      const updated = { ...prev, companyName: value };

      if (prev.clientType === "Existing") {
        const match = companyDetails.find(
          (c) => c.company_name && c.company_name.toLowerCase() === value.toLowerCase()
        );

        if (match) {
          updated.gstNo = match.gst_number || "";
          updated.gstAddress = match.billing_address || "";
        }
      }
      return updated;
    });
  };

  const userName = localStorage.getItem("currentUsername");

  const isValidVideoCallTime = (timeStr) => {
    if (!timeStr) return false;
    const [hoursStr, minutesStr] = timeStr.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (isNaN(hours) || isNaN(minutes)) return false;
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = 9 * 60 + 30; // 9:30 AM = 570 mins
    const endMinutes = 19 * 60 + 30;   // 7:30 PM = 1170 mins
    return totalMinutes >= startMinutes && totalMinutes <= endMinutes;
  };

  const handleNewEnquirySubmit = async (e) => {
    e.preventDefault();

    if (!newEnquiryData.clientName) {
      toast({ title: "Validation Error", description: "Client Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.phoneNumber) {
      toast({ title: "Validation Error", description: "Phone Number is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.enquiryType) {
      toast({ title: "Validation Error", description: "Enquiry Type is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.category) {
      toast({ title: "Validation Error", description: "Category is required", variant: "destructive" });
      return;
    }
    if (newFormSelectedCategories.length === 0) {
      toast({ title: "Validation Error", description: "Sub-Category is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.videoCall) {
      toast({ title: "Validation Error", description: "Video-Call is required", variant: "destructive" });
      return;
    }
    if (newEnquiryData.videoCall === "Yes") {
      if (!newEnquiryData.videoCallTime) {
        toast({ title: "Validation Error", description: "Video-Call Time is required", variant: "destructive" });
        return;
      }
      if (!isValidVideoCallTime(newEnquiryData.videoCallTime)) {
        toast({ title: "Validation Error", description: "Video Call time must be between 9:30 AM and 7:30 PM.", variant: "destructive" });
        return;
      }
      if (!newEnquiryData.engineerAssign) {
        toast({ title: "Validation Error", description: "Engineer-Assigned is required", variant: "destructive" });
        return;
      }
    }
    if (!newEnquiryData.callType) {
      toast({ title: "Validation Error", description: "Call Type is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.sourceOfEnquiry) {
      toast({ title: "Validation Error", description: "Source of Enquiry is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.enquiryReceiverName) {
      toast({ title: "Validation Error", description: "Enquiry Receiver Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.serviceLocation) {
      toast({ title: "Validation Error", description: "Service Location is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.companyName || !newEnquiryData.companyName.trim()) {
      toast({ title: "Validation Error", description: "Company Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.gstAddress || !newEnquiryData.gstAddress.trim()) {
      toast({ title: "Validation Error", description: "GST Address is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.siteAddress || !newEnquiryData.siteAddress.trim()) {
      toast({ title: "Validation Error", description: "Site Address is required", variant: "destructive" });
      return;
    }
    if (newFormSelectedMachines.length === 0) {
      toast({ title: "Validation Error", description: "Machine Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.mentionIssue || !newEnquiryData.mentionIssue.trim()) {
      toast({ title: "Validation Error", description: "Mention Issue is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const isLocWarehouse = newEnquiryData.serviceLocation?.trim() === "Warehouse";

    try {
      let challanCopyUrl = newEnquiryData.challanCopy || "";
      let machinePhotoUrl = newEnquiryData.machinePhoto || "";

      if (isLocWarehouse) {
        if (warehouseFiles.challanCopy) {
          challanCopyUrl = await uploadWarehouseFile(warehouseFiles.challanCopy, "challanCopy");
        }
        if (warehouseFiles.machinePhoto) {
          machinePhotoUrl = await uploadWarehouseFile(warehouseFiles.machinePhoto, "machinePhoto");
        }
      } else {
        challanCopyUrl = "";
        machinePhotoUrl = "";
      }

      // Optional, regardless of service location — unlike the warehouse
      // attachments above.
      let enquiryItemListUrl = newEnquiryData.enquiryItemList || "";
      if (enquiryItemListFile) {
        enquiryItemListUrl = await uploadEnquiryItemListFile(enquiryItemListFile);
      }

      if (isEditMode && editingTicket) {
        const updatePayload = {
          source_of_enquiry: newEnquiryData.sourceOfEnquiry || "",
          call_type: newEnquiryData.callType || "",
          enquiry_receiver_name: newEnquiryData.enquiryReceiverName || "",
          client_type: newEnquiryData.clientType || "",
          company_name: newEnquiryData.companyName || "",
          client_name: newEnquiryData.clientName || "",
          phone_number: newEnquiryData.phoneNumber || "",
          site_address: newEnquiryData.siteAddress || "",
          gst_no: newEnquiryData.gstNo || "",
          gst_address: newEnquiryData.gstAddress || "",
          machine_name: newFormSelectedMachines.join(", "),
          enquiry_type: newEnquiryData.enquiryType || "",
          category: newEnquiryData.category || "",
          mention_issue: newEnquiryData.mentionIssue || "",
          service_location: newEnquiryData.serviceLocation || "",
          challan_copy: challanCopyUrl,
          machine_photo: machinePhotoUrl,
          video_call: newEnquiryData.videoCall || "",
          sub_category: newFormSelectedCategories.join(", "),
          video_call_time: newEnquiryData.videoCallTime || "",
          engineer_assign: newEnquiryData.engineerAssign || "",
          enquiry_item_list: enquiryItemListUrl,
          remarks: newEnquiryData.remarks || "",
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("sss_tickets")
          .update(updatePayload)
          .eq("ticket_id", editingTicket.ticketId);

        const result = error ? { success: false, error: error.message } : { success: true };

        if (result.success) {
          toast({
            title: "Success",
            description: `Enquiry updated successfully for Ticket ID: ${editingTicket.ticketId}`,
          });
          setShowNewEnquiryForm(false);
          setNewEnquiryData(EMPTY_FORM);
          setNewFormSelectedMachines([]);
          setNewFormSelectedCategories([]);
          setWarehouseFiles({ challanCopy: null, machinePhoto: null });
          setEnquiryItemListFile(null);
          setIsEditMode(false);
          setEditingTicket(null);
          fetchData();
        } else {
          throw new Error(result.error || "Failed to update enquiry");
        }
      } else {
        const submittedAt = new Date();
        const warrantyCheckPlanned = await computeStagePlanned("warrantyCheck", {
          ticketSubmittedAt: submittedAt,
        });
        // Only generate an OTP when Video-Call is "Yes" — also doubles as
        // the "Service Reference" sent to the client in the video-call
        // WhatsApp notification below.
        const videoCallOtp = newEnquiryData.videoCall === "Yes" ? generateSixDigitOTP() : "";

        const insertPayload = {
          source_of_enquiry: newEnquiryData.sourceOfEnquiry || "",
          call_type: newEnquiryData.callType || "",
          enquiry_receiver_name: newEnquiryData.enquiryReceiverName || "",
          client_type: newEnquiryData.clientType || "",
          company_name: newEnquiryData.companyName || "",
          client_name: newEnquiryData.clientName || "",
          phone_number: newEnquiryData.phoneNumber || "",
          site_address: newEnquiryData.siteAddress || "",
          gst_no: newEnquiryData.gstNo || "",
          gst_address: newEnquiryData.gstAddress || "",
          machine_name: newFormSelectedMachines.join(", "),
          enquiry_type: newEnquiryData.enquiryType || "",
          category: newEnquiryData.category || "",
          mention_issue: newEnquiryData.mentionIssue || "",
          service_location: newEnquiryData.serviceLocation || "",
          challan_copy: challanCopyUrl,
          machine_photo: machinePhotoUrl,
          video_call: newEnquiryData.videoCall || "",
          sub_category: newFormSelectedCategories.join(", "),
          video_call_time: newEnquiryData.videoCallTime || "",
          engineer_assign: newEnquiryData.engineerAssign || "",
          enquiry_item_list: enquiryItemListUrl,
          remarks: newEnquiryData.remarks || "",
          otp: videoCallOtp,
          cre_name: userName || "",
          // Stamps this ticket ready for the next stage (Warranty-Check):
          // this row's own submit-time timestamp + tat_config['Warranty-Check'].
          // See stagePlanning.js.
          warranty_check_planned: warrantyCheckPlanned,
        };

        const { data: inserted, error } = await supabase
          .from("sss_tickets")
          .insert(insertPayload)
          .select("ticket_id")
          .single();

        const result = error
          ? { success: false, error: error.message }
          : { success: true, ticketId: inserted.ticket_id };

        if (result.success) {
          toast({
            title: "Success",
            description: `Enquiry created successfully with Ticket ID: ${result.ticketId}`,
          });

          // Fire-and-forget: a WhatsApp failure should never block ticket
          // creation, which has already succeeded at this point.
          //
          // When Video-Call = "Yes", the "registered" + "video-call-
          // scheduled" client messages must land in that order — a race
          // between two separate requests here previously let Meta deliver
          // them out of order. So in that case skip the standalone
          // "registered" call entirely and let the video-call notification
          // below send both, in order, itself (see the Edge Function).
          if (newEnquiryData.videoCall !== "Yes") {
            sendServiceRequestRegisteredNotification({
              phoneNumber: newEnquiryData.phoneNumber,
              clientName: newEnquiryData.clientName,
              companyName: newEnquiryData.companyName || newEnquiryData.clientName,
              ticketId: result.ticketId,
              category: newFormSelectedCategories.join(", "),
              issue: newEnquiryData.mentionIssue,
            }).then(({ success, error }) => {
              if (!success) {
                toast({
                  title: "WhatsApp notification not sent",
                  description: error || "Ticket was created, but the WhatsApp message could not be sent.",
                  variant: "destructive",
                });
              }
            });
          }

          // Additionally notify the client + assigned engineer over WhatsApp
          // when a video call was scheduled on this ticket.
          if (newEnquiryData.videoCall === "Yes") {
            sendVideoCallScheduledNotifications({
              clientPhoneNumber: newEnquiryData.phoneNumber,
              clientName: newEnquiryData.clientName,
              companyName: newEnquiryData.companyName || newEnquiryData.clientName,
              category: newFormSelectedCategories.join(", "),
              ticketId: result.ticketId,
              issue: newEnquiryData.mentionIssue,
              engineerName: newEnquiryData.engineerAssign,
              dateStr: formatDate(submittedAt),
              timeStr: formatTime12hr(newEnquiryData.videoCallTime),
              otp: videoCallOtp,
            }).then(({ success, error, engineerNotified, engineerError }) => {
              if (!success) {
                toast({
                  title: "Video-call WhatsApp notification not sent",
                  description: error || "Ticket was created, but the client could not be notified over WhatsApp.",
                  variant: "destructive",
                });
              }
              if (!engineerNotified) {
                toast({
                  title: "Engineer not notified over WhatsApp",
                  description: engineerError || `No WhatsApp number on file for ${newEnquiryData.engineerAssign}.`,
                  variant: "destructive",
                });
              }
            });
          }

          setShowNewEnquiryForm(false);
          setNewEnquiryData(EMPTY_FORM);
          setNewFormSelectedMachines([]);
          setNewFormSelectedCategories([]);
          setWarehouseFiles({ challanCopy: null, machinePhoto: null });
          setEnquiryItemListFile(null);
          fetchData();
        } else {
          throw new Error(result.error || "Failed to create enquiry");
        }
      }
    } catch (error) {
      console.error("Error saving enquiry:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save enquiry",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const editableData = useMemo(
    () => pendingData.filter((item) => !EDIT_EXCLUDED_STAGES.includes(item.currentStage)),
    [pendingData]
  );

  // Date range narrows the rows before the list hook (same semantics as before);
  // search and category go through the hook.
  const dateFilteredData = useMemo(
    () =>
      editableData.filter((item) => {
        if (item.timeStemp) {
          let ticketDateObj = null;
          if (typeof item.timeStemp === "string" && item.timeStemp.includes("/")) {
            const datePart = item.timeStemp.split(" ")[0];
            const parts = datePart.split("/");
            if (parts.length === 3) {
              ticketDateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            }
          } else {
            ticketDateObj = new Date(item.timeStemp);
          }

          if (ticketDateObj && !isNaN(ticketDateObj.getTime())) {
            ticketDateObj.setHours(0, 0, 0, 0);

            if (dateRange.start) {
              const fromDateObj = new Date(dateRange.start);
              fromDateObj.setHours(0, 0, 0, 0);
              if (ticketDateObj < fromDateObj) return false;
            }

            if (dateRange.end) {
              const toDateObj = new Date(dateRange.end);
              toDateObj.setHours(23, 59, 59, 999);
              if (ticketDateObj > toDateObj) return false;
            }
          }
        } else if (dateRange.start || dateRange.end) {
          return false;
        }
        return true;
      }),
    [editableData, dateRange]
  );

  const list = useClientList({
    key: "tickets",
    data: { all: dateFilteredData },
    tabLabels: { all: "All Tickets" },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchData,
    searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],
    filters: [{ key: "category", label: "Category", allLabel: "All Categories", get: (r) => r.category }],
    columns: COLUMNS,
  });

  const handleNewEnquiryClick = () => {
    setIsEditMode(false);
    setEditingTicket(null);
    // Note: this reset has always lacked gstAddress and carried a stray serialNumOfMachines; kept as-is.
    setNewEnquiryData({
      clientType: "New",
      sourceOfEnquiry: "",
      callType: "",
      enquiryReceiverName: "",
      companyName: "",
      clientName: "",
      phoneNumber: "",
      siteAddress: "",
      gstNo: "",
      machineName: "",
      enquiryType: "",
      category: "",
      mentionIssue: "",
      serviceLocation: "",
      challanCopy: "",
      machinePhoto: "",
      videoCall: "",
      subCategory: "",
      videoCallTime: "",
      engineerAssign: "",
      serialNumOfMachines: "",
      enquiryItemList: "",
      remarks: "",
    });
    setNewFormSelectedMachines([]);
    setNewFormSelectedCategories([]);
    setWarehouseFiles({ challanCopy: null, machinePhoto: null });
    setEnquiryItemListFile(null);
    setShowNewEnquiryForm(true);
  };

  const hasDateRange = !!(dateRange.start || dateRange.end);

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search Ticket, Client..."
        extraFilters={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDateModalOpen(true)}
              className={`whitespace-nowrap ${hasDateRange ? "border-primary bg-brand-50" : ""}`}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              {hasDateRange ? (
                <span className="text-xs font-semibold">
                  {dateRange.start && dateRange.end
                    ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
                    : (dateRange.start ? `From ${formatDate(dateRange.start)}` : `To ${formatDate(dateRange.end)}`)}
                </span>
              ) : "Date Range"}
            </Button>
            {hasDateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange({ start: "", end: "" })}
                className="px-2 text-xs"
                title="Clear date range"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Clear dates
              </Button>
            )}
          </div>
        }
        actions={
          <Button size="sm" onClick={handleNewEnquiryClick} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Enquiry
          </Button>
        }
      />
      <ListTable
        list={list}
        ctx={{ onEdit: handleEditClick }}
        rowKey={(r) => r.ticketId}
        cardTitle={(r) => r.companyName || "No Company"}
        emptyTitle="No enquiries found."
        ariaLabel="Tickets and enquiries"
      />

      <Modal
        isOpen={showNewEnquiryForm}
        onClose={() => setShowNewEnquiryForm(false)}
        title={
          <div className="flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 text-brand-600" />
            <span>{isEditMode ? `Edit Enquiry: ${editingTicket?.ticketId}` : "New Enquiry"}</span>
          </div>
        }
        size="4xl"
        className="rounded-lg max-h-[90vh] overflow-y-auto"
      >
        <form
          onSubmit={handleNewEnquirySubmit}
          className="space-y-6 max-h-[70vh] overflow-y-auto p-2"
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gray-50 px-4 py-3">
              <CardTitle className="text-sm font-medium flex items-center bg-transparent border-0 shadow-none text-gray-800">
                Client Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="tk-clientType" className="text-sm">Client Type *</Label>
                <Select
                  onValueChange={(value) => {
                    setNewEnquiryData(prev => ({
                      ...prev,
                      clientType: value,
                      companyName: value === "New" ? "" : prev.companyName,
                      gstNo: value === "New" ? "" : prev.gstNo,
                      gstAddress: value === "New" ? "" : prev.gstAddress
                    }));
                  }}
                  value={newEnquiryData.clientType}
                >
                  <SelectTrigger id="tk-clientType">
                    <SelectValue placeholder="Select Client Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Existing">Existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-company" className="text-sm">Company Name *</Label>
                {newEnquiryData.clientType === "Existing" ? (
                  <div className="relative">
                    <Input id="tk-company"
                      value={newEnquiryData.companyName || ""}
                      onChange={(e) => handleNewEnquiryCompanyChange(e.target.value)}
                      placeholder="Type to search or select company name"
                      list="new-company-suggestions"
                      required
                    />
                    <datalist id="new-company-suggestions">
                      {companyDetails.map((c) => (
                        <option key={c.company_name} value={c.company_name} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <Input id="tk-company"
                    value={newEnquiryData.companyName || ""}
                    onChange={(e) => setNewEnquiryData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Enter company name"
                    required
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-clientName" className="text-sm">Client Name *</Label>
                <Input id="tk-clientName"
                  value={newEnquiryData.clientName || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Enter client name"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-phone" className="text-sm">Phone Number *</Label>
                <Input id="tk-phone"
                  value={newEnquiryData.phoneNumber || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gray-50 px-4 py-3">
              <CardTitle className="text-sm font-medium flex items-center bg-transparent border-0 shadow-none text-gray-800">
                Enquiry Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Row 1: Call Type, Source of Enquiry, Enquiry Receiver Name */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="tk-callType" className="text-sm">Call Type *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, callType: value }))}
                    value={newEnquiryData.callType}
                  >
                    <SelectTrigger id="tk-callType">
                      <SelectValue placeholder="Select Call Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {(masterData[0]?.["Call type"] || [])
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tk-source" className="text-sm">Source of Enquiry *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, sourceOfEnquiry: value }))}
                    value={newEnquiryData.sourceOfEnquiry || undefined}
                  >
                    <SelectTrigger id="tk-source">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {[...new Set(masterData[0]?.["Source of enquiry"] || [])]
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tk-receiver" className="text-sm">Enquiry Receiver Name *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, enquiryReceiverName: value }))}
                    value={newEnquiryData.enquiryReceiverName || undefined}
                  >
                    <SelectTrigger id="tk-receiver">
                      <SelectValue placeholder="Select receiver name" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {[...new Set(masterData[0]?.["Enquiry Receiver Name"] || [])]
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Enquiry Type (new), Category (renamed from Enquiry-Type), Sub-Category (renamed from Category) */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="tk-enquiryType" className="text-sm">Enquiry Type *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, enquiryType: value }))}
                    value={newEnquiryData.enquiryType}
                  >
                    <SelectTrigger id="tk-enquiryType">
                      <SelectValue placeholder="Select Enquiry Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {[...new Set(masterData[0]?.["Enquiry Type"] || [])]
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tk-category" className="text-sm">Category *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, category: value }))}
                    value={newEnquiryData.category}
                  >
                    <SelectTrigger id="tk-category">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {[...new Set(masterData[0]?.["Category"] || [])]
                        .filter(Boolean)
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 relative dropdown-container">
                  <Label htmlFor="tk-subCategory" className="text-sm">Sub-Category *</Label>
                  <div className="relative">
                    <button id="tk-subCategory"
                      type="button"
                      onClick={() => {
                        setShowCategoryDropdown(!showCategoryDropdown);
                        setShowMachineDropdown(false);
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="text-gray-500">Select sub-category(ies)</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 opacity-50"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {showCategoryDropdown && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                        <div className="px-2 py-1 sticky top-0 bg-white z-10">
                          <Input
                            placeholder="Search sub-category..."
                            value={categorySearchQuery}
                            onChange={(e) => setCategorySearchQuery(e.target.value)}
                            className="h-8 text-xs border-gray-200"
                          />
                        </div>
                        <div className="mt-1">
                          {[...new Set(masterData[0]?.["Sub-Category"] || [])]
                            .filter(Boolean)
                            .filter(option =>
                              option.toLowerCase().includes(categorySearchQuery.toLowerCase())
                            )
                            .map((option) => (
                              <button
                                key={option}
                                type="button"
                                disabled={newFormSelectedCategories.includes(option)}
                                onClick={() => {
                                  if (!newFormSelectedCategories.includes(option)) {
                                    setNewFormSelectedCategories(prev => [...prev, option]);
                                  }
                                  setCategorySearchQuery("");
                                  setShowCategoryDropdown(false);
                                }}
                                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                              >
                                {option}
                              </button>
                            ))}
                          {[...new Set(masterData[0]?.["Sub-Category"] || [])]
                            .filter(Boolean)
                            .filter(option =>
                              option.toLowerCase().includes(categorySearchQuery.toLowerCase())
                            ).length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-2">No sub-category found</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {newFormSelectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newFormSelectedCategories.map((cat) => (
                        <div
                          key={cat}
                          className="bg-brand-100 text-brand-800 text-xs px-2 py-1 rounded flex items-center"
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => {
                              setNewFormSelectedCategories(prev => prev.filter(c => c !== cat));
                            }}
                            className="ml-1 text-brand-600 hover:text-brand-800 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={`md:col-span-2 grid grid-cols-1 ${newEnquiryData.videoCall === "Yes" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
                <div className="space-y-1">
                  <Label htmlFor="tk-videoCall" className="text-sm">Video-Call *</Label>
                  <Select
                    value={newEnquiryData.videoCall || ""}
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, videoCall: value }))}
                  >
                    <SelectTrigger id="tk-videoCall">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newEnquiryData.videoCall === "Yes" && (
                  <>
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <Label className="text-sm">Video-Call Time (9:30 AM - 7:30 PM) *</Label>
                      <TimePicker12
                        value={newEnquiryData.videoCallTime || ""}
                        onChange={(val) => setNewEnquiryData(prev => ({ ...prev, videoCallTime: val }))}
                      />
                    </div>
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <Label htmlFor="tk-engineer" className="text-sm">Engineer-Assigned *</Label>
                      <Select
                        onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, engineerAssign: value }))}
                        value={newEnquiryData.engineerAssign || ""}
                      >
                        <SelectTrigger id="tk-engineer">
                          <SelectValue placeholder="Select Engineer" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {(masterData[0]?.["Engineer Assign Name"] || [])
                            .filter(Boolean)
                            .map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-gstNo" className="text-sm">GST No.</Label>
                <Input id="tk-gstNo"
                  value={newEnquiryData.gstNo || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstNo: e.target.value }))}
                  placeholder="Enter GST No."
                  disabled={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== ""}
                  className={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== "" ? "bg-gray-100" : ""}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-gstAddress" className="text-sm">GST Address *</Label>
                <Input id="tk-gstAddress"
                  value={newEnquiryData.gstAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstAddress: e.target.value }))}
                  placeholder="Enter GST Address"
                  disabled={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== ""}
                  className={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== "" ? "bg-gray-100" : ""}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-site" className="text-sm">Site Address *</Label>
                <Input id="tk-site"
                  value={newEnquiryData.siteAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, siteAddress: e.target.value }))}
                  placeholder="Enter Site Address"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-location" className="text-sm">Service Location *</Label>
                <Select
                  onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, serviceLocation: value }))}
                  value={newEnquiryData.serviceLocation}
                >
                  <SelectTrigger id="tk-location">
                    <SelectValue placeholder="Select Service Location" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {[...new Set(masterData[0]?.["Service Location"] || [])]
                      .filter(Boolean)
                      .map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>



              {newEnquiryData.serviceLocation?.trim() === "Warehouse" && (
                <div className="md:col-span-2 border border-brand-100 rounded-lg p-4 bg-brand-50/20 space-y-4">
                  <h4 className="text-sm font-semibold text-brand-800 border-b border-brand-100 pb-2">
                    Warehouse Service Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Challan Copy File Input */}
                    <div className="space-y-1">
                      <Label htmlFor="tk-challan" className="text-sm">Challan Copy</Label>
                      {warehouseFiles.challanCopy ? (
                        <div className="flex items-center justify-between border border-brand-200 rounded-md p-2 bg-brand-50 text-brand-800 text-sm">
                          <span className="truncate max-w-[200px]" title={warehouseFiles.challanCopy.name}>
                            {warehouseFiles.challanCopy.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeWarehouseFile("challanCopy")}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : newEnquiryData.challanCopy ? (
                        <div className="flex items-center justify-between border border-emerald-200 rounded-md p-2 bg-emerald-50 text-emerald-800 text-sm">
                          <a href={newEnquiryData.challanCopy} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[200px]">
                            View Challan Copy
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeWarehouseFile("challanCopy")}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Input id="tk-challan"
                          type="file"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleWarehouseFileSelect("challanCopy", e.target.files[0]);
                            }
                          }}
                        />
                      )}
                    </div>

                    {/* Machine Photo File Input */}
                    <div className="space-y-1">
                      <Label htmlFor="tk-photo" className="text-sm">Machine Photo</Label>
                      {warehouseFiles.machinePhoto ? (
                        <div className="flex items-center justify-between border border-brand-200 rounded-md p-2 bg-brand-50 text-brand-800 text-sm">
                          <span className="truncate max-w-[200px]" title={warehouseFiles.machinePhoto.name}>
                            {warehouseFiles.machinePhoto.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeWarehouseFile("machinePhoto")}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : newEnquiryData.machinePhoto ? (
                        <div className="flex items-center justify-between border border-emerald-200 rounded-md p-2 bg-emerald-50 text-emerald-800 text-sm">
                          <a href={newEnquiryData.machinePhoto} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[200px]">
                            View Machine Photo
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeWarehouseFile("machinePhoto")}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Input id="tk-photo"
                          type="file"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleWarehouseFileSelect("machinePhoto", e.target.files[0]);
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}


              <div className="space-y-1 md:col-span-2 relative">
                <Label htmlFor="tk-machine" className="text-sm">Machine Name *</Label>
                <div className="relative dropdown-container">
                  <button id="tk-machine"
                    type="button"
                    onClick={() => {
                      setShowMachineDropdown(!showMachineDropdown);
                      setShowCategoryDropdown(false);
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-gray-500">Select machine(s)</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 opacity-50"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {showMachineDropdown && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                      <div className="px-2 py-1 sticky top-0 bg-white z-10">
                        <Input
                          placeholder="Search machine..."
                          value={machineSearchQuery}
                          onChange={(e) => setMachineSearchQuery(e.target.value)}
                          className="h-8 text-xs border-gray-200"
                        />
                      </div>
                      <div className="mt-1">
                        {[...new Set(masterData[0]?.["Machine Name"] || [])]
                          .filter(Boolean)
                          .filter(option =>
                            option.toLowerCase().includes(machineSearchQuery.toLowerCase())
                          )
                          .map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={newFormSelectedMachines.includes(option)}
                              onClick={() => {
                                if (!newFormSelectedMachines.includes(option)) {
                                  setNewFormSelectedMachines(prev => [...prev, option]);
                                }
                                setMachineSearchQuery("");
                                setShowMachineDropdown(false);
                              }}
                              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                            >
                              {option}
                            </button>
                          ))}
                        {[...new Set(masterData[0]?.["Machine Name"] || [])]
                          .filter(Boolean)
                          .filter(option =>
                            option.toLowerCase().includes(machineSearchQuery.toLowerCase())
                          ).length === 0 && (
                          <p className="text-xs text-gray-500 text-center py-2">No machine found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {newFormSelectedMachines.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newFormSelectedMachines.map((machine) => (
                      <div
                        key={machine}
                        className="bg-brand-100 text-brand-800 text-xs px-2 py-1 rounded flex items-center"
                      >
                        {machine}
                        <button
                          type="button"
                          onClick={() => {
                            setNewFormSelectedMachines(prev => prev.filter(m => m !== machine));
                          }}
                          className="ml-1 text-brand-600 hover:text-brand-800 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="tk-issue" className="text-sm">Mention Issue *</Label>
                <Textarea id="tk-issue"
                  value={newEnquiryData.mentionIssue || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, mentionIssue: e.target.value }))}
                  placeholder="Describe the issue"
                  rows={3}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-itemList" className="text-sm">Enquiry-Item-List</Label>
                {enquiryItemListFile ? (
                  <div className="flex items-center justify-between border border-brand-200 rounded-md p-2 bg-brand-50 text-brand-800 text-sm">
                    <span className="truncate max-w-[200px]" title={enquiryItemListFile.name}>
                      {enquiryItemListFile.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={removeEnquiryItemListFile}
                      className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                ) : newEnquiryData.enquiryItemList ? (
                  <div className="flex items-center justify-between border border-emerald-200 rounded-md p-2 bg-emerald-50 text-emerald-800 text-sm">
                    <a href={newEnquiryData.enquiryItemList} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[200px]">
                      View Attachment
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={removeEnquiryItemListFile}
                      className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Input id="tk-itemList"
                    type="file"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleEnquiryItemListFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="tk-remarks" className="text-sm">Remarks</Label>
                <Input id="tk-remarks"
                  value={newEnquiryData.remarks || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter remarks"
                />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewEnquiryForm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2Icon className="animate-spin w-4 h-4 mr-2" />
              )}
              {isEditMode ? "Save Changes" : "Create Enquiry"}
            </Button>
          </div>
        </form>
      </Modal>

      <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-brand-100">
          <DialogHeader>
            <DialogTitle className="text-brand-800 flex items-center">
              <Calendar className="mr-2 h-5 w-5 text-brand-600" />
              Filter by Date Range
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="start" className="text-brand-700 font-medium">Start Date</Label>
              <Input
                id="start"
                type="date"
                className="border-brand-200 focus:ring-brand-500"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end" className="text-brand-700 font-medium">End Date</Label>
              <Input
                id="end"
                type="date"
                className="border-brand-200 focus:ring-brand-500"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-between gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setDateRange({ start: "", end: "" })}
              className="border-brand-200 text-brand-600 hover:bg-brand-50"
            >
              Reset Range
            </Button>
            <Button
              onClick={() => setIsDateModalOpen(false)}
              className="px-8"
            >
              Apply Filter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
