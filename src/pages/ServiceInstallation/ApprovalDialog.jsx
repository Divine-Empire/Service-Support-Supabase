import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
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
import { Card, CardContent } from "../../components/ui/card";
import { LoaderIcon, Plus, CheckCircle2, ExternalLink } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { computeStagePlanned } from "../../lib/supabase/stagePlanning";
import { formatDateTime, formatDateOnly } from "./columns";
import { uploadFileToStorage } from "./uploadFileToStorage";

// "Follow Up Form" for one pending installation. Render it only while an item is selected.
// onClose closes it; onSaved reloads the page's list; onSiteVisitEnquiry(item) opens the New Enquiry
// form (used when the follow-up was a Site Visit).
export default function ApprovalDialog({ item, serviceTypes, employeeNames, onClose, onSaved, onSiteVisitEnquiry }) {
  const selectedItem = item;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalData, setApprovalData] = useState(() => ({
    clientStatus: "",
    actualDate: formatDateTime(new Date()),
    serviceType: "",
    engineerName: "",
    remarks: "",
    followUpDate: "",
    customerSay: "",
    videoCallTime: "",
  }));
  const [fileData, setFileData] = useState({ name: "", base64: "" });
  const fileInputRef = useRef(null);

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
        const ext = fileData.name.toLowerCase().split(".").pop();
        const mimeType =
          { pdf: "application/pdf", mp4: "video/mp4", mov: "video/quicktime", png: "image/png", webp: "image/webp", gif: "image/gif", jpg: "image/jpeg", jpeg: "image/jpeg" }[ext] ||
          "application/octet-stream";
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
        const submittedAt = new Date();
        updatePayload.actual = submittedAt.toISOString();
        updatePayload.service_type = approvalData.serviceType;
        updatePayload.engineer_name = approvalData.engineerName;
        if (finalFileUrl) updatePayload.service_report_file = finalFileUrl;
        updatePayload.what_did_customer_say = approvalData.remarks;
        // Readiness stamp for the Engineer-Dashboard's own "Service
        // Installation" stage (engg_dsb_service_installation, migration 0055).
        updatePayload.engg_dsb_service_installation_planned = await computeStagePlanned(
          "enggDsbServiceInstallation",
          { installationSubmittedAt: submittedAt }
        );
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
        onSiteVisitEnquiry(selectedItem);
      } else {
        onClose();
      }
      onSaved(); // Refresh data
    } catch (error) {
      console.error("Error updating installation:", error);
      toast({ title: "Error", description: error.message || "Failed to update record", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const serviceTypeClean = (approvalData.serviceType || "").trim().toLowerCase();
  const isSiteVisit = serviceTypeClean === "site visit";
  const showEngineer = !isSiteVisit && (serviceTypeClean.includes("visit") || serviceTypeClean.includes("video"));
  const showServiceReport = !isSiteVisit && serviceTypeClean.includes("visit");

  return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-[650px] p-0 bg-white border-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="bg-primary text-primary-foreground p-6 rounded-t-lg shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-2xl font-bold">Follow Up Form</DialogTitle>
                <p className="text-primary-foreground/80 text-sm mt-1 font-medium">Processing follow-up for SN: {selectedItem?.["SI NO"]}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
            <form id="followup-form" onSubmit={handleApprovalSubmit} className="space-y-6">
              {/* Info Card */}
              <Card className="bg-white border border-brand-100 shadow-sm overflow-hidden">
                <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Order No.</p>
                    <p className="text-sm font-bold text-gray-900">{selectedItem?.["Order No."] || "N/A"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Company Name</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem?.["COMPANY NAME"] || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Invoice Date</p>
                    <p className="text-sm font-bold text-gray-900">{formatDateOnly(selectedItem?.["INVOICE DATE"])}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Invoice No</p>
                    <p className="text-sm font-bold text-gray-900 truncate" title={selectedItem?.["INVOICE NO"]}>{selectedItem?.["INVOICE NO"] || "N/A"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Machine Names</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem?.["Item-Name"] || "N/A"}</p>
                  </div>
                  {selectedItem?.["Next Date"] && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Last Follow-Up Date</p>
                      <p className="text-sm font-bold text-gray-900">{formatDateOnly(selectedItem["Next Date"])}</p>
                    </div>
                  )}
                  {(selectedItem?.["What Did Customer's Say (Remarks)"] || selectedItem?.["What Did Customer's Say"]) && (
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Last Follow-Up Remarks</p>
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
                  <Label htmlFor="fu-status" className="text-brand-900 font-bold flex items-center gap-2">
                    Installation Follow-Up <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={approvalData.clientStatus}
                    onValueChange={(val) => setApprovalData({ ...approvalData, clientStatus: val })}
                  >
                    <SelectTrigger id="fu-status" className="w-full border-brand-200 focus:ring-brand-500 h-11">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-brand-100">
                      <SelectItem value="Yes" className="focus:bg-brand-50">Yes</SelectItem>
                      <SelectItem value="No" className="focus:bg-brand-50">No</SelectItem>
                      <SelectItem value="Next Date for Follow-Up" className="focus:bg-brand-50">Next Date for Follow-Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {approvalData.clientStatus === "Yes" && (
                  <div className="space-y-5 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-px flex-1 bg-gray-100"></div>
                      <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest px-2">Service Details</span>
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
                        <Label htmlFor="fu-serviceType" className="text-gray-700 font-semibold">Service Type *</Label>
                        <Select
                          value={approvalData.serviceType}
                          onValueChange={(val) => setApprovalData({ ...approvalData, serviceType: val })}
                        >
                          <SelectTrigger id="fu-serviceType" className="h-10">
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
                          <Label htmlFor="fu-engineer" className="text-gray-700 font-semibold">Engineer Name *</Label>
                          <Select
                            value={approvalData.engineerName}
                            onValueChange={(val) => setApprovalData({ ...approvalData, engineerName: val })}
                          >
                            <SelectTrigger id="fu-engineer" className="h-10">
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
                          <Label htmlFor="fu-videoTime" className="text-gray-700 font-semibold">Video-Call Time *</Label>
                          <Input id="fu-videoTime"
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
                      <div className="animate-in fade-in duration-300 rounded-lg border border-brand-200 bg-brand-50 p-4 flex items-start gap-3">
                        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-brand-100 flex items-center justify-center">
                          <ExternalLink className="h-4 w-4 text-brand-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-brand-800">
                            Redirecting to New Enquiry
                          </p>
                          <p className="text-xs text-brand-600 mt-0.5">
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
                            <Label htmlFor="fu-report" className="text-gray-700 font-semibold">Service Report (Image/Video/PDF) *</Label>
                            <input id="fu-report"
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={handleFileChange}
                              accept=".jpg,.jpeg,.png,.pdf,.mp4"
                            />
                            <div
                              onClick={() => fileInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all cursor-pointer group ${fileData.name ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-gray-50 hover:bg-brand-50/50 hover:border-brand-300'}`}
                            >
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform ${fileData.name ? 'bg-brand-600' : 'bg-brand-100'}`}>
                                {fileData.name ? <CheckCircle2 className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-brand-600" />}
                              </div>
                              <p className="text-sm font-medium text-brand-600">
                                {fileData.name ? fileData.name : "Upload a file"} <span className="text-gray-400 font-normal">or drag and drop</span>
                              </p>
                              <p className="text-xs text-gray-400 mt-1">Images, Videos, PDFs up to 10MB</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="fu-remarks" className="text-gray-700 font-semibold">Remarks *</Label>
                          <textarea id="fu-remarks"
                            className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm shadow-inner"
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
                    <Label htmlFor="fu-remarksNo" className="text-gray-700 font-semibold">Remarks *</Label>
                    <textarea id="fu-remarksNo"
                      className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm shadow-inner"
                      placeholder="Why not?"
                      value={approvalData.remarks}
                      onChange={(e) => setApprovalData({ ...approvalData, remarks: e.target.value })}
                    />
                  </div>
                )}

                {approvalData.clientStatus === "Next Date for Follow-Up" && (
                  <div className="space-y-5 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                      <Label htmlFor="fu-nextDate" className="text-gray-700 font-semibold">Next Date for Follow-Up *</Label>
                      <Input id="fu-nextDate"
                        type="date"
                        className="h-10"
                        value={approvalData.followUpDate}
                        onChange={(e) => setApprovalData({ ...approvalData, followUpDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fu-customerSay" className="text-gray-700 font-semibold">What did Customer Said *</Label>
                      <textarea id="fu-customerSay"
                        className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm shadow-inner"
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
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 h-10 border-gray-300 text-gray-700 font-medium hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                form="followup-form"
                type="submit"
                className="px-8 h-10 font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
