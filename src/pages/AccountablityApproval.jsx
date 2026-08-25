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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { storage } from "../lib/storage";
import { useToast } from "../hooks/use-toast";
import { Loader2Icon, LoaderIcon } from "lucide-react";
import { Textarea } from "../components/ui/textarea";

export default function AccountablityApproval() {
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingTickets, setPendingTickets] = useState([]);
  const [historyTickets, setHistoryTickets] = useState([]);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchItem, setSearchItem] = useState("");
  const [isCancelled, setIsCancelled] = useState(false);
  const { toast } = useToast();

  // console.log("SelectedTicket",selectedTicket);

  const [masterData, setMasterData] = useState({});

  // console.log("masterData", masterData);

  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sheet_url =
    import.meta.env.VITE_APPS_SCRIPT_API;
  const Sheet_Id = import.meta.env.VITE_GOOGLE_SHEET_ID;

  const fetchInvoiceSheet = async () => {
    setFetchLoading(true); // start loading
    try {
      const response = await fetch(`${sheet_url}?sheet=Invoice`);
      const json = await response.json();

      if (json.success && Array.isArray(json.data)) {
        // Process the data to match your requirements
        const allData = json.data.slice(6).map((row, index) => ({
          id: index + 1,
          timeStemp: row[0], // Timestamp
          ticketId: row[1], // Ticket ID
          quotationNo: row[2], // Quotation No.(input)
          clientName: row[3], // Client Name
          phoneNumber: row[4], // Phone Number
          emailAddress: row[5], // Email Address
          invoiceCategory: row[6], // Email Address
          companyName: row[7], // Company Name
          quotationPdfLink: row[8], // Quotation Pdf link

          invoicePostedBy: row[9], // Invoice Posted By(Drop-Down)
          invoiceNoNABL: row[10], // Invoice No (NABL) (Manual)
          invoiceNoSERVICE: row[11], // Invoice No (SERVICE)
          invoiceNoSPARE: row[12], // Invoice No (SPARE)
          spareInvoice: row[13], // SPARE INVOICE
          serviceInvoice: row[14], // SERVICE INVOICE
          nablInvoice: row[15], // NABL INVOICE
          nonNabl: row[16], // NON NABL
          invoiceAmountNABLBasic: row[17], // Invoice Amount NABL (Basic)
          invoiceAmountNABLGst: row[18], // Invoice Amount NABL (gst)
          totalInvoiceAmtNonNABLBasic: row[19], // Total Invoice Amt NON NABL BASIC
          totalInvoiceAmtNonNABLGst: row[20], // Total Invoice Amt NON NABL gst
          serviceAmountBasic: row[21], // Service Amount (Basic)

          totalServiceAmtSpare: row[22], // Total Service Amt (spare)
          totalServiceAmtSpareGst: row[23], // Total Service Amt (spare) gst

          attachmentService: row[24], // Attachment Service
          attachmentSpear: row[25], // Attachment Spear
          attachmentNABL: row[26], // Attachment NABL

          billNo: row[27], // Attachment NABL
          billFile: row[28], // Attachment NABL
          basicAmount: row[29], // Attachment NABL
          totalAmountWithTex: row[30], // Attachment NABL

          planned13: row[31],
          actual13: row[32],
          delay13: row[33],
          otp: row[34],
          otpVarification: row[35],

          planned14: row[36],
          actual14: row[37],
          delay14: row[38],

          planned15: row[39],
          actual15: row[40],
          delay15: row[41],
          calibrationDate: row[42],
          calibrationPeriodMonth: row[43],
          calibrationUploadFile: row[44],

          planned16: row[45],
          actual16: row[46],
          delay16: row[47],
          accountablityApproval: row[48],
          hardCopyStatus: row[49],
          hardCopyAttachment: row[50],

          softCopyStatus: row[51],
          softCopyAttachment: row[52],

          senderName: row[53],

          CREName: row[73],
        }));

        // Filter data based on your conditions

        // console.log("Alldata", allData);

        const pending = allData.filter(
          (item) => item.planned16 !== "" && item.actual16 === ""
        );

        const history = allData.filter(
          (item) => item.planned16 !== "" && item.actual16 !== ""
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

  useEffect(() => {
    fetchMasterSheet();
    fetchInvoiceSheet();
  }, []);

  useEffect(() => {
    const tickets = storage.getTickets();
    const pending = tickets.filter((t) => t.status === "warehouse-completed");
    const history = tickets.filter((t) => t.status === "completed");

    setPendingTickets(pending);
    setHistoryTickets(history);
  }, []);

  const handleCalibrationClick = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticketId: ticket.ticketId,
      quotationNo: ticket.quotationNo || `QT-${ticket.id}`,
      clientName: ticket.clientName,
      phoneNumber: ticket.phoneNumber,
      companyName: ticket.companyName || "",
      quotationPdfLink: ticket.quotationPdfLink || "",
      entryNo: ticket.entryNo || "",
      calibrationCertificatePlanDate: "",
      accountabilityApporval: "",
      calibrationDate: "",
      softCopyStatus: "",
      softCopyAttachment: "",

      calibrationDueDate: "",
      senderName: "",
      numberOfCertificatesDocuments: "",
      dateOfDispatch: "",
      courierCompanyName: "",
      courierTrackingNumber: "",
      fullDestinationAddress: "",
      expectedDeliveryDate: "",
      attachment: "",
    });
    setShowCalibrationModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Helper function to compress image - more aggressive for large files
  const compressImage = (file, maxWidth = 1200, quality = 0.7) => {
    return new Promise((resolve) => {
      // If it's a PDF, skip compression and return original file
      if (file.type === "application/pdf") {
        resolve(file);
        return;
      }

      // More aggressive compression for large images
      const fileSizeMB = file.size / (1024 * 1024);
      let targetMaxWidth = maxWidth;
      let targetQuality = quality;

      if (fileSizeMB > 20) {
        targetMaxWidth = 800;
        targetQuality = 0.5;
      } else if (fileSizeMB > 10) {
        targetMaxWidth = 1000;
        targetQuality = 0.6;
      }

      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        let { width, height } = img;

        // Scale down if larger than maxWidth
        if (width > targetMaxWidth) {
          height = (height * targetMaxWidth) / width;
          width = targetMaxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          "image/jpeg",
          targetQuality
        );
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  // Convert ArrayBuffer to base64 - fast chunked method
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunkSize)
      );
    }
    return btoa(binary);
  };

  // Read file as ArrayBuffer
  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const uploadImageToDrive = async (file) => {
    try {
      // Compress image if it's an image file (not PDF)
      const processedFile = await compressImage(file);

      // Use fast base64 conversion
      const arrayBuffer = await readFileAsArrayBuffer(processedFile);
      const base64Data = arrayBufferToBase64(arrayBuffer);

      const fileName = `Invoice_${selectedTicket?.ticketId}_${Date.now()}.${file.type === "application/pdf" ? "pdf" : "jpg"
        }`;

      const uploadResponse = await fetch(`${sheet_url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "uploadFile",
          fileName: fileName,
          base64Data: base64Data,
          mimeType: processedFile.type || file.type,
          folderId: import.meta.env.VITE_DRIVE_FOLDER_ID,
        }),
      });

      const result = await uploadResponse.json();
      if (!result.success) {
        console.error("Upload error:", result.error);
        toast({
          title: "Error",
          description: "Failed to upload file to Google Drive",
          variant: "destructive",
        });
        return { success: false, error: result.error };
      }

      return result;
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
      return { success: false, error: "Failed to upload file" };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasData = (val) => val !== null && val !== undefined && String(val).trim() !== "";

    setIsSubmitting(true);
    let softCopyAttachmentFile = "";

    try {
      // Handle file uploads - upload if a new file is selected, allowing replacement
      if (formData.hardCopyAttachment instanceof File) {
        const uploadResult = await uploadImageToDrive(formData.hardCopyAttachment);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload hard copy");
        }
        hardCopyAttachmentFile = uploadResult.fileUrl;
      }

      if (formData.softCopyAttachment instanceof File) {
        const uploadResult = await uploadImageToDrive(formData.softCopyAttachment);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload soft copy");
        }
        softCopyAttachmentFile = uploadResult.fileUrl;
      }

      const currentDateTime = formatDateTime(new Date());
      const id = selectedTicket?.id;

      // Build columnData dynamically - only include keys for fields modified in the form
      const columnData = {};

      // AU: Actual 16 (Timestamp) - Only set if not already present and requirements met
      if (!hasData(selectedTicket.actual16)) {
        const softReady = (selectedTicket.softCopyStatus === "Yes") || formData.softCopyStatus;
        if (softReady) {
          columnData.AU = currentDateTime;
        }
      }

      // AW: Accountability Approval
      if (formData.accountabilityApporval) {
        columnData.AW = formData.accountabilityApporval;
      }


      // AZ: Soft Copy Status
      if (formData.softCopyStatus) {
        columnData.AZ = "Yes";
      }

      // BA: Soft Copy Attachment
      if (softCopyAttachmentFile) {
        columnData.BA = softCopyAttachmentFile;
      }

      // BB: Sender Name
      if (formData.senderName) {
        columnData.BB = formData.senderName;
      }

      // Only proceed if there's data to update
      if (Object.keys(columnData).length === 0) {
        toast({
          title: "Info",
          description: "No new changes to submit.",
        });
        setIsSubmitting(false);
        setShowCalibrationModal(false);
        return;
      }

      const response = await fetch(sheet_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          sheetId: Sheet_Id,
          sheetName: "Invoice",
          action: "update",
          rowIndex: (id + 6).toString(),
          columnData: JSON.stringify(columnData),
        }).toString(),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to update Google Sheet");
      }

      if (result.success) {
        if (formData.softCopyStatus) {
          console.log("Ram");

          setPendingData((prev) =>
            prev.filter((t) => t.ticketId !== selectedTicket.ticketId)
          );

          setHistoryData((prev) => [
            {
              ...selectedTicket,
              calibrationCertificatePlanDate:
                formData.calibrationCertificatePlanDate,
              certificateUpdatePerson: formData.accountabilityApporval,
              calibrationDate: formData.calibrationDate,
              softCopyStatus: formData.softCopyStatus || "",
              softCopyAttachmentFile: softCopyAttachmentFile || "",

              calibrationDueDate: formData.calibrationDueDate,

              senderName: formData.senderName,
              numberOfCertificates: formData.numberOfCertificatesDocuments,
              dateOfDispatch: formData.dateOfDispatch,
              courierCompanyName: formData.courierCompanyName,
              courierTrackingNumber: formData.courierTrackingNumber,
              fullDestinationAddress: formData.fullDestinationAddress,
              expectedDeliveryDate: formData.expectedDeliveryDate,
            },
            ...prev,
          ]);
        }

        // Add to historyData with the new calibration data

        setShowCalibrationModal(false);
        setFormData({
          clientName: "",
          phoneNumber: "",
          emailAddress: "",
          category: "",
          priority: "",
          title: "",
          softCopyStatus: "",
          softCopyAttachment: "",
          senderName: "",
          description: "",
          date: new Date().toISOString().split("T")[0],
        });

        toast({
          title: "Success",
          description: `Submitted successfully`,
        });
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
    } finally {
      setIsSubmitting(false);
      setShowCalibrationModal(false);
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
        selectedTicket.invoiceCategory || "", // Bill Number Input

        selectedTicket.title || "", // Machine Name
        selectedTicket.description || "", // Machine Name
        "Accountability Approval", // Enquiry Type (second one)
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
        setShowCalibrationModal(false);
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

  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
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

  const filteredPendingDataa = pendingData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q);
      return matchesSearch;
    })
    .reverse();

  const filteredHistoryDataa = historyData
    .filter((item) => {
      const q = searchItem.toLowerCase();
      const matchesSearch =
        String(item.ticketId || "").toLowerCase().includes(q) ||
        String(item.clientName || "").toLowerCase().includes(q) ||
        String(item.companyName || "").toLowerCase().includes(q) ||
        String(item.phoneNumber || "").toLowerCase().includes(q);
      return matchesSearch;
    })
    .reverse();

  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = JSON.parse(roleStorage);
  const role = parsedData.state.user.role;

  const filteredPendingData =
    role === "user"
      ? filteredPendingDataa.filter((item) => item["CREName"] === userName)
      : filteredPendingDataa;

  const filteredHistoryData =
    role === "user"
      ? filteredHistoryDataa.filter((item) => item["CREName"] === userName)
      : filteredHistoryDataa;

  // console.log("filteredPendingDataa", filteredPendingDataa);
  // console.log("filteredHistoryDataa", filteredHistoryDataa);

  return (
    <div className="space-y-2 sm:space-y-6">
      {/* Filter Options */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="sm:pt-6">
          <div className="flex flex-col items-end gap-4 md:flex-row">
            <div className="w-full">
              <Label
                htmlFor="searchFilter"
                className="text-sm font-medium text-blue-700"
              >
                Search (Ticket ID, Client, Company, Phone)
              </Label>
              <div className="relative mt-1">
                <Input
                  id="searchFilter"
                  placeholder="Search by ticket ID, client, company or phone..."
                  className="w-full py-2 pl-10 bg-white border-blue-200 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-search-filter"
                  onChange={(e) => setSearchItem(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <TabsTrigger
            value="pending"
            data-testid="tab-pending"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            Pending ({filteredPendingData.length})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            data-testid="tab-history"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            History ({filteredHistoryData.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-blue-800">
                Pending Shared Certificates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(100vh-321px)] overflow-y-auto">
                  <table className="hidden w-full sm:block">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Action
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Ticket ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Email Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Category
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation Pdf link
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Calibration Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Calibration Period (MONTH)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Calibration Upload
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={15}
                            className="py-8 text-center bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex items-center justify-center text-blue-700">
                                <LoaderIcon className="w-8 h-8 animate-spin" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending shared certificates found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredPendingData.map((ticket, ind) => (
                          <tr
                            key={ind}
                            className={
                              ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            }
                          >
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                onClick={() => handleCalibrationClick(ticket)}
                                variant="outline"
                                className="bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 hover:from-indigo-100 hover:to-blue-100 hover:text-indigo-700 transition-all duration-300 border border-indigo-200 hover:border-indigo-300 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md group"
                                data-testid={`button-calibration-${ticket.ticketId}`}
                              >
                                <span className="font-medium">Calibration</span>
                              </Button>
                            </td>
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationNo || `QT-${ticket.id}`}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.emailAddress}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceCategory}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                >
                                  View PDF
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.calibrationDate) || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.calibrationPeriodMonth || ""}
                            </td>

                            <td className="px-4 py-3">
                              {ticket.calibrationUploadFile ? (
                                <a
                                  href={ticket.calibrationUploadFile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                >
                                  View PDF
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="space-y-4 sm:hidden">
                    {filteredPendingData.length === 0 ? (
                      <div
                        className="py-8 text-center bg-white"
                        data-testid="text-no-pending"
                      >
                        {fetchLoading ? (
                          <div className="flex items-center justify-center text-blue-700">
                            <LoaderIcon className="w-8 h-8 animate-spin" />
                          </div>
                        ) : (
                          <h1 className="text-blue-700">
                            No pending shared certificates found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      filteredPendingData.map((ticket, ind) => (
                        <Card
                          key={ind}
                          className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-indigo-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header with Ticket ID and Action */}
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-lg font-bold text-blue-800">
                                  {ticket.ticketId}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {ticket.clientName}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleCalibrationClick(ticket)}
                                variant="outline"
                                className="text-indigo-600 border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100"
                              >
                                Calibration
                              </Button>
                            </div>

                            {/* Quotation & Contact Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Quotation No.
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationNo || `QT-${ticket.id}`}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                            </div>

                            {/* Email & Category */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Email
                                </p>
                                <p className="text-blue-900 truncate">
                                  {ticket.emailAddress || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Category
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceCategory || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Company Name */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Company Name
                              </p>
                              <p className="text-blue-900">
                                {ticket.companyName || "N/A"}
                              </p>
                            </div>

                            {/* Calibration Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Calibration Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.calibrationDate) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Calibration Period
                                </p>
                                <p className="text-blue-900">
                                  {ticket.calibrationPeriodMonth || "N/A"}{" "}
                                  months
                                </p>
                              </div>
                            </div>

                            {/* Document Links */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Quotation PDF
                                </p>
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-xs text-blue-900">N/A</p>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Calibration Upload
                                </p>
                                {ticket.calibrationUploadFile ? (
                                  <a
                                    href={ticket.calibrationUploadFile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-xs text-blue-900">N/A</p>
                                )}
                              </div>
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
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-blue-800">
                Shared Certificates History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(100vh-321px)] overflow-y-auto">
                  <table className="hidden w-full sm:block">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">
                          Ticket ID
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation No.
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Email Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Category
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation Pdf link
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Calibration Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Calibration Period (MONTH)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Calibration Upload
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Accountablity & Approval
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Screen Short
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Sender Name
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={26}
                            className="py-8 text-center bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex items-center justify-center text-blue-700">
                                <LoaderIcon className="w-8 h-8 animate-spin" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No shared certificates history found.
                              </h1>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryData.map((ticket, ind) => (
                          <tr
                            key={ind}
                            className={
                              ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            }
                          >
                            <td className="px-4 py-3 font-medium text-blue-800">
                              {ticket.ticketId}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.quotationNo || `QT-${ticket.id}`}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.emailAddress}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceCategory}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                >
                                  View PDF
                                </a>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.calibrationDate) || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.calibrationPeriodMonth || ""}
                            </td>

                            <td className="px-4 py-3">
                              {ticket.calibrationUploadFile ? (
                                <a
                                  href={ticket.calibrationUploadFile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                >
                                  View PDF
                                </a>
                              ) : (
                                ""
                              )}
                            </td>

                            <td className="px-4 py-3 text-blue-900">
                              {ticket.accountablityApproval || ""}
                            </td>

                            <td className="px-4 py-3">
                              {ticket.hardCopyStatus ? (
                                <a
                                  href={ticket.hardCopyStatus}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                >
                                  View PDF
                                </a>
                              ) : (
                                ""
                              )}
                            </td>

                            <td className="px-4 py-3 text-blue-900">
                              {ticket.senderName || ""}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile Card View */}
                  <div className="space-y-4 sm:hidden">
                    {filteredHistoryData.length === 0 ? (
                      <div
                        className="py-8 text-center bg-white"
                        data-testid="text-no-history"
                      >
                        {fetchLoading ? (
                          <div className="flex items-center justify-center text-blue-700">
                            <LoaderIcon className="w-8 h-8 animate-spin" />
                          </div>
                        ) : (
                          <h1 className="text-blue-700">
                            No shared certificates history found.
                          </h1>
                        )}
                      </div>
                    ) : (
                      filteredHistoryData.map((ticket, ind) => (
                        <Card
                          key={ind}
                          className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                            } border-l-4 border-l-indigo-500`}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div>
                              <h3 className="text-lg font-bold text-blue-800">
                                {ticket.ticketId}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {ticket.clientName}
                              </p>
                            </div>

                            {/* Quotation & Contact Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Quotation No.
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationNo || `QT-${ticket.id}`}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Phone
                                </p>
                                <p className="text-blue-900">
                                  {ticket.phoneNumber}
                                </p>
                              </div>
                            </div>

                            {/* Email & Category */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Email
                                </p>
                                <p className="text-blue-900 truncate">
                                  {ticket.emailAddress || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Category
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceCategory || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Company Name */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Company Name
                              </p>
                              <p className="text-blue-900">
                                {ticket.companyName || "N/A"}
                              </p>
                            </div>

                            {/* Calibration Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Calibration Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.calibrationDate) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Calibration Period
                                </p>
                                <p className="text-blue-900">
                                  {ticket.calibrationPeriodMonth || "N/A"}{" "}
                                  months
                                </p>
                              </div>
                            </div>

                            {/* Document Links */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Quotation PDF
                                </p>
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-xs text-blue-900">N/A</p>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Calibration Upload
                                </p>
                                {ticket.calibrationUploadFile ? (
                                  <a
                                    href={ticket.calibrationUploadFile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-xs text-blue-900">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Approval & Screenshot */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Accountability
                                </p>
                                <p className="text-blue-900">
                                  {ticket.accountablityApproval || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Screenshot
                                </p>
                                {ticket.hardCopyStatus ? (
                                  <a
                                    href={ticket.hardCopyStatus}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <p className="text-xs text-blue-900">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Sender Name */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Sender Name
                              </p>
                              <p className="text-blue-900">
                                {ticket.senderName || "N/A"}
                              </p>
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
        </TabsContent>
      </Tabs>

      {/* Calibration Modal */}
      <Modal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        title="Calibration Details"
        size="4xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto p-2"
        >
          <div className="flex items-center mb-10 space-x-2 md:col-span-3">
            <input
              type="checkbox"
              id="cancelTicket"
              checked={isCancelled}
              onChange={(e) => setIsCancelled(e.target.checked)}
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <Label htmlFor="cancelTicket" className="font-medium text-red-600">
              Cancel Ticket
            </Label>
          </div>


          {/* Pre-filled fields */}
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Ticket ID
            </Label>
            <Input
              value={formData.ticketId || ""}
              disabled
              className="text-gray-800 bg-gray-100 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Quotation No.
            </Label>
            <Input
              value={formData.quotationNo || ""}
              disabled
              className="text-gray-800 bg-gray-100 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Client Name
            </Label>
            <Input
              value={formData.clientName || ""}
              disabled
              className="text-gray-800 bg-gray-100 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Phone Number
            </Label>
            <Input
              value={formData.phoneNumber || ""}
              disabled
              className="text-gray-800 bg-gray-100 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Company Name
            </Label>
            <Input
              value={formData.companyName || ""}
              disabled
              className="text-gray-800 bg-gray-100 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Entry No.
            </Label>
            <Input
              value={formData.entryNo || ""}
              disabled
              className="text-gray-800 bg-gray-100 border-gray-300"
            />
          </div>

          {!isCancelled && (
            <>
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Certificate Copy Shared
                  <span className="text-red-500">*</span>
                </Label>
                <Select
                  onValueChange={(value) =>
                    handleInputChange("accountabilityApporval", value)
                  }
                >
                  <SelectTrigger
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    data-testid="select-person-name"
                  >
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {masterData.length > 0 &&
                      masterData[0]["Accountability & Approvals"] ? (
                      masterData[0]["Accountability & Approvals"].map(
                        (item, ind) => (
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
                      <SelectItem value="Loading" disabled>
                        Loading options...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Sender Name
                </Label>
                <Input
                  type="text"
                  placeholder="Enter certificate type"
                  value={formData.senderName || ""}
                  onChange={(e) =>
                    handleInputChange("senderName", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-certificate-type"
                />
              </div>


              {/* Soft Copy Status Checkbox and File Input */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="softCopyStatus"
                    checked={
                      selectedTicket?.softCopyAttachment ||
                      formData?.softCopyStatus ||
                      false
                    }
                    onChange={(e) =>
                      handleInputChange("softCopyStatus", e.target.checked)
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label
                    htmlFor="softCopyStatus"
                    className="flex items-center gap-5 text-sm font-medium text-gray-700"
                  >
                    <h1>Soft Copy Status</h1>
                    {selectedTicket?.softCopyAttachment && (
                      <a
                        href={selectedTicket?.softCopyAttachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View
                      </a>
                    )}
                  </Label>
                </div>
                {formData.softCopyStatus && (
                  <div className="mt-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Soft Copy Attachment
                    </Label>
                    <div className="flex flex-col space-y-2">
                      {selectedTicket.softCopyAttachment && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Current:</span>
                          <a
                            href={selectedTicket.softCopyAttachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-600 truncate max-w-[200px] hover:underline"
                          >
                            {selectedTicket.softCopyAttachment}
                          </a>
                        </div>
                      )}
                      <Input
                        type="file"
                        onChange={(e) =>
                          handleInputChange(
                            "softCopyAttachment",
                            e.target.files[0] || ""
                          )
                        }
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        data-testid="input-soft-copy-attachment"
                      />
                    </div>
                  </div>
                )}
              </div>


              <div className="flex justify-end pt-6 space-x-4 md:col-span-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCalibrationModal(false)}
                  className="px-6 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50"
                  data-testid="button-cancel-calibration"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700"
                  data-testid="button-submit-calibration"
                >
                  {isSubmitting ? (
                    <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Submit
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
                  className="px-8 py-3 text-white bg-red-600 hover:bg-red-700"
                >
                  {cancelSubmit && (
                    <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
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
