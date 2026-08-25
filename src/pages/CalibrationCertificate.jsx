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

export default function CalibrationCertificate() {
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

          planned17: row[54],
          actual17: row[55],
          delay17: row[56],
          certificateTypeName: row[57],
          numberOfCertificatesDocuments: row[58],
          fullDestinationAddress: row[59],
          dateOfDispatch: row[60],
          courierCompanyName: row[61],
          courierTrackingNumber: row[62],
          expectedDeliveryDate: row[63],
          calibrationCertificateAttachment: row[64],
          CREName: row[73],
        }));

        // Filter data based on your conditions

        // console.log("Alldata", allData);

        const pending = allData.filter(
          (item) => item.planned17 !== "" && item.actual17 === ""
        );

        const history = allData.filter(
          (item) => item.planned17 !== "" && item.actual17 !== ""
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
      certificateUpdatePersonName: "",
      calibrationDate: "",
      calibrationUpload: "",
      calibrationDueDate: "",
      certificateTypeName: "",
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // if (!formData.clientName || !formData.phoneNumber || !formData.title) {
    //   toast({
    //     title: "Error",
    //     description: "Please fill in all required fields",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    setIsSubmitting(true);

    let attachmentfileUrls = "";

    // Handle all file uploads

    if (formData.attachment) {
      const uploadResult = await uploadImageToDrive(formData.attachment);
      if (!uploadResult.success) {
        throw new Error(
          uploadResult.error || "Failed to upload calibration copy"
        );
      }
      attachmentfileUrls = uploadResult.fileUrl;
    }

    const currentDateTime = formatDateTime(new Date());
    const id = selectedTicket?.id;

    try {
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
          columnData: JSON.stringify({
            BD: currentDateTime,
            BF: formData.certificateTypeName || "",
            BG: formData.numberOfCertificatesDocuments || "",
            BH: formData.fullDestinationAddress || "",

            BI: formData.dateOfDispatch || "",
            BJ: formData.courierCompanyName || "",
            BK: formData.courierTrackingNumber || "",
            BL: formData.expectedDeliveryDate || "",
            BM: attachmentfileUrls || "",
          }),
        }).toString(),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to update Google Sheet");
      }

      if (result.success) {
        setPendingData((prev) =>
          prev.filter((t) => t.id !== selectedTicket.id)
        );

        // Add to historyData with the new calibration data
        setHistoryData((prev) => [
          {
            ...selectedTicket,
            calibrationCertificatePlanDate:
              formData.calibrationCertificatePlanDate,
            certificateUpdatePerson: formData.certificateUpdatePersonName,
            calibrationDate: formData.calibrationDate,
            attachment: attachmentfileUrls || "",
            calibrationDueDate: formData.calibrationDueDate,

            certificateTypeName: formData.certificateTypeName,
            numberOfCertificates: formData.numberOfCertificatesDocuments,
            dateOfDispatch: formData.dateOfDispatch,
            courierCompanyName: formData.courierCompanyName,
            courierTrackingNumber: formData.courierTrackingNumber,
            fullDestinationAddress: formData.fullDestinationAddress,
            expectedDeliveryDate: formData.expectedDeliveryDate,
          },
          ...prev,
        ]);

        setShowCalibrationModal(false);
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
        "Calibration Certificate", // Enquiry Type (second one)
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

  const filteredPendingData = role === "user" ? filteredPendingDataa.filter(
    (item) => item["CREName"] === userName
  ) : filteredPendingDataa;


  const filteredHistoryData = role === "user" ? filteredHistoryDataa.filter(
    (item) => item["CREName"] === userName
  ) : filteredHistoryDataa;

  // console.log("filteredPendingDataa", filteredPendingDataa);
  // console.log("filteredHistoryDataa", filteredHistoryDataa);

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Left Side: Tabs buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
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
            </div>

            {/* Right Side: Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 md:justify-end w-full md:w-auto">
              <div className="relative flex-1 max-w-md w-full">
                <Input
                  id="searchFilter"
                  placeholder="Search by ticket ID, client, company or phone..."
                  className="pl-10 py-2 w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                  data-testid="input-search-filter"
                  onChange={(e) => setSearchItem(e.target.value)}
                />
              </div>
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
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={15}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No pending calibrations found.
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
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
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
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
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
                              {ticket.screenShort ? (
                                <a
                                  href={ticket.screenShort}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
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
                  <div className="sm:hidden space-y-4">
                    {filteredPendingData.length === 0 ? (
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
                            No pending calibrations found.
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
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
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
                                className="bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200"
                              >
                                Calibration
                              </Button>
                            </div>

                            {/* Quotation & Contact Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Quotation No.
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationNo || `QT-${ticket.id}`}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
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
                                <p className="text-gray-500 font-medium">
                                  Email
                                </p>
                                <p className="text-blue-900 truncate">
                                  {ticket.emailAddress || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Category
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceCategory || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Company Name */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Company Name
                              </p>
                              <p className="text-blue-900">
                                {ticket.companyName || "N/A"}
                              </p>
                            </div>

                            {/* Calibration Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Calibration Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.calibrationDate) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
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
                                <p className="text-gray-500 font-medium">
                                  Quotation PDF
                                </p>
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-blue-900 text-xs">N/A</p>
                                )}
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Calibration Upload
                                </p>
                                {ticket.calibrationUploadFile ? (
                                  <a
                                    href={ticket.calibrationUploadFile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-blue-900 text-xs">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Approval & Screenshot */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Accountability
                                </p>
                                <p className="text-blue-900">
                                  {ticket.accountablityApproval || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Screenshot
                                </p>
                                {ticket.screenShort ? (
                                  <a
                                    href={ticket.screenShort}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <p className="text-blue-900 text-xs">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Sender Name */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
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
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
                  <table className="hidden sm:block w-full">
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

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Certificate Type/Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Number of Certificates/Documents
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Full Destination Address
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Date of Dispatch
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Courier Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Courier Tracking Number
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Expected Delivery Date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Attachment
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredHistoryData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={26}
                            className="text-center py-8 bg-white"
                            data-testid="text-no-history"
                          >
                            {fetchLoading ? (
                              <div className="flex justify-center items-center text-blue-700">
                                <LoaderIcon className="animate-spin w-8 h-8" />
                              </div>
                            ) : (
                              <h1 className="text-blue-700">
                                No calibration history found.
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
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
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
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
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
                              {ticket.screenShort ? (
                                <a
                                  href={ticket.screenShort}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
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

                            <td className="px-4 py-3 text-blue-900">
                              {ticket.certificateTypeName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.numberOfCertificatesDocuments || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.fullDestinationAddress || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.dateOfDispatch) || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.courierCompanyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.courierTrackingNumber || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {formatDate(ticket.expectedDeliveryDate) || ""}
                            </td>
                            <td className="px-4 py-3">
                              {ticket.calibrationCertificateAttachment ? (
                                <a
                                  href={ticket.calibrationCertificateAttachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                >
                                  View
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
                  <div className="sm:hidden space-y-4">
                    {filteredHistoryData.length === 0 ? (
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
                            No calibration history found.
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
                              <h3 className="font-bold text-blue-800 text-lg">
                                {ticket.ticketId}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {ticket.clientName}
                              </p>
                            </div>

                            {/* Quotation & Contact Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Quotation No.
                                </p>
                                <p className="text-blue-900">
                                  {ticket.quotationNo || `QT-${ticket.id}`}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
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
                                <p className="text-gray-500 font-medium">
                                  Email
                                </p>
                                <p className="text-blue-900 truncate">
                                  {ticket.emailAddress || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Category
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceCategory || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Company Name */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Company Name
                              </p>
                              <p className="text-blue-900">
                                {ticket.companyName || "N/A"}
                              </p>
                            </div>

                            {/* Calibration Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Calibration Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.calibrationDate) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
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
                                <p className="text-gray-500 font-medium">
                                  Quotation PDF
                                </p>
                                {ticket.quotationPdfLink ? (
                                  <a
                                    href={ticket.quotationPdfLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-blue-900 text-xs">N/A</p>
                                )}
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Calibration Upload
                                </p>
                                {ticket.calibrationUploadFile ? (
                                  <a
                                    href={ticket.calibrationUploadFile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    View PDF
                                  </a>
                                ) : (
                                  <p className="text-blue-900 text-xs">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Approval & Screenshot */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Accountability
                                </p>
                                <p className="text-blue-900">
                                  {ticket.accountablityApproval || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Screenshot
                                </p>
                                {ticket.screenShort ? (
                                  <a
                                    href={ticket.screenShort}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <p className="text-blue-900 text-xs">N/A</p>
                                )}
                              </div>
                            </div>

                            {/* Sender Name */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Sender Name
                              </p>
                              <p className="text-blue-900">
                                {ticket.senderName || "N/A"}
                              </p>
                            </div>

                            {/* Certificate Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Certificate Type
                                </p>
                                <p className="text-blue-900">
                                  {ticket.certificateTypeName || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  No. of Certificates
                                </p>
                                <p className="text-blue-900">
                                  {ticket.numberOfCertificatesDocuments ||
                                    "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Destination Address */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Destination Address
                              </p>
                              <p className="text-blue-900 line-clamp-2">
                                {ticket.fullDestinationAddress || "N/A"}
                              </p>
                            </div>

                            {/* Courier Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Dispatch Date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.dateOfDispatch) || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Courier Company
                                </p>
                                <p className="text-blue-900">
                                  {ticket.courierCompanyName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Tracking Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Tracking Number
                                </p>
                                <p className="text-blue-900">
                                  {ticket.courierTrackingNumber || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 font-medium">
                                  Expected Delivery
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.expectedDeliveryDate) ||
                                    "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Certificate Attachment */}
                            <div>
                              <p className="text-gray-500 font-medium text-sm">
                                Certificate Attachment
                              </p>
                              {ticket.calibrationCertificateAttachment ? (
                                <a
                                  href={ticket.calibrationCertificateAttachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View Certificate
                                </a>
                              ) : (
                                <p className="text-blue-900 text-sm">N/A</p>
                              )}
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

      {/* Calibration Modal */}
      <Modal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        title="Calibration Details"
        size="4xl"
      >
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto p-2"
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
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Ticket ID
            </Label>
            <Input
              value={formData.ticketId || ""}
              disabled
              className="bg-gray-100 text-gray-800 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Quotation No.
            </Label>
            <Input
              value={formData.quotationNo || ""}
              disabled
              className="bg-gray-100 text-gray-800 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Client Name
            </Label>
            <Input
              value={formData.clientName || ""}
              disabled
              className="bg-gray-100 text-gray-800 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Phone Number
            </Label>
            <Input
              value={formData.phoneNumber || ""}
              disabled
              className="bg-gray-100 text-gray-800 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Company Name
            </Label>
            <Input
              value={formData.companyName || ""}
              disabled
              className="bg-gray-100 text-gray-800 border-gray-300"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">
              Entry No.
            </Label>
            <Input
              value={formData.entryNo || ""}
              disabled
              className="bg-gray-100 text-gray-800 border-gray-300"
            />
          </div>

          {!isCancelled && (
            <>
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Certificate Type/Name
                </Label>
                <Input
                  placeholder="Enter certificate type"
                  value={formData.certificateTypeName || ""}
                  onChange={(e) =>
                    handleInputChange("certificateTypeName", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-certificate-type"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Number of Certificates/Documents
                </Label>
                <Input
                  type="number"
                  placeholder="Enter number"
                  value={formData.numberOfCertificatesDocuments || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "numberOfCertificatesDocuments",
                      e.target.value
                    )
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-certificate-count"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Date of Dispatch
                </Label>
                <Input
                  type="date"
                  value={formData.dateOfDispatch || ""}
                  onChange={(e) =>
                    handleInputChange("dateOfDispatch", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-dispatch-date"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Courier Company Name
                </Label>
                <Input
                  placeholder="Enter courier company"
                  value={formData.courierCompanyName || ""}
                  onChange={(e) =>
                    handleInputChange("courierCompanyName", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-courier-company"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Courier Tracking Number
                </Label>
                <Input
                  placeholder="Enter tracking number"
                  value={formData.courierTrackingNumber || ""}
                  onChange={(e) =>
                    handleInputChange("courierTrackingNumber", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-tracking-number"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Full Destination Address
                </Label>
                <Input
                  placeholder="Enter full address"
                  value={formData.fullDestinationAddress || ""}
                  onChange={(e) =>
                    handleInputChange("fullDestinationAddress", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-destination-address"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Expected Delivery Date
                </Label>
                <Input
                  type="date"
                  value={formData.expectedDeliveryDate || ""}
                  onChange={(e) =>
                    handleInputChange("expectedDeliveryDate", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-delivery-date"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Attachment
                </Label>
                <div className="relative">
                  <Input
                    type="file"
                    onChange={(e) =>
                      handleInputChange("attachment", e.target.files[0] || "")
                    }
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    data-testid="input-attachment"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCalibrationModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50"
                  data-testid="button-cancel-calibration"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-submit-calibration"
                >
                  {isSubmitting ? (
                    <Loader2Icon className="animate-spin mr-2 h-4 w-4" />
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
