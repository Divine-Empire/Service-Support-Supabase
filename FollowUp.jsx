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
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { useToast } from "../hooks/use-toast";
import { LoaderIcon, Loader2Icon } from "lucide-react";

export default function FollowUp() {
  const [activeTab, setActiveTab] = useState("pending");
  const [dateFilterTab, setDateFilterTab] = useState("");

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [followUpData, setFollowUpData] = useState([]);
  const [searchItem, setSearchItem] = useState("");
  const [clientAttachmentFilter, setClientAttachmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { toast } = useToast();

  const [masterData, setMasterData] = useState({});

  // console.log("followUpData", followUpData);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    pendingData.forEach((item) => {
      if (item.category) categories.add(String(item.category).trim());
    });
    historyData.forEach((item) => {
      if (item.category) categories.add(String(item.category).trim());
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [pendingData, historyData]);

  const [ticketsMap, setTicketsMap] = useState({});
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isUploadingClientAttachment, setIsUploadingClientAttachment] = useState(false);
  const [isUploadingSeniorAttachment, setIsUploadingSeniorAttachment] = useState(false);
  const [isUploadingAdvancePayment, setIsUploadingAdvancePayment] = useState(false);

  const sheet_url =
    import.meta.env.VITE_APPS_SCRIPT_API;

  const fetchData = async () => {
    setFetchLoading(true); // start loading
    try {
      const response = await fetch(`${sheet_url}?sheet=Ticket_Enquiry`);
      const json = await response.json();

      if (json.success && Array.isArray(json.data)) {
        const allData = json.data.slice(6).map((row, index) => ({
          id: index + 1,
          timeStemp: row[0] || "",
          ticketId: row[1] || "",
          sourceOfEnquiry: row[12] || "",
          callType: row[13] || "",
          enquiryReceiverName: row[14] || "",
          clientType: row[15] || "",
          companyName: row[16] || "",
          clientName: row[17] || "",
          phoneNumber: row[18] || "",
          gstAddress: row[19] || "",
          siteAddress: row[20] || "",
          gstNo: row[21] || "",
          machineName: row[22] || "",
          category: row[23] || "",
          mentionIssue: row[24] || "",
          serviceLocation: row[25] || "",

          // Remaining columns & Stage specific
          emailAddress: row[4] || "",
          title: row[7] || "",
          description: row[8] || "",

          quotationNo: row[40] || "",
          basicAmount: row[41] || "",
          totalAmoutWithTex: row[42] || "",
          quotationPdfLink: row[43] || "",
          quotationShareByPersonName: row[44] || "",
          ShareThrough: row[45] || "",
          quotationremarks: row[46] || "",

          planned4: row[47] || "",
          actual4: row[48] || "",

          stage: row[50] || "",
          paymentTerm: row[51] || "",
          acceptanceVia: row[52] || "",
          acceptanceAttachemntFile: row[53] || "",
          clientAttachment: row[56] || "",
          paymentMode: row[54] || "",
          seniorApproval: row[55] || "",
          approvalAttachmentFile: row[56] || "",
          whatDidTheCustomerSay: row[57] || "",
          nextAction: row[58] || "",
          nextDateOfCall: row[59] || "",
          followUpRemarks: row[60] || "",
          CREName: row[127] || "",
          engineerAssign: "",
        }));

        // Store standard lookup map for history enrichment
        const ticketsMapObj = {};
        allData.forEach((ticket) => {
          if (ticket.ticketId) {
            ticketsMapObj[ticket.ticketId] = ticket;
          }
        });
        setTicketsMap(ticketsMapObj);

        // Create a map to store unique tickets by ticketId, keeping the latest one
        const uniqueTicketsMap = new Map();
        allData.forEach((ticket) => {
          if (ticket.ticketId) {
            uniqueTicketsMap.set(ticket.ticketId, ticket);
          }
        });

        const uniqueAllData = Array.from(uniqueTicketsMap.values());

        const pending = uniqueAllData.filter(
          (item) => item.planned4 !== "" && item.actual4 === ""
        );

        const history = uniqueAllData.filter(
          (item) => item.planned4 !== "" && item.actual4 !== ""
        );

        setPendingData(pending);
        setHistoryData(history);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchMasterSheet = async () => {
    try {
      const response = await fetch(`${sheet_url}?sheet=Master`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data[0]; // First row contains headers
        const structuredData = {};

        // Initialize each header with an empty array
        headers.forEach((header) => {
          structuredData[header] = [];
        });

        // Process each data row (skip the header row)
        result.data.slice(1).forEach((row) => {
          row.forEach((value, index) => {
            const header = headers[index];
            // Handle cases where value might be null/undefined or not a string
            if (value !== null && value !== undefined) {
              const stringValue = String(value).trim(); // Convert to string and trim
              if (stringValue !== "") {
                structuredData[header].push(stringValue);
              }
            }
          });
        });

        // Remove duplicates from each array
        Object.keys(structuredData).forEach((key) => {
          structuredData[key] = [...new Set(structuredData[key])];
        });

        // console.log("Structured Master Data:", structuredData);
        setMasterData([structuredData]); // Wrap in array as per your requested format
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error("Failed to load master data");
    }
  };

  const fetchFllowUpSheet = async () => {
    try {
      const response = await fetch(`${sheet_url}?sheet=Follow-Up`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data[0]; // First row contains headers
        const formattedData = result.data.slice(1).map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            // Convert header to camelCase or another JS-friendly format if needed
            const key = header
              .toLowerCase()
              .replace(/\s+/g, "_")
              .replace("no.", "no"); // Handle "No." case
            obj[key] = row[index] || null; // Handle empty cells
          });
          return obj;
        });

        // console.log("Formatted data:", formattedData);
        setFollowUpData(formattedData);
      } else {
        // console.log("No data available");
        return [];
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error("Failed to load master data");
      throw error; // Re-throw if you want calling code to handle it
    }
  };

  useEffect(() => {
    fetchMasterSheet();
    fetchData();
    fetchFllowUpSheet();
  }, []);



  const formatInputDate = (dateStr) => {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const cleanStr = dateStr.split(" ")[0];
    const parts = cleanStr.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch (e) {}
    return "";
  };

  const handleFollowUpClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      quotationNo: ticket.quotationNo || "", // <-- NEW: Prefill Quotation No
      enquiryReceiverName: ticket.enquiryReceiverName || "",
      warrantyCheck: ticket.warrantyCheck || "",
      machineName: ticket.machineName || "",
      enquiryType: ticket.enquiryType || "",
      engineerAssign: ticket.engineerAssign || "",
      siteName: ticket.siteName || "",
      basicAmount: ticket.basicAmount || "",
      totalAmountWithTax: ticket.totalAmoutWithTex || "",
      quotationPdfLink: ticket.quotationPdfLink || "",
      quotationShareBy: ticket.quotationShareByPersonName || "",
      shareThrough: ticket.ShareThrough || "",
      remarks: ticket.quotationremarks || "",
      lastDateOfCall: "",
      status: "",
      stage: ticket.stage || "",
      whatDidCustomerSay: ticket.whatDidTheCustomerSay || "",
      nextAction: ticket.nextAction || "",
      nextDateOfCall: formatInputDate(ticket.nextDateOfCall),
      paymentTerm: ticket.paymentTerm || "",
      againstDelivery: "",
      acceptanceVia: ticket.acceptanceVia || "",
      paymentMode: ticket.paymentMode || "",
      acceptanceAttachmentUrl: ticket.acceptanceAttachemntFile || "",
      clientAttachmentUrl: ticket.clientAttachment || "",
      seniorApproval: ticket.seniorApproval || "",
    });
    setShowFollowUpModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadImageToDrive = async (file) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result.split(",")[1];
          resolve(result);
        };
        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };
      });

      const uploadResponse = await fetch(`${sheet_url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "uploadFile",
          fileName: `Invoice_${selectedTicket?.ticketId}_${Date.now()}.jpg`,
          base64Data: base64Data,
          mimeType: file.type,
          folderId: import.meta.env.VITE_DRIVE_FOLDER_ID,
        }),
      });

      const result = await uploadResponse.json();
      if (!result.success) {
        console.error("Upload error:", result.error);
        toast({
          title: "Error",
          description: "Failed to upload image to Google Drive",
          variant: "destructive",
        });
        return { success: false, error: result.error };
      }

      return result;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
      return { success: false, error: "Failed to upload image" };
    }
  };

  const handleClientAttachmentChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingClientAttachment(true);
    try {
      const result = await uploadImageToDrive(file);
      if (result.success && result.fileUrl) {
        handleInputChange("clientAttachmentUrl", result.fileUrl);
        toast({
          title: "Success",
          description: "Client Attachment uploaded successfully",
        });
      } else {
        e.target.value = null;
        handleInputChange("clientAttachmentUrl", "");
      }
    } catch (error) {
      console.error(error);
      e.target.value = null;
      handleInputChange("clientAttachmentUrl", "");
    } finally {
      setIsUploadingClientAttachment(false);
    }
  };

  const handleSeniorAttachmentChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingSeniorAttachment(true);
    try {
      const result = await uploadImageToDrive(file);
      if (result.success && result.fileUrl) {
        handleInputChange("acceptanceAttachmentUrl", result.fileUrl);
        toast({
          title: "Success",
          description: "Senior Attachment uploaded successfully",
        });
      } else {
        e.target.value = null;
        handleInputChange("acceptanceAttachmentUrl", "");
      }
    } catch (error) {
      console.error(error);
      e.target.value = null;
      handleInputChange("acceptanceAttachmentUrl", "");
    } finally {
      setIsUploadingSeniorAttachment(false);
    }
  };

  const handleAdvancePaymentChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingAdvancePayment(true);
    try {
      const result = await uploadImageToDrive(file);
      if (result.success && result.fileUrl) {
        handleInputChange("advanceAttachmentUrl", result.fileUrl);
        toast({
          title: "Success",
          description: "Advance Payment Attachment uploaded successfully",
        });
      } else {
        e.target.value = null;
        handleInputChange("advanceAttachmentUrl", "");
      }
    } catch (error) {
      console.error(error);
      e.target.value = null;
      handleInputChange("advanceAttachmentUrl", "");
    } finally {
      setIsUploadingAdvancePayment(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // if (!formData.clientName || !formData.phoneNumber || !formData.title) {
    //  toast({
    //    title: "Error",
    //    description: "Please fill in all required fields",
    //    variant: "destructive",
    //  });
    //  return;
    // }

    if (formData.stage === "Followup") {
      if (!formData.whatDidCustomerSay) {
        alert("Please Write Something in What did Customer Say");
        return;
      }

      if (!formData.nextAction) {
        alert("Please Write Something in Next Action");
        return;
      }
      if (!formData.nextDateOfCall) {
        alert("Please Select Next Date of Call");
        return;
      }
    } else if (formData.stage === "Order Received") {
      if (!formData.clientAttachmentUrl) {
        alert("Please add and upload file for client Attachment");
        return;
      }
    } else {
      if (!formData.clientAttachmentUrl) {
        alert("Please add and upload file for client Attachment");
        return;
      }
      if (!formData.acceptanceAttachmentUrl) {
        alert("Please add and upload file for Senior Attachment");
        return;
      }
      if (!formData.paymentTerm) {
        alert("Please select Payment Term");
        return;
      }
      if (!formData.acceptanceVia) {
        alert("Please select acceptance Via");
        return;
      }
      if (!formData.paymentMode) {
        alert("Please select Payment Mode");
        return;
      } else {
        if (formData.paymentMode !== "FullyAdvance") {
          if (!formData.seniorApproval) {
            alert("Please select Senior Approval");
            return;
          }
        }
      }

      if (
        formData.paymentMode === "FullyAdvance" ||
        formData.paymentMode === "Partial Advance" ||
        formData.paymentMode === "Partial Advance+PDC" ||
        formData.paymentMode === "Current Date Cheque"
      ) {
        if (!formData.advanceAttachmentUrl) {
          alert("please add and upload file for Advance Payment Attachment");
          return;
        }
      }
    }

    setIsSubmitting(true);
    let acceptanceFile = formData.acceptanceAttachmentUrl || "";
    let approvalFile = formData.clientAttachmentUrl || "";

    let followupremarkFileUrl = formData.advanceAttachmentUrl || "";

    const currentDateTime = formatDateTime(new Date());

    try {
      const rowData = [
        currentDateTime, // A
        formData.ticketId || "", // B
        formData.stage || "", // C
        formData.paymentTerm || "", // D
        formData.acceptanceVia || "", // E
        acceptanceFile || "", // F
        formData.paymentMode || "", // G
        formData.seniorApproval || "", // H
        approvalFile || "", // I
        formData.whatDidCustomerSay || "", // J
        formData.nextAction || "", // K
        formData.nextDateOfCall || "", // L
        followupremarkFileUrl || "", // M
        formData.quotationNo || "", // N <-- NEW: Save Quotation No
      ];

      // console.log("rowDAta", formData);

      const response = await fetch(sheet_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          sheetName: "Follow-Up",
          action: "insert",
          rowData: JSON.stringify(rowData),
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update the Ticket_Enquiry sheet row with the newly assigned engineer (col-EL)
        try {
          await fetch(sheet_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              sheetId: import.meta.env.VITE_GOOGLE_SHEET_ID,
              sheetName: "Ticket_Enquiry",
              action: "update",
              rowIndex: (selectedTicket.id + 6).toString(),
              columnData: JSON.stringify({
                EI: formData.engineerAssign || "",
              }),
            }).toString(),
          });
        } catch (updateErr) {
          console.error("Failed to update engineer assign on Ticket_Enquiry:", updateErr);
        }

        // setTickets([...tickets, newTicket]);
        setFormData({
          clientName: "",
          phoneNumber: "",
          emailAddress: "",
          category: "",
          priority: "",
          title: "",
          description: "",
          date: new Date().toISOString().split("T")[0],
        });
        setShowFollowUpModal(false);

        // Update local state immediately
        setPendingData((prevPending) =>
          prevPending.filter(
            (ticket) => ticket.ticketId !== selectedTicket.ticketId
          )
        );
        setFollowUpData((prevHistory) => [
          {
            timestamp: currentDateTime, // Add timestamp
            ticket_id: formData.ticketId,
            quotation_no: formData.quotationNo, // <-- NEW: Add to local state
            stage: formData.stage,
            what_did_the_customer_say: formData.whatDidCustomerSay,
            next_action: formData.nextAction,
            next_date_of_call: formData.nextDateOfCall,
            payment_term: formData.paymentTerm,
            acceptance_via: formData.acceptanceVia,
            acceptance_attachment: acceptanceFile || "", // Add acceptance attachment
            payment_mode: formData.paymentMode,
            senior_approval: formData.seniorApproval,
            approval_attachment: approvalFile || "", // Add approval attachment
            remarks: followupremarkFileUrl || "", // Add remarks
          },
          ...prevHistory,
        ]);

        toast({
          title: "Success",
          description: "follow-up added successfully",
        });

        // Trigger GET actions to instantly load the recently updated data
        fetchData();
        fetchFllowUpSheet();
      } else {
        throw new Error(result.error || "Failed to save ticket");
      }
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: "Failed to save ticket. Data stored locally.",
        variant: "destructive",
      });

      // setTickets([...tickets, newTicket]);
    } finally {
      setIsSubmitting(false);
      // setShowForm(false);
    }
  };

  const [cancelSubmit, setCancelSubmit] = useState(false);

  const handleSubmitCancel = async (e) => {
    e.preventDefault();

    setCancelSubmit(true);

    const currentDateTime = formatDateTime(new Date());

    try {
      const rowData = [
        currentDateTime,
        selectedTicket.ticketId || "", // Call Type
        selectedTicket.clientName || "", // Enquiry Receiver Name
        selectedTicket.phoneNumber || "", // Warranty Check
        selectedTicket.emailAddress || "", // Bill Number Input
        selectedTicket.category || "", // Bill Number Input

        selectedTicket.title || "", // Machine Name
        selectedTicket.description || "", // Machine Name
        "Follow-Up", // Enquiry Type (second one)
        formData.cancelRemarks || "",
      ];

      // console.log("rowDAta", formData);

      const response = await fetch(sheet_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          sheetName: "Cancel",
          action: "insert",
          rowData: JSON.stringify(rowData),
        }),
      });

      const result = await response.json();

      if (result.success) {
        // setTickets([...tickets, newTicket]);
        setPendingData((prevPending) =>
          prevPending.filter(
            (ticket) => ticket.ticketId !== selectedTicket.ticketId
          )
        );
        toast({
          title: "Success",
          description: "Ticket details Cancle successfully",
        });
        setShowFollowUpModal(false);
        setIsCancelled(false);
      } else {
        throw new Error(result.error || "Failed to save ticket");
      }
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: "Failed to save ticket. Data stored locally.",
        variant: "destructive",
      });

      // setTickets([...tickets, newTicket]);
    } finally {
      setCancelSubmit(false);
      // setShowForm(false);
    }
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

  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const renderConditionalFields = () => {
    const stage = formData.stage;

    if (
      // stage === "call-not-picked" ||
      stage === "Followup"
      // stage === "introductory-call"
    ) {
      return (
        <>
          <div>
            <Label>What Did The Customer Say *</Label>
            <Textarea
              rows={3}
              value={formData.whatDidCustomerSay || ""}
              onChange={(e) =>
                handleInputChange("whatDidCustomerSay", e.target.value)
              }
              data-testid="textarea-customer-say"
            />
          </div>
          <div>
            <Label>Next Action *</Label>
            <Input
              value={formData.nextAction || ""}
              onChange={(e) => handleInputChange("nextAction", e.target.value)}
              data-testid="input-next-action"
            />
          </div>
          <div>
            <Label>Next Date Of Call *</Label>
            <Input
              type="date"
              value={formData.nextDateOfCall || ""}
              onChange={(e) =>
                handleInputChange("nextDateOfCall", e.target.value)
              }
              data-testid="input-next-date"
            />
          </div>
        </>
      );
    } else if (stage === "Order Received") {
      return (
        <>
          {/* Editable fields */}
          <div>
            <Label className="flex items-center gap-2">
              Client Attachments *
              {isUploadingClientAttachment && (
                <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
              )}
            </Label>
            <Input
              type="file"
              disabled={isUploadingClientAttachment}
              onChange={handleClientAttachmentChange}
              data-testid="approval-attachments"
            />
            {isUploadingClientAttachment && (
              <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
            )}
            {formData.clientAttachmentUrl && (
              <p className="mt-1 text-sm text-green-600">
                Current attachment:{" "}
                <a
                  href={formData.clientAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-800 font-medium"
                >
                  View File
                </a>
              </p>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-2">
              Senior Attachments
              {isUploadingSeniorAttachment && (
                <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
              )}
            </Label>
            <Input
              type="file"
              disabled={isUploadingSeniorAttachment}
              onChange={handleSeniorAttachmentChange}
              data-testid="acceptance-attachments"
            />
            {isUploadingSeniorAttachment && (
              <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
            )}
            {formData.acceptanceAttachmentUrl && (
              <p className="mt-1 text-sm text-green-600">
                Current attachment:{" "}
                <a
                  href={formData.acceptanceAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-800 font-medium"
                >
                  View File
                </a>
              </p>
            )}
          </div>

          <div>
            <Label>Payment Term</Label>
            <Select
              value={formData.paymentTerm || undefined} // Use undefined instead of empty string
              onValueChange={(value) => handleInputChange("paymentTerm", value)}
            >
              <SelectTrigger data-testid="Payment Terms">
                <SelectValue placeholder="Payment Term" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                {masterData.length > 0 && masterData[0]["Payment Terms"] ? (
                  masterData[0]["Payment Terms"].map(
                    (item, ind) =>
                      item && ( // Only render if item is not empty
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

          {/* Acceptance Via with Mail fix */}

          <div>
            <Label>Acceptance Via</Label>
            <Select
              value={formData.acceptanceVia || undefined} // Use undefined instead of empty string
              onValueChange={(value) =>
                handleInputChange("acceptanceVia", value)
              }
            >
              <SelectTrigger data-testid="acceptance Via">
                <SelectValue placeholder="Acceptance Via" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                <SelectItem
                  value="Mail"
                  className="hover:bg-blue-50 focus:bg-blue-50"
                >
                  Mail
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Payment Mode</Label>
            <Select
              value={formData.paymentMode || undefined} // Use undefined instead of empty string
              onValueChange={(value) => handleInputChange("paymentMode", value)}
            >
              <SelectTrigger data-testid="select-payment-mode">
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                {masterData.length > 0 && masterData[0]["Payment Mode"] ? (
                  masterData[0]["Payment Mode"].map(
                    (item, ind) =>
                      item && ( // Only render if item is not empty
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

          {formData.paymentMode !== "" &&
            (formData.paymentMode === "FullyAdvance" ||
              formData.paymentMode === "Partial Advance" ||
              formData.paymentMode === "Partial Advance+PDC" ||
              formData.paymentMode === "Current Date Cheque") && (
              <div>
                <Label className="flex items-center gap-2">
                  Advance Payment Attachment
                  {isUploadingAdvancePayment && (
                    <LoaderIcon className="animate-spin w-4 h-4 text-blue-600" />
                  )}
                </Label>
                <Input
                  type="file"
                  disabled={isUploadingAdvancePayment}
                  onChange={handleAdvancePaymentChange}
                  data-testid="attachment"
                />
                {isUploadingAdvancePayment && (
                  <p className="text-xs text-blue-600 mt-1">Uploading file, please wait...</p>
                )}
                {formData.advanceAttachmentUrl && (
                  <p className="mt-1 text-sm text-green-600">
                    Current attachment:{" "}
                    <a
                      href={formData.advanceAttachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-green-800 font-medium"
                    >
                      View File
                    </a>
                  </p>
                )}
              </div>
            )}

          {formData.paymentMode !== "" &&
            formData.paymentMode !== "FullyAdvance" && (
              <div>
                <Label>Senior Approval</Label>
                <Select
                  value={formData.seniorApproval || undefined} // Use undefined instead of empty string
                  onValueChange={(value) =>
                    handleInputChange("seniorApproval", value)
                  }
                >
                  <SelectTrigger data-testid="select-senior-approval">
                    <SelectValue placeholder="Select approval status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {masterData.length > 0 &&
                      masterData[0]["Senior Approval"] ? (
                      masterData[0]["Senior Approval"].map(
                        (item, ind) =>
                          item && ( // Only render if item is not empty
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
            )}
        </>
      );
    }
    return null;
  };

  const filteredPendingData = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotationNo || "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.category || "").trim() === categoryFilter.trim();

      return matchesSearch && matchesCategory;
    })
    .reverse();

  const enrichedFollowUpData = followUpData.map((item) => {
    const ticketDetails = ticketsMap[item.ticket_id] || {};
    return {
      ...item,
      // 16 core pipeline properties
      timeStemp: ticketDetails.timeStemp || item.timestamp || "",
      ticketId: item.ticket_id || "",
      sourceOfEnquiry: ticketDetails.sourceOfEnquiry || "",
      callType: ticketDetails.callType || "",
      enquiryReceiverName: ticketDetails.enquiryReceiverName || "",
      clientType: ticketDetails.clientType || "",
      companyName: ticketDetails.companyName || "",
      clientName: ticketDetails.clientName || "",
      phoneNumber: ticketDetails.phoneNumber || "",
      gstAddress: ticketDetails.gstAddress || "",
      siteAddress: ticketDetails.siteAddress || "",
      gstNo: ticketDetails.gstNo || "",
      machineName: ticketDetails.machineName || "",
      category: ticketDetails.category || "",
      mentionIssue: ticketDetails.mentionIssue || "",
      serviceLocation: ticketDetails.serviceLocation || "",

      // Roles lookup fallback
      cre_name: item.cre_name || ticketDetails.CREName || "",
      engineer_assign: item.engineer_assign || ticketDetails.engineerAssign || "",
    };
  });

  const filteredHistoryData = enrichedFollowUpData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q) ||
        String(item.quotation_no || "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.category || "").trim() === categoryFilter.trim();

      return matchesSearch && matchesCategory;
    })
    .reverse();

  const filterByDateCategory = (data) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return data.filter((item) => {
      const nextDate = new Date(item.nextDateOfCall);
      nextDate.setHours(0, 0, 0, 0);

      if (dateFilterTab === "today") {
        return nextDate.getTime() === today.getTime();
      } else if (dateFilterTab === "upcoming") {
        return nextDate.getTime() > today.getTime();
      } else if (dateFilterTab === "overdue") {
        return nextDate.getTime() < today.getTime();
      }
      return true;
    });
  };

  const attachmentFilteredPendingData = filteredPendingData.filter((item) => {
    if (clientAttachmentFilter === "hasAttachment") {
      return item.clientAttachment && String(item.clientAttachment).trim() !== "";
    } else if (clientAttachmentFilter === "noAttachment") {
      return !item.clientAttachment || String(item.clientAttachment).trim() === "";
    }
    return true;
  });

  const finalFilteredPendingDataa = filterByDateCategory(attachmentFilteredPendingData);
  const finalFilteredHistoryDataa = filterByDateCategory(filteredHistoryData);



  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = JSON.parse(roleStorage);
  const role = parsedData.state.user.role;

  const finalFilteredPendingData = role === "user" ? finalFilteredPendingDataa.filter(
    (item) => item["CREName"] === userName
  ) : role === "engineer" ? finalFilteredPendingDataa.filter(
    (item) => item["engineerAssign"] === userName
  ) : finalFilteredPendingDataa;

  const finalFilteredHistoryData = role === "user" ? finalFilteredHistoryDataa.filter(
    (item) => item["cre_name"] === userName
  ) : role === "engineer" ? finalFilteredHistoryDataa.filter(
    (item) => item["engineer_assign"] === userName
  ) : finalFilteredHistoryDataa;

  // console.log("finalFilteredPendingDataa", finalFilteredPendingDataa);
  // console.log("finalFilteredHistoryDataa", finalFilteredHistoryDataa);


  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Left Side: Tabs buttons and Date Category Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <TabsTrigger
                  value="pending"
                  data-testid="tab-pending"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Pending ({finalFilteredPendingData.length})
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  data-testid="tab-history"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  History ({finalFilteredHistoryData.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2 bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 p-1 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setDateFilterTab("")}
                  className="px-4 py-2 rounded-md text-sm transition-all bg-transparent text-gray-700 hover:bg-green-100 border border-red-500"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterTab("today")}
                  className={`px-4 py-2 rounded-md text-sm transition-all ${
                    dateFilterTab === "today"
                      ? "bg-green-600 text-white shadow-md"
                      : "bg-transparent text-gray-700 hover:bg-green-100"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterTab("upcoming")}
                  className={`px-4 py-2 rounded-md text-sm transition-all ${
                    dateFilterTab === "upcoming"
                      ? "bg-green-600 text-white shadow-md"
                      : "bg-transparent text-gray-700 hover:bg-green-100"
                  }`}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterTab("overdue")}
                  className={`px-4 py-2 rounded-md text-sm transition-all ${
                    dateFilterTab === "overdue"
                      ? "bg-red-600 text-white shadow-md"
                      : "bg-transparent text-gray-700 hover:bg-red-100"
                  }`}
                >
                  Overdue
                </button>
              </div>
            </div>

            {/* Right Side: Search Input, Category Filter, and Client Attachment Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 md:justify-end w-full md:w-auto">
              <div className="relative flex-1 max-w-xs w-full">
                <Input
                  id="searchFilter"
                  placeholder="Search by ticket ID, client, company, phone or quotation no..."
                  className="pl-10 py-2 w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                  data-testid="input-search-filter"
                  onChange={(e) => setSearchItem(e.target.value)}
                />
              </div>

              <div className="w-full sm:w-44">
                <select
                  id="categoryFilter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  data-testid="select-category-filter"
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === "pending" && (
                <div className="w-full sm:w-44">
                  <select
                    id="clientAttachmentFilter"
                    value={clientAttachmentFilter}
                    onChange={(e) => setClientAttachmentFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    data-testid="select-client-attachment-filter"
                  >
                    <option value="all">All Attachments</option>
                    <option value="hasAttachment">Client Attachment Not Empty</option>
                    <option value="noAttachment">Client Attachment Empty</option>
                  </select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mt-2">

              <TabsContent value="pending" className="mt-0">
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                  <table className="hidden sm:block w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Action
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Ticket-ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Source of enquiry
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Call type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
                          Enquiry Receiver Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Billing Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Site Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          GST No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Machine Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Category
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Mention Issue
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Service Location
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Basic Amount
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Total Amount
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation PDF
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Attachment
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Shared By
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Share Through
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Remarks
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Next Action
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Next Date Of Call
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {finalFilteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={27}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending follow-ups found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        finalFilteredPendingData.map((ticket, ind) => (
                          <tr
                            key={ticket.id}
                            className={
                              ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            }
                          >
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                onClick={() => handleFollowUpClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 hover:text-blue-700 transition-all duration-300 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                data-testid={`button-followup-${ticket.id}`}
                              >
                                <span className="font-medium">Follow-Up</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {formatDate(ticket.timeStemp)}
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.sourceOfEnquiry || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.callType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.enquiryReceiverName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientType || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.siteAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.gstNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.machineName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.category || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.mentionIssue || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.serviceLocation || ""}
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.quotationNo || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.basicAmount || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.totalAmoutWithTex || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationPdfLink ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(
                                      ticket.quotationPdfLink,
                                      "_blank"
                                    );
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium px-2 py-1 rounded transition-colors"
                                >
                                  Download
                                </button>
                              ) : (
                                <span className="text-gray-400">No file</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientAttachment ? (
                                <a
                                  href={ticket.clientAttachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                >
                                  View
                                </a>
                              ) : (
                                <span className="text-gray-400">No file</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationShareByPersonName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.ShareThrough || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationremarks || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.nextAction || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.nextDateOfCall) || ""}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-4">
                    {finalFilteredPendingData.length === 0 ? (
                      <div
                        className="text-center py-8 bg-white"
                        data-testid="text-no-pending"
                      >
                        {fetchLoading ? (
                          <div className="flex justify-center items-center text-blue-700">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        ) : (
                          <h1 className="text-blue-700">
                            No pending follow-ups found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      finalFilteredPendingData.map((ticket, ind) => (
                        <Card
                          key={ticket.id}
                          className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-blue-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header with Ticket ID and Action */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
                                  {ticket.ticketId}
                                </h3>
                                {/* NEW: Quotation No in Mobile View */}
                                <p className="text-sm text-gray-700 font-medium">
                                  Quote: {ticket.quotationNo || "N/A"}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleFollowUpClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 hover:from-blue-100 hover:to-indigo-100 border border-blue-200"
                              >
                                Follow-Up
                              </Button>
                            </div>

                            {/* Contact & Enquiry Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Enquiry Receiver
                                </p>
                                <p className="text-blue-900">
                                  {ticket.enquiryReceiverName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Technical Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Warranty
                                </p>
                                <p className="text-blue-900">
                                  {ticket.warrantyCheck || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Machine
                                </p>
                                <p className="text-blue-900">
                                  {ticket.machineName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Engineer & Site */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Engineer
                                </p>
                                <p className="text-blue-900">
                                  {ticket.engineerAssign || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Site Name
                                </p>
                                <p className="text-blue-900">
                                  {ticket.siteName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Financial Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Basic Amount
                                </p>
                                <p className="text-blue-900">
                                  {ticket.basicAmount || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Total Amount
                                </p>
                                <p className="text-blue-900">
                                  {ticket.totalAmoutWithTex || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Quotation Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Shared By
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationShareByPersonName || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Share Through
                                </p>
                                <p className="text-blue-900">
                                  {ticket.ShareThrough || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Quotation PDF */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Quotation PDF
                              </p>
                              {ticket.quotationPdfLink ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(
                                      ticket.quotationPdfLink,
                                      "_blank"
                                    );
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  Download PDF
                                </button>
                              ) : (
                                <p className="text-blue-900">No file</p>
                              )}
                            </div>

                            {/* Follow-up Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Action
                                </p>
                                <p className="text-blue-900">
                                  {ticket.nextAction || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Call Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.nextDateOfCall) || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Remarks */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Remarks
                              </p>
                              <p className="text-blue-900 line-clamp-2">
                                {ticket.quotationremarks || "N/A"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
        </TabsContent>

              <TabsContent value="history" className="mt-0">
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                  <table className="hidden sm:block w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Ticket-ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Source of enquiry
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Call type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">
                          Enquiry Receiver Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Type
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Billing Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Site Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          GST No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Machine Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Category
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[200px] sticky top-0">
                          Mention Issue
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Service Location
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Stage
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          PAYMENT TERM
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Acceptance Via
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Senior Attachments
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          PAYMENT MODE
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Senior approval
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Attachment
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          What Did The Customer Say
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Next Action
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Next Date Of Call
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {finalFilteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={27}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No follow-up history found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        [...finalFilteredHistoryData]
                          .map((ticket, ind) => (
                            <tr
                              key={ind}
                              className={
                                ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                              }
                            >
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {formatDate(ticket.timeStemp)}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.ticketId}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.sourceOfEnquiry || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.callType || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.enquiryReceiverName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.clientType || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.companyName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.clientName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.phoneNumber || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.gstAddress || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.siteAddress || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.gstNo || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.machineName || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.category || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.mentionIssue || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.serviceLocation || ""}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.quotation_no || ""}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.stage || ""}
                              </td>
                              <td className="px-4 py-3">
                                {ticket.payment_term_ || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.acceptance_via || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.acceptance_attachments_ ? (
                                  <a
                                    href={ticket.acceptance_attachments_}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.payment_mode || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.senior_approval || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.approval_attachment ? (
                                  <a
                                    href={ticket.approval_attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.what_did_the_customer_say || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.next_action || ""}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {formatDate(ticket.next_date_of_call) || ""}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {finalFilteredHistoryData.length === 0 ? (
                      <div
                        className="text-center py-8 bg-white"
                        data-testid="text-no-history"
                      >
                        {fetchLoading ? (
                          <div className="flex justify-center items-center text-blue-700">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        ) : (
                          <h1 className="text-blue-700">
                            No follow-up history found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      [...finalFilteredHistoryData].map((ticket, ind) => (
                        <Card
                          key={ind}
                          className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-blue-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div>
                              <h3 className="font-bold text-blue-800 text-lg">
                                {ticket.ticket_id}
                              </h3>
                              {/* NEW: Quotation No in Mobile View */}
                              <p className="text-sm text-gray-700 font-medium">
                                Quote: {ticket.quotation_no || "N/A"}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatDate(ticket.timestamp)}
                              </p>
                            </div>

                            {/* Stage & Payment */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Stage
                                </p>
                                <p className="text-blue-900">
                                  {ticket.stage || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Payment Term
                                </p>
                                <p className="text-blue-900">
                                  {ticket.payment_term_ || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Acceptance & Payment Mode */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Acceptance Via
                                </p>
                                <p className="text-blue-900">
                                  {ticket.acceptance_via || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Payment Mode
                                </p>
                                <p className="text-blue-900">
                                  {ticket.payment_mode || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Senior Approval */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Senior Approval
                              </p>
                              <p className="text-blue-900">
                                {ticket.senior_approval || "N/A"}
                              </p>
                            </div>

                            {/* Attachments */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Senior Attachments
                                </p>
                                {ticket.acceptance_attachments_ ? (
                                  <a
                                    href={ticket.acceptance_attachments_}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <p className="text-blue-900">N/A</p>
                                )}
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Client Attachment
                                </p>
                                {ticket.approval_attachment ? (
                                  <a
                                    href={ticket.approval_attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <p className="text-blue-900">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Customer Feedback */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Customer Feedback
                              </p>
                              <p className="text-blue-900 line-clamp-2">
                                {ticket.what_did_the_customer_say || "N/A"}
                              </p>
                            </div>

                            {/* Next Steps */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Action
                                </p>
                                <p className="text-blue-900">
                                  {ticket.next_action || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Next Call Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.next_date_of_call) ||
                                    "N/A"}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
        </TabsContent>
            </div>
          </CardContent>
        </Card>
      </Tabs>

      {/* Follow-Up Modal */}
      <Modal
        isOpen={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        title="Follow-Up"
        size="4xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-2 mb-10">
            <input
              type="checkbox"
              id="cancelTicket"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <Label htmlFor="cancelTicket" className="text-red-600 font-medium">
              Cancel Ticket
            </Label>
          </div>

          <div></div>

          {/* Pre-filled fields */}
          <div>
            <Label>Ticket ID</Label>
            <Input
              value={formData.ticketId || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Client Name</Label>
            <Input
              value={formData.clientName || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input
              value={formData.phoneNumber || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          {/* NEW: Quotation No Field in Modal */}
          <div>
            <Label>Quotation No.</Label>
            <Input
              value={formData.quotationNo || ""}
              disabled
              className="bg-slate-50"
            />
          </div>
          <div>
            <Label>Engineer Assign</Label>
            <Select
              value={formData.engineerAssign || undefined}
              onValueChange={(value) =>
                handleInputChange("engineerAssign", value)
              }
            >
              <SelectTrigger
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                data-testid="select-engineer-assign"
              >
                <SelectValue placeholder={formData.engineerAssign || "Select Engineer"} />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                {masterData.length > 0 &&
                  masterData[0]["Engineer Assign Name"] ? (
                  masterData[0]["Engineer Assign Name"].map((item, ind) => (
                    <SelectItem
                      key={ind}
                      value={item}
                      className="hover:bg-blue-50 focus:bg-blue-50"
                    >
                      {item}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="Loading" disabled>
                    Loading options...
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {!isCancelled && (
            <>
              <div>
                <Label>Stage</Label>
                <Select
                  value={formData.stage || undefined} // Use undefined instead of empty string
                  onValueChange={(value) => handleInputChange("stage", value)}
                >
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {masterData.length > 0 && masterData[0]["Stage"] ? (
                      masterData[0]["Stage"].map(
                        (item, ind) =>
                          item && ( // Only render if item is not empty
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

              {/* Conditional fields based on stage */}
              {renderConditionalFields()}

              <div className="md:col-span-2 flex space-x-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingClientAttachment || isUploadingSeniorAttachment || isUploadingAdvancePayment}
                  data-testid="button-submit-followup"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:transform-none"
                >
                  {isSubmitting && <Loader2Icon className="animate-spin" />}
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFollowUpModal(false)}
                  data-testid="button-cancel-followup"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}

          {isCancelled && (
            <>
              <div>
                <Label>Remarks</Label>
                <Textarea
                  rows={3}
                  value={formData.cancelRemarks || ""}
                  onChange={(e) =>
                    handleInputChange("cancelRemarks", e.target.value)
                  }
                  data-testid="textarea-remark"
                />
              </div>

              <div className="flex justify-center py-6">
                <Button
                  type="button"
                  onClick={handleSubmitCancel}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
                >
                  {cancelSubmit && (
                    <Loader2Icon className="animate-spin w-4 h-4 mr-2" />
                  )}
                  Confirm Cancellation
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
