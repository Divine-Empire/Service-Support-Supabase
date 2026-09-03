import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { LoaderIcon, Loader2Icon, Plus, Search, Calendar, Filter, Clock, CheckCircle2, MoreHorizontal, ExternalLink, ClipboardList, Trash2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { Textarea } from "../components/ui/textarea";
import { Modal } from "../components/ui/modal";
import { supabase } from "../lib/supabase/client";
import { ltoSupabase } from "../lib/supabase/ltoClient";
import { fetchDropdownRows } from "../lib/supabase/dropdown";
import { computeStagePlanned } from "../lib/supabase/stagePlanning";


const formatDateTime = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const formatDateOnly = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatInputDate = (dateStr) => {
  if (!dateStr) return "";
  const str = String(dateStr).trim().split(" ")[0];
  
  // Case 1: Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Case 2: DD-MM-YYYY or DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) {
      year = "20" + year;
    }
    return `${year}-${month}-${day}`;
  }

  // Case 3: YYYY/MM/DD
  const matchY = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchY) {
    const year = matchY[1];
    const month = matchY[2].padStart(2, "0");
    const day = matchY[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  // Fallback to JS Date parser (local components to avoid timezone shifts)
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  
  return "";
};

const ServiceInstallation = () => {
  const [installations, setInstallations] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [approvalData, setApprovalData] = useState({
    clientStatus: "Yes",
    actualDate: "",
    serviceType: "",
    engineerName: "",
    remarks: "",
    followUpDate: "",
    customerSay: "",
    videoCallTime: "",
  });

  const { toast } = useToast();
  const [employeeNames, setEmployeeNames] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [serviceTypeSearch, setServiceTypeSearch] = useState("");
  const [engineerSearch, setEngineerSearch] = useState("");
  const [fileData, setFileData] = useState({ name: "", base64: "" });
  const fileInputRef = useRef(null);

  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [newEnquiryData, setNewEnquiryData] = useState({
    clientType: "Existing",
    sourceOfEnquiry: "",
    callType: "",
    enquiryReceiverName: "",
    companyName: "",
    clientName: "",
    phoneNumber: "",
    gstAddress: "",
    siteAddress: "",
    gstNo: "",
    machineName: "",
    category: "",
    mentionIssue: "",
    serviceLocation: "On-Site",
    challanCopy: "",
    machinePhoto: "",
    videoCall: "No",
    newCategory: "",
    videoCallTime: "",
    engineerAssign: ""
  });
  const [newFormSelectedMachines, setNewFormSelectedMachines] = useState([]);
  const [newFormSelectedCategories, setNewFormSelectedCategories] = useState([]);
  const [masterData, setMasterData] = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [machineSearchQuery, setMachineSearchQuery] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState({
    challanCopy: false,
    machinePhoto: false,
  });


  // Dropdown category holding the Service-Type options this page's follow-up
  // form needs ("Site Visit", "Video-Call", ...). Not one of the categories
  // seeded yet in public.dropdown (see schemaMapping.js) — falls back to a
  // small hardcoded list, same "empty until seeded" convention used
  // elsewhere (e.g. Ticket-and-Enquiry.jsx's Call-type fallback), so seeding
  // category='installation_service_type' via Master > Dropdown later just
  // works without a code change.
  const SERVICE_TYPE_FALLBACK = ["Site Visit", "Video-Call", "On-Site"];

  const fetchInstallations = async () => {
    try {
      setFetchLoading(true);
      const { data, error } = await supabase
        .from("sss_service_installation")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((row) => ({
        id: row.id,
        "Timestamp": row.created_at || "",
        "Order No.": row.order_no || "",
        "Is Installation Required Or Not?": row.is_installation_required || "",
        "COMPANY NAME": row.company_name || "",
        "CONTACT PERSON NAME": row.contact_person_name || "",
        "CONTACT PERSON NO.": row.contact_person_no || "",
        "Item-Name": row.item_name || "",
        "Qty": row.qty ?? "",
        "Serial": row.serial || "",
        "SI NO": row.si_no || "",
        "INVOICE DATE": row.invoice_date || "",
        "INVOICE NO": row.invoice_no || "",
        "Invoice Copy": row.invoice_copy_upload || "",
        "Actual material rcvd": row.actual_material_rcvd || "",
        "Client Status": row.installation_follow_up || "",
        "Service-Type": row.service_type || "",
        "Engineer Name": row.engineer_name || "",
        "Service Report": row.service_report_file || "",
        "Next Date": row.next_date || "",
        "What Did Customer's Say (Remarks)": row.what_did_customer_say || "",
        _planned1: row.planned || "",
        _actual1: row.actual || "",
      }));

      setInstallations(formattedData);
    } catch (error) {
      console.error("Error fetching installations:", error);
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
    } finally {
      setFetchLoading(false);
    }
  };

  // Dropdown categories mirror src/pages/Ticket-and-Enquiry.jsx's
  // DROPDOWN_CATEGORY_TO_KEY exactly (same public.dropdown table, same
  // display keys) so the New Enquiry form below — copied from that page —
  // needs no changes.
  const DROPDOWN_CATEGORY_TO_KEY = {
    call_type: "Call type",
    source_of_enquiry: "Source of enquiry",
    enquiry_receiver_name: "Enquiry Receiver Name",
    category: "Requirement Service Category",
    sub_category: "Category",
    service_location: "Service Location",
    engineer_assign_name: "Engineer Assign Name",
    machine_name: "Machine Name",
    installation_service_type: "__service_type__",
  };

  const fetchDropdownData = async () => {
    try {
      const [dropdownRows, { data: companies, error: companyError }] = await Promise.all([
        fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY)),
        ltoSupabase
          .from("lto_client_master")
          .select("company_name, billing_address, gst_number")
          .order("company_name", { ascending: true }),
      ]);

      if (companyError) throw companyError;

      const structuredData = {};
      const serviceTypeValues = [];
      (dropdownRows || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (key === "__service_type__") {
          serviceTypeValues.push(value);
          return;
        }
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      structuredData["Company Name"] = (companies || []).map((c) => c.company_name || "");
      structuredData["BILLING ADDRESS"] = (companies || []).map((c) => c.billing_address || "");
      structuredData["GST No."] = (companies || []).map((c) => c.gst_number || "");

      setMasterData([structuredData]);
      setEmployeeNames([...new Set(structuredData["Engineer Assign Name"] || [])]);
      setServiceTypes(
        serviceTypeValues.filter(Boolean).length > 0
          ? [...new Set(serviceTypeValues.filter(Boolean))]
          : SERVICE_TYPE_FALLBACK
      );
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
      toast({ title: "Error", description: "Failed to load dropdown data", variant: "destructive" });
    }
  };


  useEffect(() => {
    fetchInstallations();
    fetchDropdownData();
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

  const handleNewEnquiryCompanyChange = (value) => {
    setNewEnquiryData((prev) => {
      const updated = { ...prev, companyName: value };
      
      if (prev.clientType === "Existing" && masterData[0]) {
        const companyNames = masterData[0]["Company Name"] || [];
        const billingAddresses = masterData[0]["BILLING ADDRESS"] || [];
        const gstNos = masterData[0]["GST No."] || [];
        
        const index = companyNames.findIndex(
          (name) => name && name.toLowerCase() === value.toLowerCase()
        );
        
        if (index !== -1) {
          updated.gstAddress = billingAddresses[index] || "";
          updated.gstNo = gstNos[index] || "";
        }
      }
      return updated;
    });
  };

  const handleEnquiryClick = (item) => {
    const company = item["COMPANY NAME"] || "";
    const client = item["CONTACT PERSON NAME"] || "";
    const phone = item["CONTACT PERSON NO."] || "";

    // sss_service_installation carries no billing/site/GST columns of its
    // own — sourced entirely from the LTO company master, same as
    // handleSiteVisitEnquiry below.
    let gstAddress = "";
    let gstNo = "";
    let siteAddress = "";

    if ((!gstAddress || !gstNo) && masterData[0]) {
      const companyNames = masterData[0]["Company Name"] || [];
      const billingAddresses = masterData[0]["BILLING ADDRESS"] || [];
      const gstNos = masterData[0]["GST No."] || [];

      const index = companyNames.findIndex(
        (name) => name && name.toLowerCase() === company.toLowerCase()
      );

      if (index !== -1) {
        if (!gstAddress) gstAddress = billingAddresses[index] || "";
        if (!gstNo) gstNo = gstNos[index] || "";
      }
    }

    setNewEnquiryData({
      clientType: "Existing",
      sourceOfEnquiry: "",
      callType: "",
      enquiryReceiverName: "",
      companyName: company,
      clientName: client,
      phoneNumber: phone,
      gstAddress: gstAddress,
      siteAddress: siteAddress,
      gstNo: gstNo,
      machineName: "",
      category: "",
      mentionIssue: "",
      serviceLocation: "On-Site",
      challanCopy: "",
      machinePhoto: "",
      videoCall: "No",
      newCategory: "",
      videoCallTime: "",
      engineerAssign: ""
    });
    setNewFormSelectedMachines([]);
    setNewFormSelectedCategories([]);
    setShowEnquiryModal(true);
  };

  // Uploads to the same Supabase Storage bucket/convention used by
  // Ticket-and-Enquiry.jsx's uploadWarehouseFile — replaces the old
  // Apps Script + Google Drive upload.
  const uploadFileToStorage = async (file, folder, prefix) => {
    const path = `${folder}/${prefix}_${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("ticket_enquiry")
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("ticket_enquiry").getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadFileToDrive = async (file, field) => {
    setUploadingFiles(prev => ({ ...prev, [field]: true }));
    try {
      const fileUrl = await uploadFileToStorage(file, "warehouse", field);
      setNewEnquiryData(prev => ({ ...prev, [field]: fileUrl }));
      toast({
        title: "Upload Success",
        description: `${field === "challanCopy" ? "Challan Copy" : "Machine Photo"} uploaded successfully.`,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();

    if (!newEnquiryData.clientName) {
      alert("Error: Client Name is required");
      return;
    }
    if (!newEnquiryData.phoneNumber) {
      alert("Error: Phone Number is required");
      return;
    }
    if (newEnquiryData.clientType === "Existing" && !newEnquiryData.companyName) {
      alert("Error: Company Name is required for existing clients");
      return;
    }
    if (!newEnquiryData.mentionIssue || !newEnquiryData.mentionIssue.trim()) {
      alert("Error: Mention Issue is required");
      return;
    }

    setIsSubmitting(true);

    // Generate and assign an OTP only when Video-Call is "Yes" — same rule
    // as Ticket-and-Enquiry.jsx's own new-ticket submit.
    const generateSixDigitOTP = () => {
      let res = "";
      for (let i = 0; i < 6; i++) {
        res += Math.floor(Math.random() * 10).toString();
      }
      return res;
    };

    try {
      const userName = localStorage.getItem("currentUsername") || "";
      const submittedAt = new Date();
      const warrantyCheckPlanned = await computeStagePlanned("warrantyCheck", {
        ticketSubmittedAt: submittedAt,
      });

      // This creates a brand new root ticket in public.tickets — same table
      // and insert shape as Ticket-and-Enquiry.jsx's "New Enquiry" flow
      // (this modal is a trimmed-down copy of that page's form).
      const insertPayload = {
        source_of_enquiry: newEnquiryData.sourceOfEnquiry || "",
        call_type: newEnquiryData.callType || "",
        enquiry_receiver_name: newEnquiryData.enquiryReceiverName || "",
        client_type: newEnquiryData.clientType || "",
        company_name: newEnquiryData.companyName || "",
        client_name: newEnquiryData.clientName || "",
        phone_number: newEnquiryData.phoneNumber || "",
        gst_address: newEnquiryData.gstAddress || "",
        site_address: newEnquiryData.siteAddress || "",
        gst_no: newEnquiryData.gstNo || "",
        machine_name: newFormSelectedMachines.join(", "),
        category: newEnquiryData.category || "",
        mention_issue: newEnquiryData.mentionIssue || "",
        service_location: newEnquiryData.serviceLocation || "",
        challan_copy: newEnquiryData.serviceLocation?.trim() === "Warehouse" ? (newEnquiryData.challanCopy || "") : "",
        machine_photo: newEnquiryData.serviceLocation?.trim() === "Warehouse" ? (newEnquiryData.machinePhoto || "") : "",
        video_call: newEnquiryData.videoCall || "",
        sub_category: newFormSelectedCategories.join(", "),
        video_call_time: newEnquiryData.videoCallTime || "",
        engineer_assign: newEnquiryData.engineerAssign || "",
        otp: newEnquiryData.videoCall === "Yes" ? generateSixDigitOTP() : "",
        cre_name: userName,
        warranty_check_planned: warrantyCheckPlanned,
      };

      const { data: inserted, error } = await supabase
        .from("sss_tickets")
        .insert(insertPayload)
        .select("ticket_id")
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Enquiry created successfully with Ticket ID: ${inserted.ticket_id}`,
      });
      setShowEnquiryModal(false);
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


  const handleApproveClick = (item) => {
    setSelectedItem(item);
    setApprovalData({
      clientStatus: "",
      actualDate: formatDateTime(new Date()),
      serviceType: "",
      engineerName: "",
      remarks: "",
      followUpDate: "",
      customerSay: "",
      videoCallTime: "",
    });
    setFileData({ name: "", base64: "" });
    setShowApprovalDialog(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Error", description: "File size exceeds 10MB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setFileData({
          name: file.name,
          base64: reader.result.split(",")[1]
        });
        toast({ title: "File Selected", description: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  // Opens New Enquiry modal pre-filled for a Site Visit follow-up
  const handleSiteVisitEnquiry = () => {
    if (!selectedItem) return;
    const company = selectedItem["COMPANY NAME"] || "";

    // Check DROPDOWN sheet Company Name list (col-CK / "Company Name") to determine client type
    const companyList = masterData[0]?.["Company Name"] || [];
    const exists = companyList.some(
      (name) => name && name.toLowerCase().trim() === company.toLowerCase().trim()
    );
    const detectedClientType = exists ? "Existing" : "New";

    let gstAddress = "";
    let gstNo = "";
    let siteAddress = "";

    if (exists && masterData[0]) {
      const billingAddresses = masterData[0]["BILLING ADDRESS"] || [];
      const gstNos = masterData[0]["GST No."] || [];
      const idx = companyList.findIndex(
        (name) => name && name.toLowerCase().trim() === company.toLowerCase().trim()
      );
      if (idx !== -1) {
        gstAddress = billingAddresses[idx] || "";
        gstNo = gstNos[idx] || "";
      }
    }

    setNewEnquiryData({
      clientType: detectedClientType,
      sourceOfEnquiry: "",
      callType: "",
      enquiryReceiverName: "",
      companyName: company,
      clientName: selectedItem["CONTACT PERSON NAME"] || "",
      phoneNumber: selectedItem["CONTACT PERSON NO."] || "",
      gstAddress,
      siteAddress,
      gstNo,
      machineName: "",
      category: "",
      mentionIssue: "",
      serviceLocation: "On-Site",
      challanCopy: "",
      machinePhoto: "",
      videoCall: "No",
      newCategory: "",
      videoCallTime: "",
      engineerAssign: "",
    });
    setNewFormSelectedMachines([]);
    setNewFormSelectedCategories([]);
    setShowApprovalDialog(false);
    setShowEnquiryModal(true);
  };

  const handleApprovalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const svcClean = (approvalData.serviceType || "").trim().toLowerCase();
    const isSiteVisitFollowUp = approvalData.clientStatus === "Yes" && svcClean === "site visit";

    setIsSubmitting(true);
    try {
      let finalFileUrl = "";

      // Step 1: Upload the service report file (if any) to Supabase Storage —
      // same "ticket_enquiry" bucket the rest of the app uses.
      if (fileData.base64) {
        const mimeType = fileData.name.toLowerCase().endsWith(".pdf") ? "application/pdf" :
          fileData.name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "image/jpeg";
        const byteCharacters = atob(fileData.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const fileBlob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
        finalFileUrl = await uploadFileToStorage(fileBlob, "service_installation", "report");
      }

      // Step 2: Prepare the row update. `actual` is only stamped when the
      // job is genuinely done ("Yes") — "No" and "Next Date for Follow-Up"
      // update the row in place but leave it pending (see migration 0052).
      const updatePayload = {
        installation_follow_up: approvalData.clientStatus,
      };

      if (approvalData.clientStatus === "Yes") {
<<<<<<< HEAD
        const submittedAt = new Date();
        updatePayload.actual = submittedAt.toISOString();
=======
        updatePayload.actual = new Date().toISOString();
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
        updatePayload.service_type = approvalData.serviceType;
        updatePayload.engineer_name = approvalData.engineerName;
        if (finalFileUrl) updatePayload.service_report_file = finalFileUrl;
        updatePayload.what_did_customer_say = approvalData.remarks;
<<<<<<< HEAD
        // Readiness stamp for the Engineer-Dashboard's own "Service
        // Installation" stage (engg_dsb_service_installation, migration 0055).
        updatePayload.engg_dsb_service_installation_planned = await computeStagePlanned(
          "enggDsbServiceInstallation",
          { installationSubmittedAt: submittedAt }
        );
=======
>>>>>>> 2fb6fc02d3513c41c6187e88e88fa6fb9cdd9a7c
      } else if (approvalData.clientStatus === "No") {
        updatePayload.what_did_customer_say = approvalData.remarks;
      } else if (approvalData.clientStatus === "Next Date for Follow-Up") {
        updatePayload.next_date = approvalData.followUpDate || null;
        updatePayload.what_did_customer_say = approvalData.customerSay;
      }

      // Step 3: Update the row
      const { error } = await supabase
        .from("sss_service_installation")
        .update(updatePayload)
        .eq("id", selectedItem.id);

      if (error) throw error;

      toast({ title: "Success", description: "Installation updated successfully" });
      if (isSiteVisitFollowUp) {
        handleSiteVisitEnquiry();
      } else {
        setShowApprovalDialog(false);
      }
      fetchInstallations(); // Refresh data
    } catch (error) {
      console.error("Error updating installation:", error);
      toast({ title: "Error", description: error.message || "Failed to update record", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };



  const filteredData = installations.filter(item => {
    const matchesSearch = searchTerm === "" ||
      Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    if (selectedDateFilter !== "") {
      const itemDateNormalized = formatInputDate(item["Next Date"]);
      if (itemDateNormalized !== selectedDateFilter) return false;
    }

    if (activeTab === "pending") {
      return item._planned1 !== "" && item._actual1 === "";
    } else {
      return item._planned1 !== "" && item._actual1 !== "";
    }
  });

  const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("approved") || s.includes("complete")) return "bg-green-500/20 text-green-700 border border-green-500/30";
    if (s.includes("reject") || s.includes("cancel")) return "bg-red-500/20 text-red-700 border border-red-500/30";
    return "bg-yellow-500/20 text-yellow-700 border border-yellow-500/30";
  };

  const serviceTypeClean = (approvalData.serviceType || "").trim().toLowerCase();
  const isSiteVisit = serviceTypeClean === "site visit";
  const showEngineer = !isSiteVisit && (serviceTypeClean.includes("visit") || serviceTypeClean.includes("video"));
  const showServiceReport = !isSiteVisit && serviceTypeClean.includes("visit");

  return (
    <div className="space-y-6">
      <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-indigo-900">Service Installation</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-start sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
                <Input
                  placeholder="Search installations..."
                  className="pl-10 border-indigo-100 focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label className="text-xs font-bold text-indigo-600 whitespace-nowrap">Follow-Up Date:</Label>
                <Input
                  type="date"
                  className="border-indigo-100 focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm text-indigo-900 cursor-pointer h-10 w-full sm:w-44"
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                />
                {selectedDateFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDateFilter("")}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <TabsList className="bg-white border border-gray-200 p-1 shadow-sm">
            <TabsTrigger value="pending" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
              <Clock className="h-4 w-4 mr-2" />
              Pending
              <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                {installations.filter(i => i._planned1 !== "" && i._actual1 === "" && (selectedDateFilter === "" || formatInputDate(i["Next Date"]) === selectedDateFilter)).length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              History
              <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                {installations.filter(i => i._planned1 !== "" && i._actual1 !== "" && (selectedDateFilter === "" || formatInputDate(i["Next Date"]) === selectedDateFilter)).length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="mt-0">
          <InstallationTable data={filteredData} loading={fetchLoading} getStatusBadge={getStatusBadge} onApprove={handleApproveClick} onEnquiry={handleEnquiryClick} activeTab={activeTab} />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <InstallationTable data={filteredData} loading={fetchLoading} getStatusBadge={getStatusBadge} onApprove={handleApproveClick} onEnquiry={handleEnquiryClick} activeTab={activeTab} />
        </TabsContent>

      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[650px] p-0 bg-white border-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 rounded-t-lg shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-2xl font-bold">Follow Up Form</DialogTitle>
                <p className="text-indigo-100 text-sm mt-1 font-medium">Processing follow-up for SN: {selectedItem?.["SI NO"]}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
            <form id="followup-form" onSubmit={handleApprovalSubmit} className="space-y-6">
              {/* Info Card */}
              <Card className="bg-white border border-indigo-100 shadow-sm overflow-hidden">
                <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Order No.</p>
                    <p className="text-sm font-bold text-gray-900">{selectedItem?.["Order No."] || "N/A"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Company Name</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem?.["COMPANY NAME"] || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Invoice Date</p>
                    <p className="text-sm font-bold text-gray-900">{formatDateOnly(selectedItem?.["INVOICE DATE"])}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Invoice No</p>
                    <p className="text-sm font-bold text-gray-900 truncate" title={selectedItem?.["INVOICE NO"]}>{selectedItem?.["INVOICE NO"] || "N/A"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Machine Names</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem?.["Item-Name"] || "N/A"}</p>
                  </div>
                  {selectedItem?.["Next Date"] && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Last Follow-Up Date</p>
                      <p className="text-sm font-bold text-gray-900">{formatDateOnly(selectedItem["Next Date"])}</p>
                    </div>
                  )}
                  {(selectedItem?.["What Did Customer's Say (Remarks)"] || selectedItem?.["What Did Customer's Say"]) && (
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Last Follow-Up Remarks</p>
                      <p className="text-sm font-bold text-gray-900 leading-tight">
                        {selectedItem["What Did Customer's Say (Remarks)"] || selectedItem["What Did Customer's Say"]}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dynamic Section */}
              <div className="space-y-4 bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
                <div className="space-y-2">
                  <Label className="text-indigo-900 font-bold flex items-center gap-2">
                    Installation Follow-Up <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={approvalData.clientStatus}
                    onValueChange={(val) => setApprovalData({ ...approvalData, clientStatus: val })}
                  >
                    <SelectTrigger className="w-full border-indigo-200 focus:ring-indigo-500 h-11">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-indigo-100">
                      <SelectItem value="Yes" className="focus:bg-indigo-50">Yes</SelectItem>
                      <SelectItem value="No" className="focus:bg-indigo-50">No</SelectItem>
                      <SelectItem value="Next Date for Follow-Up" className="focus:bg-indigo-50">Next Date for Follow-Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {approvalData.clientStatus === "Yes" && (
                  <div className="space-y-5 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-px flex-1 bg-gray-100"></div>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest px-2">Service Details</span>
                      <div className="h-px flex-1 bg-gray-100"></div>
                    </div>

                    <div className={
                      approvalData.serviceType && ["video-call", "video call"].includes(approvalData.serviceType.trim().toLowerCase())
                        ? "grid grid-cols-1 md:grid-cols-3 gap-4"
                        : showEngineer
                        ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                        : "space-y-2"
                    }>
                      <div className="space-y-2">
                        <Label className="text-gray-700 font-semibold">Service Type *</Label>
                        <Select
                          value={approvalData.serviceType}
                          onValueChange={(val) => setApprovalData({ ...approvalData, serviceType: val })}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select Service Type" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-60 overflow-y-auto">
                            {serviceTypes.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {showEngineer && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                          <Label className="text-gray-700 font-semibold">Engineer Name *</Label>
                          <Select
                            value={approvalData.engineerName}
                            onValueChange={(val) => setApprovalData({ ...approvalData, engineerName: val })}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select Engineer" />
                            </SelectTrigger>
                            <SelectContent className="bg-white max-h-60 overflow-y-auto">
                              {employeeNames.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {approvalData.serviceType && ["video-call", "video call"].includes(approvalData.serviceType.trim().toLowerCase()) && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                          <Label className="text-gray-700 font-semibold">Video-Call Time *</Label>
                          <Input
                            type="time"
                            className="h-10"
                            value={approvalData.videoCallTime}
                            onChange={(e) => setApprovalData({ ...approvalData, videoCallTime: e.target.value })}
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Site Visit: show only company info + redirect notice, hide engineer/file/remarks */}
                    {isSiteVisit ? (
                      <div className="animate-in fade-in duration-300 rounded-lg border border-indigo-200 bg-indigo-50 p-4 flex items-start gap-3">
                        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                          <ExternalLink className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-indigo-800">
                            Redirecting to New Enquiry
                          </p>
                          <p className="text-xs text-indigo-600 mt-0.5">
                            Company: <span className="font-bold">{selectedItem?.["COMPANY NAME"] || "—"}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Clicking <strong>Save</strong> will open the New Enquiry form pre-filled with this company's details. Client type will be auto-detected (New / Existing) based on the DROPDOWN sheet.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {showServiceReport && (
                          <div className="space-y-2 animate-in fade-in duration-300">
                            <Label className="text-gray-700 font-semibold">Service Report (Image/Video/PDF) *</Label>
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={handleFileChange}
                              accept=".jpg,.jpeg,.png,.pdf,.mp4"
                            />
                            <div
                              onClick={() => fileInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all cursor-pointer group ${fileData.name ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:bg-indigo-50/50 hover:border-indigo-300'}`}
                            >
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform ${fileData.name ? 'bg-indigo-600' : 'bg-indigo-100'}`}>
                                {fileData.name ? <CheckCircle2 className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-indigo-600" />}
                              </div>
                              <p className="text-sm font-medium text-indigo-600">
                                {fileData.name ? fileData.name : "Upload a file"} <span className="text-gray-400 font-normal">or drag and drop</span>
                              </p>
                              <p className="text-xs text-gray-400 mt-1">Images, Videos, PDFs up to 10MB</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-gray-700 font-semibold">Remarks *</Label>
                          <textarea
                            className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-inner"
                            placeholder="Enter service remarks..."
                            value={approvalData.remarks}
                            onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {approvalData.clientStatus === "No" && (
                  <div className="space-y-2 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <Label className="text-gray-700 font-semibold">Remarks *</Label>
                    <textarea
                      className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-inner"
                      placeholder="Why not?"
                      value={approvalData.remarks}
                      onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                    />
                  </div>
                )}

                {approvalData.clientStatus === "Next Date for Follow-Up" && (
                  <div className="space-y-5 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-semibold">Next Date for Follow-Up *</Label>
                      <Input
                        type="date"
                        className="h-10"
                        value={approvalData.followUpDate}
                        onChange={(e) => setApprovalData({ ...approvalData, followUpDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-semibold">What did Customer Said *</Label>
                      <textarea
                        className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-inner"
                        placeholder="Enter what the customer said..."
                        value={approvalData.customerSay}
                        onChange={(e) => setApprovalData({ ...approvalData, customerSay: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          <DialogFooter className="p-6 bg-gray-50 border-t shrink-0">
            <div className="flex gap-3 justify-end w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowApprovalDialog(false)}
                disabled={isSubmitting}
                className="px-6 h-10 border-gray-300 text-gray-700 font-medium hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                form="followup-form"
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-10 font-bold shadow-lg shadow-indigo-200 transition-all transform active:scale-95"
                disabled={isSubmitting}
              >
                {isSubmitting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Modal
        isOpen={showEnquiryModal}
        onClose={() => setShowEnquiryModal(false)}
        title={
          <div className="flex items-center space-x-2 font-sans">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            <span>New Enquiry</span>
          </div>
        }
        size="4xl"
        className="rounded-lg max-h-[90vh] overflow-y-auto font-sans"
      >
        <form
          onSubmit={handleEnquirySubmit}
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
                      gstAddress: value === "New" ? "" : prev.gstAddress,
                      gstNo: value === "New" ? "" : prev.gstNo
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
                      {(masterData[0]?.["Company Name"] || [])
                        .filter((name, index, self) => name && self.indexOf(name) === index)
                        .map((name, index) => (
                          <option key={index} value={name} />
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

              <div className="space-y-1">
                <Label className="text-sm">Billing Address</Label>
                <Input
                  value={newEnquiryData.gstAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstAddress: e.target.value }))}
                  placeholder="Enter Billing Address"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">GST No.</Label>
                <Input
                  value={newEnquiryData.gstNo || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstNo: e.target.value }))}
                  placeholder="Enter GST No."
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
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gray-50 px-4 py-3">
              <CardTitle className="text-sm font-medium flex items-center bg-transparent border-0 shadow-none text-gray-800">
                Enquiry Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="relative">
                  <Input
                    value={newEnquiryData.sourceOfEnquiry || ""}
                    onChange={(e) => setNewEnquiryData(prev => ({ ...prev, sourceOfEnquiry: e.target.value }))}
                    placeholder="Search or enter source of enquiry"
                    list="new-source-suggestions"
                  />
                  <datalist id="new-source-suggestions">
                    {(masterData[0]?.["Source of enquiry"] || [])
                      .filter((name, index, self) => name && self.indexOf(name) === index)
                      .map((name, index) => (
                        <option key={index} value={name} />
                      ))}
                  </datalist>
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm">Enquiry Receiver Name *</Label>
                  <div className="relative">
                    <Input
                      value={newEnquiryData.enquiryReceiverName || ""}
                      onChange={(e) => setNewEnquiryData(prev => ({ ...prev, enquiryReceiverName: e.target.value }))}
                      placeholder="Search or enter receiver name"
                      list="new-receiver-suggestions"
                    />
                    <datalist id="new-receiver-suggestions">
                      {(masterData[0]?.["Enquiry Receiver Name"] || [])
                        .filter((name, index, self) => name && self.indexOf(name) === index)
                        .map((name, index) => (
                          <option key={index} value={name} />
                        ))}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm">Enquiry-Type *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, category: value }))}
                    value={newEnquiryData.category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Enquiry-Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      {[...new Set(masterData[0]?.["Requirement Service Category"] || [])]
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
                  <Label className="text-sm">Category *</Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryDropdown(!showCategoryDropdown);
                        setShowMachineDropdown(false);
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="text-gray-500">
                        {newFormSelectedCategories.length > 0
                          ? `${newFormSelectedCategories.length} selected`
                          : "Select category(ies)"}
                      </span>
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
                            placeholder="Search category..."
                            value={categorySearchQuery}
                            onChange={(e) => setCategorySearchQuery(e.target.value)}
                            className="h-8 text-xs border-gray-200"
                          />
                        </div>
                        <div className="mt-1">
                          {[...new Set(masterData[0]?.["Category"] || [])]
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
                          {[...new Set(masterData[0]?.["Category"] || [])]
                            .filter(Boolean)
                            .filter(option =>
                              option.toLowerCase().includes(categorySearchQuery.toLowerCase())
                            ).length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-2">No category found</p>
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
                          className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded flex items-center"
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => {
                              setNewFormSelectedCategories(prev => prev.filter(c => c !== cat));
                            }}
                            className="ml-1 text-indigo-600 hover:text-indigo-800 font-bold"
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
                  <Label className="text-sm">Video-Call</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, videoCall: value }))}
                    value={newEnquiryData.videoCall || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Yes/No" />
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
                      <Label className="text-sm">Video-Call Time *</Label>
                      <Input
                        type="time"
                        value={newEnquiryData.videoCallTime || ""}
                        onChange={(e) => setNewEnquiryData(prev => ({ ...prev, videoCallTime: e.target.value }))}
                        required
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
                  <h4 className="text-sm font-semibold text-indigo-800 border-b border-blue-100 pb-2">
                    Warehouse Service Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm">Challan Copy</Label>
                      {newEnquiryData.challanCopy ? (
                        <div className="flex items-center justify-between border border-emerald-200 rounded-md p-2 bg-emerald-50 text-emerald-800 text-sm">
                          <a href={newEnquiryData.challanCopy} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[200px]">
                            View Challan Copy
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setNewEnquiryData(prev => ({ ...prev, challanCopy: "" }))}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            type="file"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                uploadFileToDrive(e.target.files[0], "challanCopy");
                              }
                            }}
                            disabled={uploadingFiles.challanCopy}
                          />
                          {uploadingFiles.challanCopy && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-indigo-600 text-xs">
                              <Loader2Icon className="animate-spin w-4 h-4 mr-1" />
                              Uploading...
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Machine Photo</Label>
                      {newEnquiryData.machinePhoto ? (
                        <div className="flex items-center justify-between border border-emerald-200 rounded-md p-2 bg-emerald-50 text-emerald-800 text-sm">
                          <a href={newEnquiryData.machinePhoto} target="_blank" rel="noopener noreferrer" className="font-semibold underline truncate max-w-[200px]">
                            View Machine Photo
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setNewEnquiryData(prev => ({ ...prev, machinePhoto: "" }))}
                            className="text-red-500 hover:text-red-700 h-8 px-2 py-1 text-xs font-semibold hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            type="file"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                uploadFileToDrive(e.target.files[0], "machinePhoto");
                              }
                            }}
                            disabled={uploadingFiles.machinePhoto}
                          />
                          {uploadingFiles.machinePhoto && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-indigo-600 text-xs">
                              <Loader2Icon className="animate-spin w-4 h-4 mr-1" />
                              Uploading...
                            </div>
                          )}
                        </div>
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
                    className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-gray-500">
                      {newFormSelectedMachines.length > 0
                        ? `${newFormSelectedMachines.length} selected`
                        : "Select machine(s)"}
                    </span>
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
                        className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded flex items-center"
                      >
                        {machine}
                        <button
                          type="button"
                          onClick={() => {
                            setNewFormSelectedMachines(prev => prev.filter(m => m !== machine));
                          }}
                          className="ml-1 text-indigo-600 hover:text-indigo-800 font-bold"
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
              onClick={() => setShowEnquiryModal(false)}
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
              Create Enquiry
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};


const InstallationTable = ({ data, loading, getStatusBadge, onApprove, onEnquiry, activeTab }) => {
  if (loading) {
    return (
      <Card className="border border-gray-100 shadow-xl p-12 flex flex-col items-center justify-center">
        <LoaderIcon className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="mt-4 text-gray-500 font-medium">Fetching data...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile View (Cards) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {data.length > 0 ? (
          data.map((item, idx) => (
            <Card key={idx} className="border border-gray-100 shadow-md overflow-hidden bg-white">
              <div className="bg-gradient-to-r from-indigo-800 to-blue-800 p-3 flex justify-between items-center">
                <span className="font-bold text-white text-sm">{item["SI NO"]}</span>

              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Order & Company</p>
                    <p className="text-sm font-bold text-gray-900">{item["Order No."]}</p>
                    <p className="text-sm text-gray-600">{item["COMPANY NAME"]}</p>
                  </div>
                  {activeTab === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApprove(item)}
                      className="text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all shadow-sm h-8"
                    >
                      Approve
                    </Button>
                  )}
                  {activeTab === "history" && ((item["Service-Type"] || item["Installation/Service"] || "").trim().toLowerCase() === "site visit") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEnquiry(item)}
                      className="text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all shadow-sm h-8"
                    >
                      Enquiry
                    </Button>
                  )}
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Invoice No</p>
                    <p className="text-sm text-gray-700">{item["INVOICE NO"] || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Invoice Date</p>
                    <p className="text-sm text-gray-700">{item["INVOICE DATE"] || "N/A"}</p>
                  </div>
                  {item["Invoice Copy"] && item["Invoice Copy"].toString().startsWith("http") && (
                    <div className="space-y-1 col-span-2">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Invoice Copy</p>
                      <a
                        href={item["Invoice Copy"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors font-semibold text-xs border border-indigo-200 mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Invoice
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Material Rcvd</p>
                  <p className="text-sm text-gray-700">{item["Actual material rcvd"] || "0"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Item Details</p>
                  <p className="text-sm text-gray-700 leading-tight">{item["Item-Name"]}</p>
                </div>

                <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs">
                  <div className="flex items-center text-gray-500">
                    <Calendar className="h-3 w-3 mr-1 text-indigo-400" />
                    Planned: {item["Planned 1"]}
                  </div>
                  {activeTab === "history" && item["Actual 1"] && (
                    <div className="flex items-center text-green-600 font-medium">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Actual: {item["Actual 1"]}
                    </div>
                  )}
                </div>

                {activeTab === "pending" && (
                  <div className="pt-2 mt-2 border-t border-gray-50 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Last Follow-Up Date</p>
                        <p className="text-gray-700 font-medium">{formatDateOnly(item["Next Date"])}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Remarks</p>
                        <p className="text-gray-700 font-medium truncate" title={item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"] || ""}>
                          {item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"] || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "history" && (
                  <div className="pt-2 mt-2 border-t border-gray-50 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Client Status</p>
                        <p className="text-gray-700 font-medium">{item["Client Status"] || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Service Type</p>
                        <p className="text-gray-700 font-medium">{item["Service-Type"] || item["Installation/Service"] || "N/A"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Engineer</p>
                        <p className="text-gray-700 font-medium">{item["Engineer Name"] || "N/A"}</p>
                      </div>
                      {item["Next Date"] && (
                        <div>
                          <p className="text-gray-400 font-semibold uppercase tracking-wider">Next Follow-up</p>
                          <p className="text-gray-700 font-medium">{formatDateOnly(item["Next Date"])}</p>
                        </div>
                      )}
                    </div>
                    {(item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"]) && (
                      <div className="text-xs">
                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Remarks</p>
                        <p className="text-gray-700 font-medium line-clamp-2">
                          {item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"]}
                        </p>
                      </div>
                    )}
                    {item["Service Report"] && item["Service Report"].toString().startsWith("http") && (
                      <div className="text-xs pt-1">
                        <p className="text-gray-400 font-semibold uppercase tracking-wider">Service Report File</p>
                        <a
                          href={item["Service Report"]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors font-semibold text-xs border border-indigo-200 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Service File
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center text-gray-500 font-medium">
            No records found.
          </Card>
        )}
      </div>

      {/* Desktop View (Table) */}
      <Card className="hidden md:block border border-gray-100 shadow-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-800 to-blue-800">
                {activeTab === "pending" && <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Action</th>}
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">SI NO</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Order No</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Company Name</th>

                {activeTab === "pending" ? (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Item Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Invoice Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Invoice No</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Invoice Copy</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Next Follow-Up Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Remarks</th>
                    {/* <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Material Rcvd</th> */}
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Client Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Service Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Engineer Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Service Report File</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Next Follow-Up Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Remarks</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Invoice Copy</th>
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length > 0 ? (
                data.map((item, idx) => (
                  <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                    {activeTab === "pending" && (
                      <td className="px-6 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onApprove(item)}
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        >
                          Approve
                        </Button>
                      </td>
                    )}
                    <td className="px-6 py-4 font-bold text-indigo-700 whitespace-nowrap">{item["SI NO"]}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">{item["Order No."]}</td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{item["COMPANY NAME"]}</td>

                    {activeTab === "pending" ? (
                      <>
                        <td className="px-6 py-4 text-gray-600 min-w-[200px]">{item["Item-Name"]}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDateOnly(item["INVOICE DATE"])}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{item["INVOICE NO"]}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {item["Invoice Copy"] && item["Invoice Copy"].toString().startsWith("http") ? (
                            <a
                              href={item["Invoice Copy"]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors font-semibold text-xs border border-indigo-200"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Invoice
                            </a>
                          ) : (
                            item["Invoice Copy"] || "-"
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDateOnly(item["Next Date"])}</td>
                        <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]" title={item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"] || ""}>
                          {item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"] || "-"}
                        </td>
                        {/* <td className="px-6 py-4 text-gray-600 text-center">{item["Actual material rcvd"]}</td> */}
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{item["Client Status"] || "-"}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{item["Service-Type"] || item["Installation/Service"] || "-"}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{item["Engineer Name"] || "-"}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {item["Service Report"] && item["Service Report"].toString().startsWith("http") ? (
                            <a
                              href={item["Service Report"]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors font-semibold text-xs border border-indigo-200"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View File
                            </a>
                          ) : (
                            item["Service Report"] || "-"
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDateOnly(item["Next Date"])}</td>
                        <td className="px-6 py-4 text-gray-600 truncate max-w-[200px]" title={item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"] || ""}>
                          {item["What Did Customer's Say (Remarks)"] || item["What Did Customer's Say"] || "-"}
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {item["Invoice Copy"] && item["Invoice Copy"].toString().startsWith("http") ? (
                            <a
                              href={item["Invoice Copy"]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors font-semibold text-xs border border-indigo-200"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Invoice
                            </a>
                          ) : (
                            item["Invoice Copy"] || "-"
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {((item["Service-Type"] || item["Installation/Service"] || "").trim().toLowerCase() === "site visit") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEnquiry(item)}
                              className="text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            >
                              Enquiry
                            </Button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No records matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ServiceInstallation;
