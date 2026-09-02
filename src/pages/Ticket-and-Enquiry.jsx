import { useState, useEffect } from "react";
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
  LoaderIcon,
  Plus,
  Search,
  Calendar,
  RotateCcw,
  Trash2,
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
import { computeStagePlanned } from "../lib/supabase/stagePlanning";

export default function TicketAndEnquiry() {
  const [pendingData, setPendingData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [masterData, setMasterData] = useState({});
  const [searchItem, setSearchItem] = useState("");

  // Filter States
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // New Enquiry Form States
  const [showNewEnquiryForm, setShowNewEnquiryForm] = useState(false);
  const [newEnquiryData, setNewEnquiryData] = useState({
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
    videoCall: "Yes",
    subCategory: "",
    videoCallTime: "",
    engineerAssign: ""
  });
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
      engineerAssign: ticket.engineerAssign || ""
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

  const fetchData = async () => {
    setFetchLoading(true);
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
      }));

      // Show all tickets in the system
      setPendingData(allData);
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
    engineer_assign_name: "Engineer Assign Name",
    machine_name: "Machine Name",
  };

  const fetchDropdown = async () => {
    try {
      const data = await fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY));

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

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

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
      alert("Error: Client Name is required");
      return;
    }
    if (!newEnquiryData.phoneNumber) {
      alert("Error: Phone Number is required");
      return;
    }
    if (!newEnquiryData.enquiryType) {
      alert("Error: Enquiry Type is required");
      return;
    }
    if (!newEnquiryData.category) {
      alert("Error: Category is required");
      return;
    }
    if (newFormSelectedCategories.length === 0) {
      alert("Error: Sub-Category is required");
      return;
    }
    if (newEnquiryData.videoCall === "Yes") {
      if (!newEnquiryData.videoCallTime) {
        alert("Error: Video-Call Time is required");
        return;
      }
      if (!isValidVideoCallTime(newEnquiryData.videoCallTime)) {
        alert("Error: Video Call time must be between 9:30 AM and 7:30 PM.");
        return;
      }
      if (!newEnquiryData.engineerAssign) {
        alert("Error: Engineer-Assigned is required");
        return;
      }
    }
    if (!newEnquiryData.callType) {
      alert("Error: Call Type is required");
      return;
    }
    if (!newEnquiryData.sourceOfEnquiry) {
      alert("Error: Source of Enquiry is required");
      return;
    }
    if (!newEnquiryData.enquiryReceiverName) {
      alert("Error: Enquiry Receiver Name is required");
      return;
    }
    if (!newEnquiryData.serviceLocation) {
      alert("Error: Service Location is required");
      return;
    }
    if (newEnquiryData.clientType === "Existing" && !newEnquiryData.companyName) {
      alert("Error: Company Name is required for existing clients");
      return;
    }
    if (!newEnquiryData.gstAddress || !newEnquiryData.gstAddress.trim()) {
      alert("Error: GST Address is required");
      return;
    }
    if (newFormSelectedMachines.length === 0) {
      alert("Error: Machine Name is required");
      return;
    }
    if (!newEnquiryData.mentionIssue || !newEnquiryData.mentionIssue.trim()) {
      alert("Error: Mention Issue is required");
      return;
    }

    setIsSubmitting(true);
    const currentDateTime = formatDateTime(new Date());
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
            gstAddress: "",
            machineName: "",
            enquiryType: "",
            category: "",
            mentionIssue: "",
            serviceLocation: "",
            challanCopy: "",
            machinePhoto: "",
            videoCall: "Yes",
            subCategory: "",
            videoCallTime: "",
            engineerAssign: ""
          });
          setNewFormSelectedMachines([]);
          setNewFormSelectedCategories([]);
          setWarehouseFiles({ challanCopy: null, machinePhoto: null });
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
          // Only generate an OTP when Video-Call is "Yes"
          otp: newEnquiryData.videoCall === "Yes" ? generateSixDigitOTP() : "",
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
          setShowNewEnquiryForm(false);
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
            gstAddress: "",
            machineName: "",
            enquiryType: "",
            category: "",
            mentionIssue: "",
            serviceLocation: "",
            challanCopy: "",
            machinePhoto: "",
            videoCall: "Yes",
            subCategory: "",
            videoCallTime: "",
            engineerAssign: ""
          });
          setNewFormSelectedMachines([]);
          setNewFormSelectedCategories([]);
          setWarehouseFiles({ challanCopy: null, machinePhoto: null });
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

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = roleStorage ? JSON.parse(roleStorage) : null;
  const role = parsedData?.state?.user?.role;

  // Once a ticket reaches one of these stages, editing it here no longer
  // makes sense (billing/downstream paperwork has already started on it) —
  // it's dropped from this page's list entirely, not just its Edit button.
  const EDIT_EXCLUDED_STAGES = ["Invoice", "Calibration", "Calibration Certificate", "Spare Dispatch Details"];
  const editableData = pendingData.filter((item) => !EDIT_EXCLUDED_STAGES.includes(item.currentStage));

  const roleFilteredData = role === "user"
    ? editableData.filter((item) => item["CREName"] === userName)
    : role === "engineer"
      ? editableData.filter((item) => item["engineerAssign"] === userName)
      : editableData;

  const filteredPendingData = roleFilteredData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q);
      
      if (!matchesSearch) return false;

      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

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
    })
    .reverse();

  // Categories filter dropdown dynamically computes from the current table items
  const availableCategories = [
    ...new Set(roleFilteredData.map((item) => item.category).filter(Boolean)),
  ];

  return (
    <div className="space-y-2">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-blue-900 text-xl font-bold flex items-center gap-2">
              All Tickets
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {filteredPendingData?.length}
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto justify-end">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
              <Input
                placeholder="Search Ticket, Client..."
                className="pl-9 bg-white border-blue-200 shadow-sm w-full h-9 text-sm"
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDateModalOpen(true)}
              className={`border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap h-9 bg-white shadow-sm ${(dateRange.start || dateRange.end) ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200" : ""}`}
            >
              <Calendar className="mr-2 h-4 w-4 text-blue-500" />
              {(dateRange.start || dateRange.end) ? (
                <span className="text-xs font-semibold text-blue-700">
                  {dateRange.start && dateRange.end
                    ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
                    : (dateRange.start ? `From ${formatDate(dateRange.start)}` : `To ${formatDate(dateRange.end)}`)}
                </span>
              ) : "Date Range"}
            </Button>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-white border-blue-200 shadow-sm w-full sm:w-[150px] h-9 text-sm text-blue-800">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                <SelectItem value="all">All Categories</SelectItem>
                {availableCategories.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchItem || categoryFilter !== "all" || dateRange.start || dateRange.end) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchItem("");
                  setCategoryFilter("all");
                  setDateRange({ start: "", end: "" });
                }}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 h-9 min-w-fit"
                title="Clear All Filters"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            <Button
              onClick={() => {
                setIsEditMode(false);
                setEditingTicket(null);
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
                  videoCall: "Yes",
                  subCategory: "",
                  videoCallTime: "",
                  engineerAssign: "",
                  serialNumOfMachines: ""
                });
                setNewFormSelectedMachines([]);
                setNewFormSelectedCategories([]);
                setWarehouseFiles({ challanCopy: null, machinePhoto: null });
                setShowNewEnquiryForm(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-sm transition-all duration-300 rounded-lg px-4 py-2 flex items-center gap-1.5 group shrink-0 h-9"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              New Enquiry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <div className="max-h-[calc(104vh-200px)] overflow-y-auto">
              <table className="hidden sm:block w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[100px] sticky top-0">Actions</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Current Stage</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Date</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Ticket-ID</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Source of enquiry</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Call type</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Enquiry Receiver Name</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Client Type</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Company Name</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Client Name</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Phone Number</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">Site Address</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">GST No.</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Machine Name</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Enquiry Type</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Category</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[250px] sticky top-0">Mention Issue</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Service Location</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-blue-100">
                  {filteredPendingData.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="text-center py-8 bg-white">
                        {fetchLoading ? (
                          <div className="flex justify-center items-center text-blue-700">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        ) : (
                          <h1 className="text-blue-700">No enquiries found.</h1>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredPendingData.map((ticket, ind) => (
                      <tr key={ind} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                        <td className="px-4 py-3 text-blue-900">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(ticket)}
                            className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-3 shadow-sm font-semibold rounded"
                          >
                            Edit
                          </Button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                            {ticket.currentStage || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-blue-900">{formatDate(ticket.timeStemp)}</td>
                        <td className="px-4 py-3 text-blue-900 font-semibold">{ticket.ticketId}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.sourceOfEnquiry}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.callType}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.enquiryReceiverName}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.clientType}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.companyName}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.clientName}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.phoneNumber}</td>
                        <td className="px-4 py-3 text-blue-900 truncate max-w-xs hover:whitespace-normal">{ticket.siteAddress}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.gstNo}</td>
                        <td className="px-4 py-3 text-blue-900 truncate max-w-xs hover:whitespace-normal">{ticket.machineName}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.enquiryType}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.category}</td>
                        <td className="px-4 py-3 text-blue-900 max-w-xs truncate hover:whitespace-normal">{ticket.mentionIssue}</td>
                        <td className="px-4 py-3 text-blue-900">{ticket.serviceLocation}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="sm:hidden space-y-4">
                {filteredPendingData.length === 0 ? (
                  <div className="text-center py-8 bg-white">
                    {fetchLoading ? (
                      <div className="flex justify-center items-center text-blue-700">
                        <LoaderIcon className="animate-spin w-8 h-8" />
                      </div>
                    ) : (
                      <h1 className="text-blue-700">No enquiries found.</h1>
                    )}
                  </div>
                ) : (
                  filteredPendingData.map((ticket, ind) => (
                    <Card key={ind} className={`border-l-4 border-l-blue-500 ${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                {ticket.ticketId}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(ticket.timeStemp)}
                              </span>
                            </div>
                            <h3 className="font-bold text-blue-800 text-lg mt-1">{ticket.companyName || "No Company"}</h3>
                            <p className="text-sm text-gray-600">{ticket.clientName}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                              {ticket.currentStage || "—"}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(ticket)}
                            className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-3 shadow-sm font-semibold rounded shrink-0"
                          >
                            Edit
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 font-medium">Source of Enquiry</p>
                            <p className="text-blue-900">{ticket.sourceOfEnquiry}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">Call Type</p>
                            <p className="text-blue-900">{ticket.callType}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">Enquiry Receiver Name</p>
                            <p className="text-blue-900">{ticket.enquiryReceiverName}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">Client Type</p>
                            <p className="text-blue-900">{ticket.clientType}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">Phone Number</p>
                            <p className="text-blue-900">{ticket.phoneNumber}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">Enquiry Type</p>
                            <p className="text-blue-900">{ticket.enquiryType}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">Category</p>
                            <p className="text-blue-900">{ticket.category}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">Service Location</p>
                            <p className="text-blue-900">{ticket.serviceLocation}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 font-medium">GST No.</p>
                            <p className="text-blue-900">{ticket.gstNo}</p>
                          </div>
                        </div>

                        <div className="text-sm space-y-1">
                          <p className="text-gray-500 font-medium">Site Address</p>
                          <p className="text-blue-900">{ticket.siteAddress}</p>
                        </div>

                        <div className="text-sm space-y-1">
                          <p className="text-gray-500 font-medium">Machine Name</p>
                          <p className="text-blue-900">{ticket.machineName}</p>
                        </div>

                        <div className="text-sm space-y-1">
                          <p className="text-gray-500 font-medium">Mention Issue</p>
                          <p className="text-blue-900">{ticket.mentionIssue}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={showNewEnquiryForm}
        onClose={() => setShowNewEnquiryForm(false)}
        title={
          <div className="flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
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
                <Label className="text-sm">Client Type *</Label>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select Client Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Existing">Existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Company Name *</Label>
                {newEnquiryData.clientType === "Existing" ? (
                  <div className="relative">
                    <Input
                      value={newEnquiryData.companyName || ""}
                      onChange={(e) => handleNewEnquiryCompanyChange(e.target.value)}
                      placeholder="Type to search or select company name"
                      list="new-company-suggestions"
                    />
                    <datalist id="new-company-suggestions">
                      {companyDetails.map((c) => (
                        <option key={c.company_name} value={c.company_name} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <Input
                    value={newEnquiryData.companyName || ""}
                    onChange={(e) => setNewEnquiryData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Enter company name"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Client Name *</Label>
                <Input
                  value={newEnquiryData.clientName || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Enter client name"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Phone Number *</Label>
                <Input
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
                  <Label className="text-sm">Call Type *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, callType: value }))}
                    value={newEnquiryData.callType}
                  >
                    <SelectTrigger>
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
                  <Label className="text-sm">Source of Enquiry *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, sourceOfEnquiry: value }))}
                    value={newEnquiryData.sourceOfEnquiry || undefined}
                  >
                    <SelectTrigger>
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
                  <Label className="text-sm">Enquiry Receiver Name *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, enquiryReceiverName: value }))}
                    value={newEnquiryData.enquiryReceiverName || undefined}
                  >
                    <SelectTrigger>
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
                  <Label className="text-sm">Enquiry Type *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, enquiryType: value }))}
                    value={newEnquiryData.enquiryType}
                  >
                    <SelectTrigger>
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
                  <Label className="text-sm">Category *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, category: value }))}
                    value={newEnquiryData.category}
                  >
                    <SelectTrigger>
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
                  <Label className="text-sm">Sub-Category *</Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryDropdown(!showCategoryDropdown);
                        setShowMachineDropdown(false);
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded flex items-center"
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => {
                              setNewFormSelectedCategories(prev => prev.filter(c => c !== cat));
                            }}
                            className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
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
                  <Label className="text-sm">Video-Call *</Label>
                  <Select value="Yes" disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Yes" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      <SelectItem value="Yes">Yes</SelectItem>
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
                      <Label className="text-sm">Engineer-Assigned *</Label>
                      <Select
                        onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, engineerAssign: value }))}
                        value={newEnquiryData.engineerAssign || ""}
                      >
                        <SelectTrigger>
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
                <Label className="text-sm">GST No.</Label>
                <Input
                  value={newEnquiryData.gstNo || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstNo: e.target.value }))}
                  placeholder="Enter GST No."
                  disabled={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== ""}
                  className={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== "" ? "bg-gray-100" : ""}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">GST Address *</Label>
                <Input
                  value={newEnquiryData.gstAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstAddress: e.target.value }))}
                  placeholder="Enter GST Address"
                  disabled={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== ""}
                  className={newEnquiryData.clientType === "Existing" && newEnquiryData.companyName !== "" ? "bg-gray-100" : ""}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Site Address</Label>
                <Input
                  value={newEnquiryData.siteAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, siteAddress: e.target.value }))}
                  placeholder="Enter Site Address"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Service Location *</Label>
                <Select
                  onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, serviceLocation: value }))}
                  value={newEnquiryData.serviceLocation}
                >
                  <SelectTrigger>
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
                <div className="md:col-span-2 border border-blue-100 rounded-lg p-4 bg-blue-50/20 space-y-4">
                  <h4 className="text-sm font-semibold text-blue-800 border-b border-blue-100 pb-2">
                    Warehouse Service Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Challan Copy File Input */}
                    <div className="space-y-1">
                      <Label className="text-sm">Challan Copy</Label>
                      {warehouseFiles.challanCopy ? (
                        <div className="flex items-center justify-between border border-blue-200 rounded-md p-2 bg-blue-50 text-blue-800 text-sm">
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
                        <Input
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
                      <Label className="text-sm">Machine Photo</Label>
                      {warehouseFiles.machinePhoto ? (
                        <div className="flex items-center justify-between border border-blue-200 rounded-md p-2 bg-blue-50 text-blue-800 text-sm">
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
                        <Input
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
                <Label className="text-sm">Machine Name *</Label>
                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMachineDropdown(!showMachineDropdown);
                      setShowCategoryDropdown(false);
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded flex items-center"
                      >
                        {machine}
                        <button
                          type="button"
                          onClick={() => {
                            setNewFormSelectedMachines(prev => prev.filter(m => m !== machine));
                          }}
                          className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm">Mention Issue *</Label>
                <Textarea
                  value={newEnquiryData.mentionIssue || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, mentionIssue: e.target.value }))}
                  placeholder="Describe the issue"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              onClick={() => setShowNewEnquiryForm(false)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md transition-all duration-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md transition-all duration-300"
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
        <DialogContent className="sm:max-w-[425px] bg-white border-blue-100">
          <DialogHeader>
            <DialogTitle className="text-blue-800 flex items-center">
              <Calendar className="mr-2 h-5 w-5 text-blue-600" />
              Filter by Date Range
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="start" className="text-blue-700 font-medium">Start Date</Label>
              <Input
                id="start"
                type="date"
                className="border-blue-200 focus:ring-blue-500"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end" className="text-blue-700 font-medium">End Date</Label>
              <Input
                id="end"
                type="date"
                className="border-blue-200 focus:ring-blue-500"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-between gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setDateRange({ start: "", end: "" })}
              className="border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              Reset Range
            </Button>
            <Button
              onClick={() => setIsDateModalOpen(false)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md px-8"
            >
              Apply Filter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
