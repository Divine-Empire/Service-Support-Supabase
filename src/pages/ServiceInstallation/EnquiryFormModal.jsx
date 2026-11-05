import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Modal } from "../../components/ui/modal";
import { Textarea } from "../../components/ui/textarea";
import { Loader2Icon, ClipboardList } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";
import {
  sendServiceRequestRegisteredNotification,
  sendVideoCallScheduledNotifications,
} from "../../lib/notifications/whatsapp";
import { formatDate, formatTime12hr } from "../../lib/format";
import { uploadFileToStorage } from "./uploadFileToStorage";

const lc = (s) => String(s || "").toLowerCase().trim();

// Billing address / GST number of `company` from the client master arrays ("" when not found yet).
const companyInfo = (masterData, company) => {
  const names = masterData[0]?.["Company Name"] || [];
  const idx = names.findIndex((n) => n && lc(n) === lc(company));
  if (idx === -1) return null;
  return {
    gstAddress: masterData[0]["BILLING ADDRESS"]?.[idx] || "",
    gstNo: masterData[0]["GST No."]?.[idx] || "",
  };
};

const buildInitial = (item, mode, masterData) => {
  const company = item["COMPANY NAME"] || "";
  const info = companyInfo(masterData, company);
  return {
    // Follow-up Site Visit: existing client when the company is in the master, else new.
    clientType: mode === "siteVisit" ? (info ? "Existing" : "New") : "Existing",
    sourceOfEnquiry: "",
    callType: "",
    enquiryReceiverName: "",
    companyName: company,
    clientName: item["CONTACT PERSON NAME"] || "",
    phoneNumber: item["CONTACT PERSON NO."] || "",
    gstAddress: info?.gstAddress || "",
    siteAddress: "",
    gstNo: info?.gstNo || "",
    machineName: "",
    category: "",
    enquiryType: "",
    mentionIssue: "",
    serviceLocation: "On-Site",
    challanCopy: "",
    machinePhoto: "",
    videoCall: "No",
    newCategory: "",
    videoCallTime: "",
    engineerAssign: "",
  };
};

// New Enquiry (new ticket) form pre-filled from an installation row. mode: "history" (Enquiry button
// on a finished site-visit row) or "siteVisit" (follow-up just submitted as a Site Visit).
// Render it only while open; onClose closes it.
export default function EnquiryFormModal({ item, mode, masterData, onClose }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEnquiryData, setNewEnquiryData] = useState(() => buildInitial(item, mode, masterData));
  const [newFormSelectedMachines, setNewFormSelectedMachines] = useState([]);
  const [newFormSelectedCategories, setNewFormSelectedCategories] = useState([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [machineSearchQuery, setMachineSearchQuery] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState({
    challanCopy: false,
    machinePhoto: false,
  });

  // The client master loads on demand: when it arrives after the form opened, fill in what the
  // initial values could not know (client type for a follow-up, billing address, GST number).
  const filledRef = useRef(false);
  const companiesReady = (masterData[0]?.["Company Name"] || []).length > 0;
  useEffect(() => {
    if (!companiesReady || filledRef.current) return;
    filledRef.current = true;
    const info = companyInfo(masterData, item["COMPANY NAME"] || "");
    if (!info) return;
    setNewEnquiryData((prev) => ({
      ...prev,
      clientType: mode === "siteVisit" && prev.clientType === "New" ? "Existing" : prev.clientType,
      gstAddress: prev.gstAddress || info.gstAddress,
      gstNo: prev.gstNo || info.gstNo,
    }));
  }, [companiesReady]); // eslint-disable-line react-hooks/exhaustive-deps

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
      toast({ title: "Validation Error", description: "Client Name is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.phoneNumber) {
      toast({ title: "Validation Error", description: "Phone Number is required", variant: "destructive" });
      return;
    }
    if (newEnquiryData.clientType === "Existing" && !newEnquiryData.companyName) {
      toast({ title: "Validation Error", description: "Company Name is required for existing clients", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.enquiryType) {
      toast({ title: "Validation Error", description: "Enquiry Type is required", variant: "destructive" });
      return;
    }
    if (!newEnquiryData.mentionIssue || !newEnquiryData.mentionIssue.trim()) {
      toast({ title: "Validation Error", description: "Mention Issue is required", variant: "destructive" });
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
      const videoCallOtp = newEnquiryData.videoCall === "Yes" ? generateSixDigitOTP() : "";
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
        enquiry_type: newEnquiryData.enquiryType || "",
        service_location: newEnquiryData.serviceLocation || "",
        challan_copy: newEnquiryData.serviceLocation?.trim() === "Warehouse" ? (newEnquiryData.challanCopy || "") : "",
        machine_photo: newEnquiryData.serviceLocation?.trim() === "Warehouse" ? (newEnquiryData.machinePhoto || "") : "",
        video_call: newEnquiryData.videoCall || "",
        sub_category: newFormSelectedCategories.join(", "),
        video_call_time: newEnquiryData.videoCallTime || "",
        engineer_assign: newEnquiryData.engineerAssign || "",
        otp: videoCallOtp,
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
      onClose();

      // Fire-and-forget: a WhatsApp failure must not undo the saved ticket. With Video-Call = "Yes"
      // the video-call notification sends the "registered" message too, in order.
      const subCategory = newFormSelectedCategories.join(", ");
      const companyLabel = newEnquiryData.companyName || newEnquiryData.clientName;
      if (newEnquiryData.videoCall !== "Yes") {
        sendServiceRequestRegisteredNotification({
          phoneNumber: newEnquiryData.phoneNumber,
          clientName: newEnquiryData.clientName,
          companyName: companyLabel,
          ticketId: inserted.ticket_id,
          category: subCategory,
          issue: newEnquiryData.mentionIssue,
        }).then(({ success, error: waError }) => {
          if (!success) {
            toast({
              title: "WhatsApp notification not sent",
              description: waError || "Ticket was created, but the WhatsApp message could not be sent.",
              variant: "destructive",
            });
          }
        });
      } else {
        sendVideoCallScheduledNotifications({
          clientPhoneNumber: newEnquiryData.phoneNumber,
          clientName: newEnquiryData.clientName,
          companyName: companyLabel,
          category: subCategory,
          ticketId: inserted.ticket_id,
          issue: newEnquiryData.mentionIssue,
          engineerName: newEnquiryData.engineerAssign,
          dateStr: formatDate(submittedAt),
          timeStr: formatTime12hr(newEnquiryData.videoCallTime),
          otp: videoCallOtp,
        }).then(({ success, error: waError, engineerNotified, engineerError }) => {
          if (!success) {
            toast({
              title: "Video-call WhatsApp notification not sent",
              description: waError || "Ticket was created, but the client could not be notified over WhatsApp.",
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

  return (
      <Modal
        isOpen
        onClose={onClose}
        title={
          <div className="flex items-center space-x-2 font-sans">
            <ClipboardList className="w-5 h-5 text-brand-600" />
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
                <Label htmlFor="enq-clientType" className="text-sm">Client Type *</Label>
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
                  <SelectTrigger id="enq-clientType">
                    <SelectValue placeholder="Select Client Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Existing">Existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="enq-company" className="text-sm">Company Name *</Label>
                {newEnquiryData.clientType === "Existing" ? (
                  <div className="relative">
                    <Input id="enq-company"
                      value={newEnquiryData.companyName || ""}
                      onChange={(e) => handleNewEnquiryCompanyChange(e.target.value)}
                      placeholder="Type to search or select company name"
                      list="new-company-suggestions"
                    />
                    <datalist id="new-company-suggestions">
                      {[...new Set(masterData[0]?.["Company Name"] || [])]
                        .filter((name, index, self) => name && self.indexOf(name) === index)
                        .map((name, index) => (
                          <option key={index} value={name} />
                        ))}
                    </datalist>
                  </div>
                ) : (
                  <Input id="enq-company"
                    value={newEnquiryData.companyName || ""}
                    onChange={(e) => setNewEnquiryData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Enter company name"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="enq-clientName" className="text-sm">Client Name *</Label>
                <Input id="enq-clientName"
                  value={newEnquiryData.clientName || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Enter client name"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="enq-phone" className="text-sm">Phone Number *</Label>
                <Input id="enq-phone"
                  value={newEnquiryData.phoneNumber || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="enq-billing" className="text-sm">Billing Address</Label>
                <Input id="enq-billing"
                  value={newEnquiryData.gstAddress || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstAddress: e.target.value }))}
                  placeholder="Enter Billing Address"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="enq-gst" className="text-sm">GST No.</Label>
                <Input id="enq-gst"
                  value={newEnquiryData.gstNo || ""}
                  onChange={(e) => setNewEnquiryData(prev => ({ ...prev, gstNo: e.target.value }))}
                  placeholder="Enter GST No."
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="enq-site" className="text-sm">Site Address</Label>
                <Input id="enq-site"
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
                <Label htmlFor="enq-callType" className="text-sm">Call Type *</Label>
                <Select
                  onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, callType: value }))}
                  value={newEnquiryData.callType}
                >
                  <SelectTrigger id="enq-callType">
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
                <Label htmlFor="enq-source" className="text-sm">Source of Enquiry *</Label>
                <div className="relative">
                  <Input id="enq-source"
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
                  <Label htmlFor="enq-receiver" className="text-sm">Enquiry Receiver Name *</Label>
                  <div className="relative">
                    <Input id="enq-receiver"
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
                  <Label htmlFor="enq-enquiryType" className="text-sm">Category *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, category: value }))}
                    value={newEnquiryData.category}
                  >
                    <SelectTrigger id="enq-enquiryType">
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

                <div className="space-y-1">
                  <Label htmlFor="enq-enquiryTypeNew" className="text-sm">Enquiry Type *</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, enquiryType: value }))}
                    value={newEnquiryData.enquiryType}
                  >
                    <SelectTrigger id="enq-enquiryTypeNew">
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

                <div className="space-y-1 relative dropdown-container">
                  <Label htmlFor="enq-category" className="text-sm">Sub-Category *</Label>
                  <div className="relative">
                    <button id="enq-category"
                      type="button"
                      onClick={() => {
                        setShowCategoryDropdown(!showCategoryDropdown);
                        setShowMachineDropdown(false);
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="bg-brand-50 border border-brand-100 text-brand-800 text-xs px-2 py-1 rounded flex items-center"
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
                  <Label htmlFor="enq-videoCall" className="text-sm">Video-Call</Label>
                  <Select
                    onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, videoCall: value }))}
                    value={newEnquiryData.videoCall || ""}
                  >
                    <SelectTrigger id="enq-videoCall">
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
                      <Label htmlFor="enq-videoTime" className="text-sm">Video-Call Time *</Label>
                      <Input id="enq-videoTime"
                        type="time"
                        value={newEnquiryData.videoCallTime || ""}
                        onChange={(e) => setNewEnquiryData(prev => ({ ...prev, videoCallTime: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <Label htmlFor="enq-engineer" className="text-sm">Engineer-Assigned *</Label>
                      <Select
                        onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, engineerAssign: value }))}
                        value={newEnquiryData.engineerAssign || ""}
                      >
                        <SelectTrigger id="enq-engineer">
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
                <Label htmlFor="enq-location" className="text-sm">Service Location *</Label>
                <Select
                  onValueChange={(value) => setNewEnquiryData(prev => ({ ...prev, serviceLocation: value }))}
                  value={newEnquiryData.serviceLocation}
                >
                  <SelectTrigger id="enq-location">
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
                    <div className="space-y-1">
                      <Label htmlFor="enq-challan" className="text-sm">Challan Copy</Label>
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
                          <Input id="enq-challan"
                            type="file"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                uploadFileToDrive(e.target.files[0], "challanCopy");
                              }
                            }}
                            disabled={uploadingFiles.challanCopy}
                          />
                          {uploadingFiles.challanCopy && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-brand-600 text-xs">
                              <Loader2Icon className="animate-spin w-4 h-4 mr-1" />
                              Uploading...
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="enq-photo" className="text-sm">Machine Photo</Label>
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
                          <Input id="enq-photo"
                            type="file"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                uploadFileToDrive(e.target.files[0], "machinePhoto");
                              }
                            }}
                            disabled={uploadingFiles.machinePhoto}
                          />
                          {uploadingFiles.machinePhoto && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-brand-600 text-xs">
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
                <Label htmlFor="enq-machine" className="text-sm">Machine Name *</Label>
                <div className="relative dropdown-container">
                  <button id="enq-machine"
                    type="button"
                    onClick={() => {
                      setShowMachineDropdown(!showMachineDropdown);
                      setShowCategoryDropdown(false);
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="bg-brand-50 border border-brand-100 text-brand-800 text-xs px-2 py-1 rounded flex items-center"
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
                <Label htmlFor="enq-issue" className="text-sm">Mention Issue *</Label>
                <Textarea id="enq-issue"
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
              variant="outline"
              onClick={onClose}
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
              Create Enquiry
            </Button>
          </div>
        </form>
      </Modal>
  );
}
