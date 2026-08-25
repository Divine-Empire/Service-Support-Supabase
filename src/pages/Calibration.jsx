import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useToast } from "../hooks/use-toast.js";
import { Loader2Icon, LoaderIcon, Search, RefreshCcw, Calendar, Filter, X, ChevronDown } from "lucide-react";
import { Textarea } from "../components/ui/textarea";

export default function Calibration() {
  const [activeTab, setActiveTab] = useState("pending");
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchItem, setSearchItem] = useState("");
  const [isCancelled, setIsCancelled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedClient, setSelectedClient] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const fetchInvoiceSheet = useCallback(async () => {
    setFetchLoading(true);
    try {
      // Add a cache-buster to ensure we get the latest data after updates
      const response = await fetch(`${sheet_url}?sheet=Invoice&t=${Date.now()}`);
      const json = await response.json();

      // Fetch Ticket_Enquiry data for Payment Term and Payment Mode
      const enquiryResponse = await fetch(`${sheet_url}?sheet=Ticket_Enquiry&t=${Date.now()}`);
      const enquiryJson = await enquiryResponse.json();

      let enquiryLookup = {};
      if (enquiryJson.success && Array.isArray(enquiryJson.data)) {
        // Ticket No is Col B (index 1)
        // Payment Term is Col AZ (index 51)
        // Payment Mode is Col BC (index 54)
        enquiryJson.data.slice(1).forEach(row => {
          const ticketNo = String(row[1] || "").trim();
          if (ticketNo) {
            enquiryLookup[ticketNo] = {
              paymentTerm: String(row[51] || "").trim(),
              paymentMode: String(row[54] || "").trim()
            };
          }
        });
      }

      if (json.success && Array.isArray(json.data)) {
        const allData = json.data.slice(6).map((row, index) => {
          // Helper to safely get and trim values from the row array
          const getValue = (idx) => {
            const val = row[idx];
            return val !== null && val !== undefined ? String(val).trim() : "";
          };

          const ticketId = getValue(1);
          const paymentInfo = enquiryLookup[ticketId] || { paymentTerm: "", paymentMode: "" };

          return {
            id: index + 1,
            timeStemp: getValue(0),
            ticketId: ticketId,
            quotationNo: getValue(2).replace(/^Quo:-/i, ""),
            clientName: getValue(3),
            phoneNumber: getValue(4),
            emailAddress: getValue(5),
            invoiceCategory: getValue(6),
            companyName: getValue(7),
            quotationPdfLink: getValue(8),
            invoicePostedBy: getValue(9),
            invoiceNoNABL: getValue(10),
            invoiceNoSERVICE: getValue(11),
            invoiceNoSPARE: getValue(12),
            spareInvoice: getValue(13),
            serviceInvoice: getValue(14),
            nablInvoice: getValue(15),
            nonNabl: getValue(16),
            invoiceAmountNABLBasic: getValue(17),
            invoiceAmountNABLGst: getValue(18),
            totalInvoiceAmtNonNABLBasic: getValue(19),
            totalInvoiceAmtNonNABLGst: getValue(20),
            serviceAmountBasic: getValue(21),
            totalServiceAmtSpare: getValue(22),
            totalServiceAmtSpareGst: getValue(23),
            attachmentService: getValue(24),
            attachmentSpear: getValue(25),
            attachmentNABL: getValue(26),
            billNo: getValue(27),
            billFile: getValue(28),
            basicAmount: getValue(29),
            totalAmountWithTex: getValue(30),
            planned13: getValue(31),
            actual13: getValue(32),
            delay13: getValue(33),
            otp: getValue(34),
            otpVarification: getValue(35),
            planned14: getValue(36),
            actual14: getValue(37),
            delay14: getValue(38),
            planned15: getValue(39),
            actual15: getValue(40),
            delay15: getValue(41),
            calibrationDate: getValue(42),
            calibrationPeriodMonth: getValue(43),
            calibrationUploadFile: getValue(44),
            calibrationDueDate: getValue(74), // Column BW (index 74)
            CREName: getValue(73),
            paymentTerm: paymentInfo.paymentTerm,
            paymentMode: paymentInfo.paymentMode,
          };
        });

        // FILTERING LOGIC (same as reference):
        // Pending = has planned15 AND actual15 is EMPTY
        // History = has planned15 AND actual15 is NOT EMPTY
        const pending = allData.filter(
          (item) => item.planned15 !== "" && item.actual15 === ""
        );

        const history = allData.filter(
          (item) => item.planned15 !== "" && item.actual15 !== ""
        );

        setPendingData(pending);
        setHistoryData(history);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load calibration data",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  }, [toast]);

  const fetchMasterSheet = useCallback(async () => {
    try {
      const response = await fetch(`${sheet_url}?sheet=Master`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data[0];
        const structuredData = {};

        // Initialize each header with an empty array
        headers.forEach((header) => {
          structuredData[header] = [];
        });

        // Process each data row (skip the header row)
        result.data.slice(1).forEach((row) => {
          row.forEach((value, index) => {
            const header = headers[index];
            if (value !== null && value !== undefined) {
              const stringValue = String(value).trim();
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

        setMasterData(structuredData);
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({
        title: "Error",
        description: "Failed to load master data",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchMasterSheet();
    fetchInvoiceSheet();
  }, [fetchMasterSheet, fetchInvoiceSheet]);

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
      calibrationDate: ticket.calibrationDate || "",
      calibrationPeriodMonth: ticket.calibrationPeriodMonth || "",
      calibrationDueDate: ticket.calibrationDueDate || "",
      calibrationUpload: null,
      cancelRemarks: "",
    });
    setIsCancelled(false);
    setShowCalibrationModal(true);
  };

  // 2. Add useEffect to calculate due date when calibration date or period changes
  useEffect(() => {
    const calculateDueDate = () => {
      if (formData.calibrationDate && formData.calibrationPeriodMonth) {
        try {
          const calibrationDate = new Date(formData.calibrationDate);
          const monthsToAdd = parseInt(formData.calibrationPeriodMonth, 10);

          if (!isNaN(monthsToAdd) && monthsToAdd > 0) {
            // Create a new date to avoid mutation issues
            const dueDate = new Date(calibrationDate);
            dueDate.setMonth(dueDate.getMonth() + monthsToAdd);

            // Handle edge case: If the day of month doesn't exist in target month
            if (dueDate.getDate() !== calibrationDate.getDate()) {
              // Set to last day of the month
              dueDate.setDate(0);
            }

            const formattedDueDate = dueDate.toISOString().split('T')[0];

            // Only update if different from current value
            if (formData.calibrationDueDate !== formattedDueDate) {
              handleInputChange("calibrationDueDate", formattedDueDate);
            }
          } else {
            handleInputChange("calibrationDueDate", "");
          }
        } catch (error) {
          console.error("Error calculating due date:", error);
          handleInputChange("calibrationDueDate", "");
        }
      } else {
        handleInputChange("calibrationDueDate", "");
      }
    };

    calculateDueDate();
  }, [formData.calibrationDate, formData.calibrationPeriodMonth]);


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

  // Convert ArrayBuffer chunk to base64
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

  // Upload a single chunk
  const uploadChunk = async (
    chunkData,
    fileName,
    chunkIndex,
    totalChunks,
    fileId,
    mimeType
  ) => {
    const response = await fetch(`${sheet_url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "uploadChunk",
        fileName: fileName,
        base64Data: chunkData,
        chunkIndex: chunkIndex.toString(),
        totalChunks: totalChunks.toString(),
        fileId: fileId,
        mimeType: mimeType,
        folderId: import.meta.env.VITE_DRIVE_FOLDER_ID,
      }),
    });
    return response.json();
  };

  // Main upload function with chunking support for large files
  const uploadImageToDrive = async (file) => {
    try {
      // Compress image if it's an image file (not PDF)
      const processedFile = await compressImage(file);
      const fileSizeMB = processedFile.size / (1024 * 1024);

      const fileName = `Calibration_${selectedTicket?.ticketId || "Unknown"}_${Date.now()}.${file.type === "application/pdf" ? "pdf" : "jpg"
        }`;
      const mimeType = processedFile.type || file.type;

      // For files smaller than 5MB, use direct upload
      if (fileSizeMB < 5) {
        const arrayBuffer = await readFileAsArrayBuffer(processedFile);
        const base64Data = arrayBufferToBase64(arrayBuffer);

        const uploadResponse = await fetch(`${sheet_url}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            action: "uploadFile",
            fileName: fileName,
            base64Data: base64Data,
            mimeType: mimeType,
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
      }

      // For larger files, use chunked upload
      const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (smaller for reliability)
      const arrayBuffer = await readFileAsArrayBuffer(processedFile);
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
      const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(
        `Starting chunked upload: ${fileSizeMB.toFixed(
          2
        )}MB in ${totalChunks} chunks`
      );

      let lastResult = null;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);
        const base64Chunk = arrayBufferToBase64(chunk);

        // Retry logic for each chunk
        let retries = 3;
        let chunkResult = null;

        while (retries > 0) {
          try {
            chunkResult = await uploadChunk(
              base64Chunk,
              fileName,
              i,
              totalChunks,
              fileId,
              mimeType
            );

            if (chunkResult.success) {
              console.log(
                `Chunk ${i + 1}/${totalChunks} uploaded successfully`
              );
              break;
            } else {
              throw new Error(chunkResult.error || "Chunk upload failed");
            }
          } catch (err) {
            retries--;
            if (retries === 0) {
              throw err;
            }
            console.log(
              `Retrying chunk ${i + 1}... (${retries} attempts left)`
            );
            await new Promise((r) => setTimeout(r, 1000)); // Wait 1s before retry
          }
        }

        lastResult = chunkResult;
      }

      // Return the final result which should contain the file URL
      if (lastResult && lastResult.success) {
        return lastResult;
      } else {
        throw new Error("Upload failed after all chunks");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: `Failed to upload file: ${error.message || "Unknown error"
          }`,
        variant: "destructive",
      });
      return {
        success: false,
        error: error.message || "Failed to upload file",
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate required fields
    if (!formData.calibrationDate) {
      toast({
        title: "Validation Error",
        description: "Calibration Date is required",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    let calibrationfileUrls = "";

    try {
      // Handle file upload if present
      if (formData.calibrationUpload) {
        const uploadResult = await uploadImageToDrive(formData.calibrationUpload);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload file");
        }
        calibrationfileUrls = uploadResult.fileUrl;

        toast({
          title: "Success",
          description: "File uploaded successfully!",
        });
      }

      // Prepare data for Google Sheets
      const currentDateTime = formatDateTime(new Date());
      const rowIndex = selectedTicket?.id ? (selectedTicket.id + 6).toString() : "0";

      const response = await fetch(sheet_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          sheetId: Sheet_Id,
          sheetName: "Invoice",
          action: "update",
          rowIndex: rowIndex,
          columnData: JSON.stringify({
            AO: currentDateTime, // Actual Completion Date
            AQ: formData.calibrationDate || "", // Calibration Date
            AR: formData.calibrationPeriodMonth || "", // Calibration Period (months)
            AS: calibrationfileUrls || "", // Calibration Upload URL
            BW: formData.calibrationDueDate || "", // Due Date - NEW FIELD
          }),
        }).toString(),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to update Google Sheet");
      }

      // Update local state
      setPendingData((prev) =>
        prev.filter((t) => t.ticketId !== selectedTicket.ticketId)
      );

      setHistoryData((prev) => [
        {
          ...selectedTicket,
          calibrationDate: formData.calibrationDate,
          calibrationPeriodMonth: formData.calibrationPeriodMonth,
          calibrationUploadFile: calibrationfileUrls,
          calibrationDueDate: formData.calibrationDueDate,
          actual15: currentDateTime,
        },
        ...prev,
      ]);

      toast({
        title: "Success",
        description: "Calibration details saved successfully!",
      });

      setShowCalibrationModal(false);
      setFormData({
        ticketId: "",
        quotationNo: "",
        clientName: "",
        phoneNumber: "",
        companyName: "",
        quotationPdfLink: "",
        entryNo: "",
        calibrationDate: "",
        calibrationPeriodMonth: "",
        calibrationDueDate: "",
        calibrationUpload: null,
        cancelRemarks: "",
      });

    } catch (error) {
      console.error("Error submitting calibration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save calibration details",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [cancelSubmit, setCancelSubmit] = useState(false);

  const handleSubmitCancel = async (e) => {
    e.preventDefault();
    setCancelSubmit(true);

    try {
      const currentDateTime = formatDateTime(new Date());
      const rowData = [
        currentDateTime,
        selectedTicket.ticketId || "",
        selectedTicket.clientName || "",
        selectedTicket.phoneNumber || "",
        selectedTicket.emailAddress || "",
        selectedTicket.invoiceCategory || "",
        "Calibration",
        formData.cancelRemarks || "",
      ];

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
        setPendingData((prevPending) =>
          prevPending.filter(
            (ticket) => ticket.ticketId !== selectedTicket.ticketId
          )
        );

        toast({
          title: "Success",
          description: "Ticket cancelled successfully",
        });

        setShowCalibrationModal(false);
        setIsCancelled(false);
      } else {
        throw new Error(result.error || "Failed to cancel ticket");
      }
    } catch (error) {
      console.error("Error cancelling ticket:", error);
      toast({
        title: "Error",
        description: "Failed to cancel ticket",
        variant: "destructive",
      });
    } finally {
      setCancelSubmit(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";

      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
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

  const activeData = activeTab === "pending" ? pendingData : historyData;

  const companyOptions = useMemo(() => {
    const companies = [...new Set(activeData.map(item => item.companyName))].filter(Boolean);
    return companies.sort();
  }, [activeData]);

  const clientOptions = useMemo(() => {
    const clients = [...new Set(activeData.map(item => item.clientName))].filter(Boolean);
    return clients.sort();
  }, [activeData]);

  const filterRecord = (item) => {
    // 1. Search filter
    const q = searchItem.toLowerCase();
    const matchesSearch = !searchItem || (
      String(item.ticketId || "").toLowerCase().includes(q) ||
      String(item.clientName || "").toLowerCase().includes(q) ||
      String(item.companyName || "").toLowerCase().includes(q) ||
      String(item.phoneNumber || "").toLowerCase().includes(q) ||
      String(item.quotationNo || "").toLowerCase().includes(q) ||
      String(item.invoiceNoSERVICE || "").toLowerCase().includes(q) ||
      String(item.invoiceNoNABL || "").toLowerCase().includes(q)
    );

    // 2. Company filter
    const matchesCompany = selectedCompany === "all" || item.companyName === selectedCompany;

    // 3. Client filter
    const matchesClient = selectedClient === "all" || item.clientName === selectedClient;

    // 4. Date range filter
    let matchesDate = true;
    if (startDate || endDate) {
      const itemDate = new Date(item.timeStemp);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) matchesDate = false;
      }
    }

    return matchesSearch && matchesCompany && matchesClient && matchesDate;
  };

  const filteredPendingDataa = pendingData
    .filter(filterRecord)
    .reverse();

  const filteredHistoryDataa = historyData
    .filter(filterRecord)
    .reverse();

  const userName = localStorage.getItem("currentUsername") || "";
  const roleStorage = localStorage.getItem("o2d-auth-storage");
  let role = "user";

  if (roleStorage) {
    try {
      const parsedData = JSON.parse(roleStorage);
      role = parsedData.state?.user?.role || "user";
    } catch (error) {
      console.error("Error parsing auth storage:", error);
    }
  }

  const filteredPendingData = (role === "user" || role === "engineer")
    ? filteredPendingDataa.filter((item) => item.CREName === userName)
    : filteredPendingDataa;

  const filteredHistoryData = (role === "user" || role === "engineer")
    ? filteredHistoryDataa.filter((item) => item.CREName === userName)
    : filteredHistoryDataa;

  // console.log("filteredPendingDataa", filteredPendingDataa);
  // console.log("filteredHistoryDataa", filteredHistoryDataa);

  // console.log("filteredPendingData", filteredPendingData);
  // console.log("filteredHistoryData", filteredHistoryData);

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col gap-4">
            
            {/* Top row: Title, Search & Refresh */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
              <h1 className="text-2xl font-bold text-blue-800 whitespace-nowrap">Calibration</h1>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 md:justify-end w-full md:w-auto">
                <div className="relative flex-1 max-w-md w-full">
                  <Input
                    id="searchFilter"
                    placeholder="Search by ticket ID, client, company, phone, quotation or invoice no..."
                    className="pl-10 py-2 w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                    data-testid="input-search-filter"
                    onChange={(e) => setSearchItem(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    fetchMasterSheet();
                    fetchInvoiceSheet();
                  }}
                  disabled={fetchLoading}
                  className="bg-white border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 shadow-sm flex items-center gap-2 px-4 whitespace-nowrap"
                >
                  <RefreshCcw className={`w-4 h-4 ${fetchLoading ? "animate-spin" : ""}`} />
                  <span>Refresh Records</span>
                </Button>
              </div>
            </div>

            {/* Bottom row: Tabs triggers & Filters */}
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 w-full border-t border-blue-100/50 pt-4">
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 w-full lg:w-auto">
                <TabsTrigger
                  value="pending"
                  data-testid="tab-pending"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex-1 lg:flex-none"
                >
                  Pending ({filteredPendingData.length})
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  data-testid="tab-history"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex-1 lg:flex-none"
                >
                  History ({filteredHistoryData.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                {/* Company Filter */}
                <div className="w-[180px]">
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger className="bg-white border-blue-200 text-blue-900">
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="all">All Companies</SelectItem>
                      {companyOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Client Filter */}
                <div className="w-[180px]">
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="bg-white border-blue-200 text-blue-900">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="all">All Clients</SelectItem>
                      {clientOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Filter */}
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className={`bg-white border-blue-200 text-blue-600 hover:bg-blue-50 ${startDate || endDate ? "border-blue-500 ring-1 ring-blue-500" : ""
                      }`}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {startDate || endDate ? "Date Active" : "Date"}
                    <ChevronDown className={`w-3 h-3 ml-2 transition-transform ${showDatePicker ? "rotate-180" : ""}`} />
                  </Button>

                  {showDatePicker && (
                    <div className="absolute right-0 top-full mt-2 p-4 bg-white border border-blue-200 rounded-lg shadow-xl z-50 w-72 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-900">Filter by Invoice Date</span>
                        <Button variant="ghost" size="sm" onClick={() => setShowDatePicker(false)} className="h-6 w-6 p-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-blue-600">Start Date</Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-blue-600">End Date</Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="flex-1 text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setStartDate("");
                            setEndDate("");
                          }}
                        >
                          Clear
                        </Button>
                        <Button
                          variant="default"
                          className="flex-1 text-xs h-8 bg-blue-600 hover:bg-blue-700"
                          onClick={() => setShowDatePicker(false)}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset All */}
                {(selectedCompany !== "all" || selectedClient !== "all" || startDate || endDate) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedCompany("all");
                      setSelectedClient("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                  >
                    <Filter className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mt-2">
              <TabsContent value="pending" className="mt-0 border-0 p-0 shadow-none">
                <div className="relative overflow-x-auto">
                  <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
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
                          Invoice date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Company Name
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice No (Sevice)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice No (NABL)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Payment Term
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Payment Mode
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice Copy (Service)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice Copy (NABL)
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Quotation Pdf link
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {filteredPendingData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={17}
                            className="py-8 text-center bg-white"
                            data-testid="text-no-pending"
                          >
                            {fetchLoading ? (
                              <div className="flex items-center justify-center text-blue-700">
                                <LoaderIcon className="w-8 h-8 animate-spin" />
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
                              {formatDate(ticket.timeStemp) || "—"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>

                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceNoSERVICE}
                            </td>

                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceNoNABL}
                            </td>
                            <td className="px-4 py-3 text-blue-900 border-l border-blue-100">
                              {ticket.paymentTerm || "—"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.paymentMode || "—"}
                            </td>

                            <td className="px-4 py-3">
                              {ticket.attachmentService ? (
                                <a
                                  href={ticket.attachmentService}
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

                            <td className="px-4 py-3">
                              {ticket.attachmentNABL ? (
                                <a
                                  href={ticket.attachmentNABL}
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

                            {/* Quotation & Company Info */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Payment Term
                                </p>
                                <p className="text-blue-900 border-b border-blue-50">
                                  {ticket.paymentTerm || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Payment Mode
                                </p>
                                <p className="text-blue-900 border-b border-blue-50">
                                  {ticket.paymentMode || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Quotation & Company Info */}
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
                                  Invoice date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.timeStemp) || "—"}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <p className="font-medium text-gray-500">
                                  Company
                                </p>
                                <p className="text-blue-900">
                                  {ticket.companyName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Contact Info */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Phone Number
                              </p>
                              <p className="text-blue-900">
                                {ticket.phoneNumber}
                              </p>
                            </div>

                            {/* Invoice Numbers */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Service Invoice
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceNoSERVICE || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  NABL Invoice
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceNoNABL || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Document Links */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Service Invoice
                                </p>
                                {ticket.attachmentService ? (
                                  <a
                                    href={ticket.attachmentService}
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
                                  NABL Invoice
                                </p>
                                {ticket.attachmentNABL ? (
                                  <a
                                    href={ticket.attachmentNABL}
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

                            {/* Quotation PDF */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Quotation PDF
                              </p>
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  View Quotation PDF
                                </a>
                              ) : (
                                <p className="text-sm text-blue-900">N/A</p>
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

            <TabsContent value="history" className="mt-0 border-0 p-0 shadow-none">
              <div className="relative overflow-x-auto">
                <div className="max-h-[calc(103vh-200px)] overflow-y-auto">
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
                          Invoice date
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Company Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Client Name
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Phone Number
                        </th>

                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice No (Sevice)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice No (NABL)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Payment Term
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Payment Mode
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice Copy (Service)
                        </th>
                        <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                          Invoice Copy (NABL)
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
                          Due Date
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
                              {formatDate(ticket.timeStemp) || "—"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.companyName || ""}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.clientName}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.phoneNumber}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceNoSERVICE}
                            </td>

                            <td className="px-4 py-3 text-blue-900">
                              {ticket.invoiceNoNABL}
                            </td>
                            <td className="px-4 py-3 text-blue-900 border-l border-blue-100">
                              {ticket.paymentTerm || "—"}
                            </td>
                            <td className="px-4 py-3 text-blue-900">
                              {ticket.paymentMode || "—"}
                            </td>

                            <td className="px-4 py-3">
                              {ticket.attachmentService ? (
                                <a
                                  href={ticket.attachmentService}
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

                            <td className="px-4 py-3">
                              {ticket.attachmentNABL ? (
                                <a
                                  href={ticket.attachmentNABL}
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
                              {formatDate(ticket.calibrationDueDate) || ""}
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
                              <h3 className="text-lg font-bold text-blue-800">
                                {ticket.ticketId}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {ticket.clientName}
                              </p>
                            </div>

                            {/* Quotation & Company Info */}
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
                                  Invoice date
                                </p>
                                <p className="text-blue-900">
                                  {formatDate(ticket.timeStemp) || "—"}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <p className="font-medium text-gray-500">
                                  Company
                                </p>
                                <p className="text-blue-900">
                                  {ticket.companyName || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Contact Info */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Phone Number
                              </p>
                              <p className="text-blue-900">
                                {ticket.phoneNumber}
                              </p>
                            </div>

                            {/* Payment Info */}
                            <div className="grid grid-cols-2 gap-2 text-sm border-t border-blue-50/50 pt-2">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Payment Term
                                </p>
                                <p className="text-blue-900">
                                  {ticket.paymentTerm || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  Payment Mode
                                </p>
                                <p className="text-blue-900">
                                  {ticket.paymentMode || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Invoice Numbers */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Service Invoice
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceNoSERVICE || "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  NABL Invoice
                                </p>
                                <p className="text-blue-900">
                                  {ticket.invoiceNoNABL || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Document Links */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">
                                  Service Invoice
                                </p>
                                {ticket.attachmentService ? (
                                  <a
                                    href={ticket.attachmentService}
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
                                  NABL Invoice
                                </p>
                                {ticket.attachmentNABL ? (
                                  <a
                                    href={ticket.attachmentNABL}
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

                            {/* Quotation PDF */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Quotation PDF
                              </p>
                              {ticket.quotationPdfLink ? (
                                <a
                                  href={ticket.quotationPdfLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  View Quotation PDF
                                </a>
                              ) : (
                                <p className="text-sm text-blue-900">N/A</p>
                              )}
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

                            {/* Calibration Upload */}
                            <div>
                              <p className="text-sm font-medium text-gray-500">
                                Calibration Certificate
                              </p>
                              {ticket.calibrationUploadFile ? (
                                <a
                                  href={ticket.calibrationUploadFile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  View Calibration Certificate
                                </a>
                              ) : (
                                <p className="text-sm text-blue-900">N/A</p>
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
          <div className="flex items-center mb-10 space-x-2">
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

          <div></div>

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
                  Calibration Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.calibrationDate || ""}
                  onChange={(e) =>
                    handleInputChange("calibrationDate", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-calibration-date"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Calibration Upload
                </Label>
                <div className="flex items-center gap-3">
                  {/* Real Hidden Input */}
                  <input
                    type="file"
                    id="calibration-file-input"
                    className="hidden"
                    onChange={(e) =>
                      handleInputChange(
                        "calibrationUpload",
                        e.target.files[0] || ""
                      )
                    }
                    data-testid="input-calibration-copy"
                  />

                  {/* Custom Styled Trigger */}
                  <label
                    htmlFor="calibration-file-input"
                    className={`flex-1 flex items-center h-10 px-3 border border-gray-300 rounded-md cursor-pointer transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/30 ${formData.calibrationUpload ? "bg-blue-50/50" : "bg-white"
                      }`}
                  >
                    <div className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded mr-3 uppercase tracking-wider shadow-sm hover:bg-blue-700 active:scale-95 transition-all">
                      Upload File
                    </div>
                    <span className={`text-sm truncate ${formData.calibrationUpload ? "text-blue-700 font-medium" : "text-gray-400"}`}>
                      {formData.calibrationUpload ? formData.calibrationUpload.name : "No file chosen"}
                    </span>
                  </label>

                  {/* Clear Button (Optional but helpful) */}
                  {formData.calibrationUpload && (
                    <button
                      type="button"
                      onClick={() => handleInputChange("calibrationUpload", "")}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Clear file"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Calibration Period (MONTH)
                </Label>
                <Input
                  type="number"
                  placeholder="Enter number"
                  value={formData.calibrationPeriodMonth || ""}
                  onChange={(e) =>
                    handleInputChange("calibrationPeriodMonth", e.target.value)
                  }
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  data-testid="input-calibration-period-month"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-700">
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={formData.calibrationDueDate || ""}
                  disabled // Make it read-only since it's auto-calculated
                  className="text-gray-800 bg-gray-100 border-gray-300"
                  data-testid="input-calibration-due-date"
                />
                {/* <p className="text-xs text-gray-500 mt-1">
                  Calculated automatically from Calibration Date + Calibration Period
                </p> */}
              </div>

              <div className="flex justify-end pt-6 space-x-4 md:col-span-2">
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
