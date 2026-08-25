import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle2,
  PhoneCall,
  FileText,
  MapPin,
  Receipt,
  CreditCard,
  Loader2Icon,
} from "lucide-react";
import { set } from "date-fns";
import toast from "react-hot-toast";

// Define all Service-Support stages
const serviceStages = [
  { id: 2, name: "Video Call Solution", color: "bg-purple-500", start: 31, actual: 32, delay: 33, responsible: "PIYUSH TIWARI / Assigned Engineer", route: "/videocall" },
  { id: 4, name: "Quotation", color: "bg-cyan-500", start: 37, actual: 38, delay: 39, responsible: "PIYUSH TIWARI", route: "/quotation" },
  { id: 5, name: "Follow-Up", color: "bg-teal-500", start: 47, actual: 48, delay: -1, responsible: "PIYUSH TIWARI", route: "/followup" },
  { id: 6, name: "Site Visit Plan", color: "bg-emerald-500", start: 61, actual: 62, delay: 63, responsible: "PIYUSH TIWARI", route: "/siteplan" },
  { id: 7, name: "Invoice", color: "bg-amber-500", start: 111, actual: 112, delay: 113, responsible: "Accountant", route: "/invoice" }
];


export default function Dashboard() {
  const navigate = useNavigate();
  const [allTickets, setAllTickets] = React.useState([]);
  const [fetchLoading, setFetchLoading] = React.useState(false);
  const [priorityData, setPriorityData] = React.useState([]);
  const [quataionData, setQuataionData] = React.useState([]);
  const [invoiceData, setInvoiceData] = React.useState([]);
  const [siteVisitData, setSiteVisitData] = React.useState([]);
  const [engineerData, setEngineerData] = React.useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [warrantyCheckData, setWarrantyCheckData] = useState([]);
  const [stageCounts, setStageCounts] = useState({});
  const [stageOverdueCounts, setStageOverdueCounts] = useState({});
  const [followUpCategoryBreakdown, setFollowUpCategoryBreakdown] = useState({});
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Weekly Report state
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [weeklyReportData, setWeeklyReportData] = useState(null);
  const [weeklyStartDate, setWeeklyStartDate] = useState("");
  const [weeklyEndDate, setWeeklyEndDate] = useState("");

  const COLORS = ["#10B981", "#F59E0B", "#EF4444", "#3B82F6"];

  const sheet_url =
    import.meta.env.VITE_APPS_SCRIPT_API;
  const Sheet_Id = import.meta.env.VITE_GOOGLE_SHEET_ID;

  const fetchData = async () => {
    setFetchLoading(true); // start loading
    try {
      const response = await fetch(`${sheet_url}?sheet=Ticket_Enquiry`);
      const json = await response.json();

      if (json.success && Array.isArray(json.data)) {
        // Process the data to match your requirements
        const allData = json.data.slice(6).map((row, index) => ({
          id: index + 1,
          timeStemp: row[0],
          ticketId: row[1], // Column A (assuming this is Ticket id)
          clientName: row[2], // Column C
          phoneNumber: row[3], // Column D
          emailAddress: row[4], // Column E
          category: row[5], // Column F
          priority: row[6], // Column G
          title: row[7], // Column H
          description: row[8], // Column I
          planned1: row[9], // Column J
          actual1: row[10], // Column K

          delay1: row[11], // Delay1
          callType: row[12], // Call type
          requirementServiceCategory: row[13], // Enquiry Type (first one)
          videoCall: row[14], // Enquiry Type (first one)

          sourceOfEnquiry: row[15], // Source of enquiry
          enquiryReceiverName: row[16], // Enquiry Receiver Name
          warrantyCheck: row[17], // Warranty Check
          billNumberInput: row[18], // Bill Number Input

          billAttachmentFile: row[19], // Bill Number Input

          machineName: row[20], // Machine Name
          enquiryType: row[21], // Enquiry Type (second one)
          siteName: row[22], // Site Name
          companyName: row[23], // Company Name
          siteAddress: row[24], // Site Address
          gstAddress: row[25], // Billing Address
          state: row[26], // State
          pinCode: row[27], // PIN Code
          engineerAssign: row[28], // Engineer Name
          serviceLocation: row[29], // Service Location
          uploadChallan: row[30],

          planned2: row[31],
          actual2: row[32],
          delay2: row[33],
          videoCallServicesSolve: row[34],
          afterVideoCallGenerateOTP: row[35],
          otpVarificationStatus: row[36],

          planned3: row[37],
          actual3: row[38],
          delay3: row[39],
          quotationNo: row[40],
          basicAmount: row[41],
          totalAmoutWithTex: row[42],
          quotationPdfLink: row[43],
          quotationShareByPersonName: row[44],
          ShareThrough: row[45],
          quotationremarks: row[46],

          planned4: row[47],
          actual4: row[48],
          stage: row[50],
          paymentTerm: row[51],
          acceptanceVia: row[52],
          acceptanceAttachemntFile: row[53],
          paymentMode: row[54],
          seniorApproval: row[55],
          approvalAttachmentFile: row[56],
          whatDidTheCustomerSay: row[57],
          nextAction: row[58],
          nextDateOfCall: row[59],
          followUpRemarks: row[60],

          planned5: row[61],
          actual5: row[62],
          delay5: row[63],
          dateOfVisit: row[64],
          transportation: row[65],

          planned6: row[66],
          actual6: row[67],
          spareDetails: row[69],
          dnCopyFileUpload: row[70],
          dnNumber: row[71],
          serviceAssets: row[72],
          equipmentName: row[73],
          attachment: row[74],
          machineReceiverName: row[75],
          machineReceiverNumber: row[76],
          challanAttachment: row[77],
          invoiceStatus: row[78],

          planned7: row[79],
          actual7: row[80],
          delay7: row[81],
          travelDate: row[82],
          returnDate: row[83],
          destinationInput: row[84],
          purposeOfTravel: row[85],
          amount: row[86],

          planned8: row[87],
          actual8: row[88],
          delay8: row[89],
          nameSiniorBy: row[90],

          planned9: row[91],
          actual9: row[92],
          delay9: row[93],
          sitevisitName: row[94],
          lastBalance: row[95],
          payRightNow: row[96],
          billFile: row[97],
          siteVisitByAccountRemarks: row[98],

          planned10: row[99],
          actual10: row[100],
          delay10: row[101],
          sitevisitDate: row[102],
          otpVerification: row[103],
          verificationStatus: row[104],

          planned11: row[105],
          actual11: row[106],
          delay11: row[107],
          serviceReportFile: row[108],
          engineerRemarks: row[109],
          quatationReceive: row[110],

          planned12: row[111],
          actual12: row[112],
          delay12: row[113],

          CREName: row[127],
        }));

        const userName = localStorage.getItem("currentUsername");

        const roleStorage = localStorage.getItem("o2d-auth-storage");
        const parsedData = JSON.parse(roleStorage);
        const role = parsedData.state.user.role;

        const allDataTotal =
          role === "user"
            ? allData.filter((item) => item["CREName"] === userName)
            : role === "engineer"
              ? allData.filter((item) => item["engineerAssign"] === userName)
              : allData;

        setAllTickets(allDataTotal);

        // Calculate Pending Items by Stage
        const counts = {};
        const overdueCounts = {};
        const followUpCategories = {}; // { categoryName: { pending: 0, overdue: 0 } }
        serviceStages.forEach((stage) => {
          counts[stage.name] = 0;
          overdueCounts[stage.name] = 0;
        });

        const cellHasValue = (val) => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'string') return val.trim() !== "" && val.trim() !== "-";
          return val !== "";
        };

        const parseDate = (dateStr) => {
          if (!dateStr) return null;
          if (dateStr instanceof Date) return dateStr;
          const s = String(dateStr).trim();
          const parts = s.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
          }
          const parts2 = s.split('-');
          if (parts2.length === 3) {
            if (parts2[0].length === 4) {
              return new Date(parseInt(parts2[0], 10), parseInt(parts2[1], 10) - 1, parseInt(parts2[2], 10));
            } else {
              return new Date(parseInt(parts2[2], 10), parseInt(parts2[1], 10) - 1, parseInt(parts2[0], 10));
            }
          }
          const parsed = Date.parse(s);
          return isNaN(parsed) ? null : new Date(parsed);
        };

        let filteredRows = json.data.slice(6);
        if (role === "user") {
          filteredRows = filteredRows.filter((row) => row[127] === userName);
        } else if (role === "engineer") {
          filteredRows = filteredRows.filter((row) => row[28] === userName);
        }

        filteredRows.forEach((row) => {
          if (!row || !row[1]) return; // Row must have a ticket ID

          serviceStages.forEach((stage) => {
            const plannedVal = row[stage.start];
            const actualVal = row[stage.actual];

            if (cellHasValue(plannedVal) && !cellHasValue(actualVal)) {
              counts[stage.name]++;
              
              let isOverdue = false;
              if (stage.delay !== -1) {
                const delayVal = row[stage.delay];
                if (cellHasValue(delayVal)) {
                  isOverdue = true;
                  overdueCounts[stage.name]++;
                }
              } else {
                // Fallback for Follow-Up which doesn't have a delay column
                const pDate = parseDate(plannedVal);
                if (pDate) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  pDate.setHours(0, 0, 0, 0);
                  if (pDate < today) {
                    isOverdue = true;
                    overdueCounts[stage.name]++;
                  }
                }
              }

              if (stage.name === "Follow-Up") {
                const category = row[23] || "Uncategorized";
                if (!followUpCategories[category]) {
                  followUpCategories[category] = { pending: 0, overdue: 0 };
                }
                followUpCategories[category].pending++;
                if (isOverdue) {
                  followUpCategories[category].overdue++;
                }
              }
            }
          });
        });

        setStageCounts(counts);
        setStageOverdueCounts(overdueCounts);
        setFollowUpCategoryBreakdown(followUpCategories);

        // console.log("allData", allData);

        const priority = allData.map((item) => item.priority);

        const priorityCounts = priority.reduce((acc, priority) => {
          // Capitalize first letter for display
          const formattedName =
            priority.charAt(0).toUpperCase() + priority.slice(1);

          if (!acc[formattedName]) {
            acc[formattedName] = 0;
          }
          acc[formattedName]++;
          return acc;
        }, {});

        // Convert to array of objects
        const prioritySources = Object.entries(priorityCounts).map(
          ([name, value]) => ({
            name,
            value,
          })
        );

        setPriorityData(prioritySources);

        const quatationPending = allData.filter(
          (item) => item.planned3 !== "" && item.actual3 === ""
        );

        setQuataionData(quatationPending);

        const invoicePending = allData.filter(
          (item) => item.planned12 !== "" && item.actual12 === ""
        );
        setInvoiceData(invoicePending);

        const siteVisitPending = allData.filter(
          (item) => item.planned5 !== "" && item.actual5 === ""
        );
        setSiteVisitData(siteVisitPending);

        const engineer = allData.filter(
          (item) => item.planned11 !== "" && item.actual11 === ""
        );
        setEngineerData(engineer);

        const paymentData = allData.reduce((acc, item) => {
          if (item.timeStemp && item.payRightNow) {
            // Extract month from timeStemp (assuming format "DD/MM/YYYY HH:MM:SS")
            const dateParts = item.timeStemp.split(" ")[0].split("/");
            if (dateParts.length === 3) {
              const monthNum = parseInt(dateParts[1], 10);
              const year = dateParts[2];

              // Convert month number to short month name
              const monthNames = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];
              const month = monthNames[monthNum - 1];

              const monthYearKey = `${month} ${year}`;

              // Initialize if this month doesn't exist yet
              if (!acc[monthYearKey]) {
                acc[monthYearKey] = 0;
              }

              // Add the payment amount (convert to number if it's a string)
              const paymentAmount =
                typeof item.payRightNow === "string"
                  ? parseFloat(item.payRightNow) || 0
                  : Number(item.payRightNow) || 0;

              acc[monthYearKey] += paymentAmount;
            }
          }
          return acc;
        }, {});

        // Convert to array format
        const paymentSources = Object.entries(paymentData).map(
          ([month, revenue]) => ({
            month,
            revenue,
          })
        );

        // console.log("paymentSources", paymentSources);
        setPaymentData(paymentSources); // You'll need to create this state variable

        // Process warranty check data
        const warrantyCheckCounts = allData.reduce((acc, item) => {
          if (item.warrantyCheck) {
            // Convert to proper case for consistent comparison
            const status = String(item.warrantyCheck || "").trim().toLowerCase();
            if (status === "yes") {
              acc.yes = (acc.yes || 0) + 1;
            } else if (status === "no") {
              acc.no = (acc.no || 0) + 1;
            }
          }
          return acc;
        }, {});

        // Create the warranty check data array
        const warrantyCheckData = [
          { name: "Yes", value: warrantyCheckCounts.yes || 0 },
          { name: "No", value: warrantyCheckCounts.no || 0 },
        ];

        // console.log("Warranty Check Data:", warrantyCheckData);
        setWarrantyCheckData(warrantyCheckData); // You'll need to create this state variable
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Weekly Report Fetch ───────────────────────────────────────────────────
  const fetchWeeklyReport = async (startOverride, endOverride) => {
    setWeeklyReportLoading(true);
    try {
      const now = new Date();
      now.setHours(23, 59, 59, 999);

      const rawStart = startOverride !== undefined ? startOverride : weeklyStartDate;
      const rawEnd   = endOverride  !== undefined ? endOverride  : weeklyEndDate;

      let effectiveEnd = rawEnd
        ? (() => { const d = new Date(rawEnd); d.setHours(23,59,59,999); return d; })()
        : new Date(now);
      let effectiveStart = rawStart
        ? (() => { const d = new Date(rawStart); d.setHours(0,0,0,0); return d; })()
        : (() => { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; })();

      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      sixtyDaysAgo.setHours(0, 0, 0, 0);

      const _parseDate = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        const s = String(dateStr).trim();
        // If the string has a time component (ISO datetime), parse it directly so
        // UTC offsets are preserved correctly. e.g. "2026-06-21T18:30:00.000Z" is
        // June 22 00:00 IST — the split('-') path would lose this offset entirely.
        if (s.includes('T') || s.endsWith('Z')) {
          const parsed = Date.parse(s);
          return isNaN(parsed) ? null : new Date(parsed);
        }
        const p = s.split('/');
        if (p.length === 3) return new Date(parseInt(p[2],10), parseInt(p[1],10)-1, parseInt(p[0],10));
        const p2 = s.split('-');
        if (p2.length === 3) {
          if (p2[0].length === 4) return new Date(parseInt(p2[0],10), parseInt(p2[1],10)-1, parseInt(p2[2],10));
          return new Date(parseInt(p2[2],10), parseInt(p2[1],10)-1, parseInt(p2[0],10));
        }
        const parsed = Date.parse(s);
        return isNaN(parsed) ? null : new Date(parsed);
      };

      const _hasVal = (v) => {
        if (v === null || v === undefined) return false;
        if (typeof v === 'string') return v.trim() !== '' && v.trim() !== '-';
        return v !== '';
      };

      const _parseNum = (v) => {
        if (v === null || v === undefined || v === '') return 0;
        const n = parseFloat(String(v).replace(/,/g,''));
        return isNaN(n) ? 0 : n;
      };

      const CATS = ['SPARE', 'SERVICE', 'NABL', 'NON NABL', 'OTHER'];
      const _normCat = (cat) => {
        if (!cat) return 'OTHER';
        const normalize = (str) => {
          return String(str)
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .replace(/\s*,\s*/g, ',');
        };
        const c = normalize(cat);
        if (c === 'SPARE')   return 'SPARE';
        if (c === 'SERVICE') return 'SERVICE';

        const nablList = [
          'NABL CALIBRATION',
          'NABL & NON-NABL',
          'NABL,NON-NABL,SPARE',
          'NABL & SPARE',
          'NABL CERTIFICATE',
          'NABL,NON-NABL,SERVICE ,SPARE',
          'NABL,NON-NABL,SERVICE',
          'NABL & SERVICE',
          'NABL,SERVICE ,SPARE'
        ].map(normalize);

        const nonNablList = [
          'NON-NABL CALIBRATION',
          'NON-NABL CERTIFICATE',
          'NON-NABL & SERVICE',
          'NON-NABL & SPARE',
          'NON NABL & SAPRE'
        ].map(normalize);

        if (c === 'NABL' || nablList.includes(c)) return 'NABL';
        if (c === 'NON NABL' || c === 'NON-NABL' || c === 'NONNABL' || nonNablList.includes(c)) return 'NON NABL';
        return 'OTHER';
      };

      const result = {};
      CATS.forEach(cat => {
        result[cat] = { 
          outgoingEnq: 0, 
          outgoingValue: 0, 
          incomingEnq: 0, 
          incomingValue: 0, 
          tillDatePending: 0, 
          tillDatePendingValue: 0, 
          totalBilling: 0, 
          invoiceValue: 0 
        };
      });

      const [ticketRes, invoiceRes] = await Promise.all([
        fetch(`${sheet_url}?sheet=Ticket_Enquiry`),
        fetch(`${sheet_url}?sheet=Invoice`),
      ]);
      const [ticketJson, invoiceJson] = await Promise.all([
        ticketRes.json(),
        invoiceRes.json(),
      ]);

      if (ticketJson.success && Array.isArray(ticketJson.data)) {
        const rows = ticketJson.data.slice(6);

        // Build ticket-to-category lookup for Invoice joining
        const ticketCatMap = {};
        rows.forEach(row => {
          if (row && row[1]) ticketCatMap[String(row[1]).trim()] = _normCat(row[23]);
        });

        rows.forEach(row => {
          if (!row || !row[1]) return;
          const ts = _parseDate(row[0]);
          const callType = String(row[13] || '').trim();
          const category = _normCat(row[23]);
          const basicValue = _parseNum(row[41]);

          // Outgoing & Incoming Enquiries (date-filtered)
          if (ts && ts >= effectiveStart && ts <= effectiveEnd) {
            if (callType === 'Outgoing') {
              result[category].outgoingEnq++;
              result[category].outgoingValue += basicValue;
            }
            if (callType === 'Incoming') {
              result[category].incomingEnq++;
              result[category].incomingValue += basicValue;
            }
          }

          // Till Date Pending Enq (last 60 days — no date filter)
          if (ts && ts >= sixtyDaysAgo) {
            const pendingVC  = _hasVal(row[31])  && !_hasVal(row[32]);
            const pendingWC  = _hasVal(row[132]) && !_hasVal(row[133]);
            const pendingQuo = _hasVal(row[37])  && !_hasVal(row[38]);
            if (pendingVC || pendingWC || pendingQuo) {
              result[category].tillDatePending++;
              result[category].tillDatePendingValue += basicValue;
            }
          }
        });

        // Invoice data (date-filtered)
        if (invoiceJson.success && Array.isArray(invoiceJson.data)) {
          invoiceJson.data.slice(6).forEach(row => {
            if (!row || !row[1]) return;
            const ts = _parseDate(row[15]);
            if (!ts || ts < effectiveStart || ts > effectiveEnd) return;
            const ticketId = String(row[1]).trim();
            const invoiceCatRaw = row[71];
            const cat = invoiceCatRaw ? _normCat(invoiceCatRaw) : (ticketCatMap[ticketId] || 'OTHER');
            result[cat].totalBilling++;
            if      (cat === 'SPARE')    result[cat].invoiceValue += _parseNum(row[22]);
            else if (cat === 'SERVICE')  result[cat].invoiceValue += _parseNum(row[21]);
            else if (cat === 'NABL')     result[cat].invoiceValue += _parseNum(row[17]);
            else if (cat === 'NON NABL') result[cat].invoiceValue += _parseNum(row[19]);
            // OTHER: no dedicated column
          });
        }

        setWeeklyReportData({ result, effectiveStart, effectiveEnd });
      }
    } catch (err) {
      console.error('Error fetching weekly report:', err);
      toast.error('Failed to load weekly report');
    } finally {
      setWeeklyReportLoading(false);
    }
  };

  useEffect(() => { fetchWeeklyReport(); }, []);

  const formatDate = (raw) => {
    if (!raw) return "-";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportDocument } = await import("./report-pdf");

      const response = await fetch(`${sheet_url}?sheet=Ticket_Enquiry`);
      const json = await response.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("Failed fetching comprehensive data for report");
      }

      const rows = json.data;

      const row2 = rows[1] || [];
      const row3 = rows[2] || [];

      const getResponsiblePerson = (stage) => {
        // Find column index dynamically
        if (stage.start !== undefined && row2[stage.start]) {
          const r2Val = String(row2[stage.start]).toLowerCase().replace(/[^a-z0-9]/g, "");
          const stageNameNorm = String(stage.name).toLowerCase().replace(/[^a-z0-9]/g, "");
          if (r2Val.includes(stageNameNorm) || stageNameNorm.includes(r2Val)) {
            return String(row3[stage.start] || "").trim();
          }
        }
        
        // Search row2 for matching stage name
        const stageNameNorm = String(stage.name).toLowerCase().replace(/[^a-z0-9]/g, "");
        for (let colIdx = 0; colIdx < row2.length; colIdx++) {
          const val = String(row2[colIdx] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (val && (val === stageNameNorm || val.includes(stageNameNorm) || stageNameNorm.includes(val))) {
            return String(row3[colIdx] || "").trim();
          }
        }
        
        return stage.responsible || "-";
      };

      const userName = localStorage.getItem("currentUsername");
      const roleStorage = localStorage.getItem("o2d-auth-storage");
      const parsedData = JSON.parse(roleStorage);
      const role = parsedData.state.user.role;

      let filteredRows = rows.slice(6);
      if (role === "user") {
        filteredRows = filteredRows.filter((row) => row[127] === userName);
      } else if (role === "engineer") {
        filteredRows = filteredRows.filter((row) => row[28] === userName);
      }

      const cellHasValue = (val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string') return val.trim() !== "" && val.trim() !== "-";
        return val !== "";
      };

      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        const s = String(dateStr).trim();
        const parts = s.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
        const parts2 = s.split('-');
        if (parts2.length === 3) {
          if (parts2[0].length === 4) {
            return new Date(parseInt(parts2[0], 10), parseInt(parts2[1], 10) - 1, parseInt(parts2[2], 10));
          } else {
            return new Date(parseInt(parts2[2], 10), parseInt(parts2[1], 10) - 1, parseInt(parts2[0], 10));
          }
        }
        const parsed = Date.parse(s);
        return isNaN(parsed) ? null : new Date(parsed);
      };

      const overdueCounts = {};
      serviceStages.forEach((s) => {
        overdueCounts[s.name] = 0;
      });

      const detailed = [];
      const followUpCategoryOverdue = {};

      filteredRows.forEach((row) => {
        if (!row || !row[1]) return;

        serviceStages.forEach((stage) => {
          const plannedVal = row[stage.start];
          const actualVal = row[stage.actual];
          let isPending = false;
          let delayVal = 0;

          if (cellHasValue(plannedVal) && !cellHasValue(actualVal)) {
            isPending = true;
            if (stage.delay !== -1) {
              const rawDelay = row[stage.delay];
              if (cellHasValue(rawDelay)) {
                delayVal = parseInt(rawDelay, 10) || 0;
              }
            } else {
              const pDate = parseDate(plannedVal);
              if (pDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                pDate.setHours(0, 0, 0, 0);
                if (pDate < today) {
                  const diffTime = Math.abs(today.getTime() - pDate.getTime());
                  delayVal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
              }
            }
          }

          if (isPending) {
            overdueCounts[stage.name]++;

            if (stage.name === "Follow-Up") {
              const categoryName = row[23] || "Uncategorized";
              if (!followUpCategoryOverdue[categoryName]) {
                followUpCategoryOverdue[categoryName] = 0;
              }
              followUpCategoryOverdue[categoryName]++;

              detailed.push({
                stage: "Follow-Up",
                date: formatDate(row[47] || row[0]),
                companyName: row[16] || "-",
                category: row[23] || "-",
                siteAddress: row[20] || "-",
                followUpStage: row[50] || "-",
                basicAmount: row[41] || "-",
                whatDidCustomerSay: row[57] || "-",
                dateOfLastFollowUp: formatDate(row[59]),
                delay: delayVal
              });
            } else if (stage.name === "Site Visit Plan") {
              detailed.push({
                stage: "Site Visit Plan",
                date: formatDate(row[61] || row[0]),
                companyName: row[16] || "-",
                siteAddress: row[20] || "-",
                category: row[23] || "-",
                delay: delayVal
              });
            }
          }
        });
      });

      const summaryData = [];
      serviceStages.forEach((s) => {
        const oCount = overdueCounts[s.name] || 0;
        if (oCount > 0) {
          summaryData.push({
            stage: s.name,
            pending: oCount,
            responsible: getResponsiblePerson(s)
          });
          if (s.name === "Follow-Up") {
            Object.entries(followUpCategoryOverdue).forEach(([category, oCount]) => {
              if (oCount > 0) {
                summaryData.push({
                  stage: `  - ${category}`,
                  pending: oCount,
                  responsible: ""
                });
              }
            });
          }
        }
      });
      const allowedStages = serviceStages.map(s => s.name);
      detailed.sort((a, b) => {
        const indexA = allowedStages.indexOf(a.stage);
        const indexB = allowedStages.indexOf(b.stage);
        return indexA - indexB;
      });

      console.log("Generating report with:", {
        summaryDataCount: summaryData.length,
        detailedCount: detailed.length,
        followUpCategoryBreakdown: followUpCategoryOverdue
      });

      const blob = await pdf(<ReportDocument summaryData={summaryData} detailedData={detailed} followUpCategoryBreakdown={followUpCategoryOverdue} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Service_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Skeleton Components
  const SkeletonCard = () => (
    <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-300 rounded w-1/2 mb-2 animate-pulse"></div>
        <div className="h-6 bg-gray-300 rounded w-1/4 animate-pulse"></div>
      </div>
    </Card>
  );

  const SkeletonChart = () => (
    <Card className="p-6 shadow rounded-2xl">
      <div className="h-6 bg-gray-300 rounded w-1/3 mb-4 animate-pulse"></div>
      <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
    </Card>
  );

  const SkeletonBarChart = () => (
    <Card className="p-6 shadow rounded-2xl">
      <div className="h-6 bg-gray-300 rounded w-1/3 mb-4 animate-pulse"></div>
      <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
    </Card>
  );

  if (fetchLoading) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        {/* KPIs Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>

        {/* Bar Chart Skeleton */}
        <SkeletonBarChart />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <PhoneCall className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Enquiries</p>
            <p className="text-xl font-bold">{allTickets?.length}</p>
          </div>
        </Card>

        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Quotations</p>
            <p className="text-xl font-bold">{quataionData?.length}</p>
          </div>
        </Card>

        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Site Visits</p>
            <p className="text-xl font-bold">{siteVisitData?.length}</p>
          </div>
        </Card>

        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Invoices</p>
            <p className="text-xl font-bold">{invoiceData?.length}</p>
          </div>
        </Card>

        <Card className="shadow rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Engineer</p>
            <p className="text-xl font-bold">{engineerData?.length}</p>
          </div>
        </Card>
      </div>

      {/* Pending Items by Stage */}
      <Card className="shadow rounded-2xl">
        <CardHeader className="pb-1 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Pending Items by Stage
          </CardTitle>
          <Button
            variant="default"
            className="bg-blue-600 hover:bg-blue-700 h-9 text-xs flex items-center text-white gap-2 font-medium"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {isGeneratingReport ? "Generating..." : "Generate Report"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[300px]">Stage</TableHead>
                <TableHead className="text-xs text-right w-[120px]">
                  Pending
                </TableHead>
                <TableHead className="text-xs text-center w-[180px]">
                  Pending Overdue
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceStages.map((stage) => {
                let dynamicCount = stageCounts[stage.name] || 0;
                let overdueCount = stageOverdueCounts[stage.name] || 0;

                const rowsToRender = [];

                rowsToRender.push(
                  <TableRow
                    key={stage.id}
                    className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => navigate(stage.route)}
                  >
                    <TableCell className="text-xs font-medium">
                      <Link
                        to={stage.route}
                        className="flex items-center gap-2 text-blue-600 hover:underline font-semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${stage.color}`}
                        ></div>
                        {stage.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {dynamicCount}
                    </TableCell>
                    <TableCell className="text-xs text-center text-red-500 font-medium">
                      {overdueCount > 0 ? overdueCount : "-"}
                    </TableCell>
                  </TableRow>
                );

                if (stage.name === "Follow-Up" && Object.keys(followUpCategoryBreakdown).length > 0) {
                  Object.entries(followUpCategoryBreakdown).forEach(([category, data]) => {
                    rowsToRender.push(
                      <TableRow key={`followup-${category}`} className="bg-gray-50/30 hover:bg-gray-50/60 border-l-4 border-l-teal-500/50">
                        <TableCell className="text-xs font-medium pl-8 text-gray-500">
                          ↳ {category}
                        </TableCell>
                        <TableCell className="text-xs text-right text-gray-400">
                          {data.pending}
                        </TableCell>
                        <TableCell className="text-xs text-center text-red-400 font-medium">
                          {data.overdue > 0 ? data.overdue : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  });
                }

                return rowsToRender;
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── Weekly Report ──────────────────────────────────────── */}
      <Card className="shadow rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <CardTitle className="text-lg font-semibold">Weekly Report</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500 whitespace-nowrap">From:</label>
                <input
                  type="date"
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={weeklyStartDate}
                  onChange={e => setWeeklyStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500 whitespace-nowrap">To:</label>
                <input
                  type="date"
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={weeklyEndDate}
                  onChange={e => setWeeklyEndDate(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3 flex items-center gap-1"
                onClick={() => fetchWeeklyReport()}
                disabled={weeklyReportLoading}
              >
                {weeklyReportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Apply
              </Button>
              {(weeklyStartDate || weeklyEndDate) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2"
                  onClick={() => { setWeeklyStartDate(''); setWeeklyEndDate(''); fetchWeeklyReport('', ''); }}
                  disabled={weeklyReportLoading}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
          {weeklyReportData && (
            <p className="text-xs text-gray-400 mt-1">
              Showing:{' '}
              {weeklyReportData.effectiveStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' '}–{' '}
              {weeklyReportData.effectiveEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' '}·{' '}TILL DATE PENDING ENQ always reflects last 60 days
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {weeklyReportLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : weeklyReportData ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-800 hover:bg-slate-800">
                    <TableHead className="text-xs font-bold text-white w-[210px] py-3">CATEGORY</TableHead>
                    {['SPARE', 'SERVICE', 'NABL', 'NON NABL'].map(cat => (
                      <TableHead key={cat} className="text-xs font-bold text-white text-center py-3">{cat}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: 'OUTGOING ENQUIRIES',    getVal: (cat) => weeklyReportData.result[cat].outgoingEnq },
                    {
                      label: '↳ Total Value',
                      isSubRow: true,
                      getVal: (cat) => {
                        const v = weeklyReportData.result[cat].outgoingValue;
                        return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                      },
                    },
                    { label: 'INCOMING ENQUIRIES',    getVal: (cat) => weeklyReportData.result[cat].incomingEnq },
                    {
                      label: '↳ Total Value',
                      isSubRow: true,
                      getVal: (cat) => {
                        const v = weeklyReportData.result[cat].incomingValue;
                        return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                      },
                    },
                    {
                      label: 'TILL DATE PENDING ENQ',
                      note: '(last 60 days)',
                      getVal: (cat) => weeklyReportData.result[cat].tillDatePending,
                    },
                    {
                      label: '↳ Total Value',
                      isSubRow: true,
                      getVal: (cat) => {
                        const v = weeklyReportData.result[cat].tillDatePendingValue;
                        return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                      },
                    },
                    { label: 'TOTAL NO. BILLING',    getVal: (cat) => weeklyReportData.result[cat].totalBilling },
                    {
                      label: 'CONVERSION %',
                      getVal: (cat) => {
                        const pending = weeklyReportData.result[cat].tillDatePending;
                        const billing = weeklyReportData.result[cat].totalBilling;
                        if (pending === 0) return '-';
                        return `${((billing / pending) * 100).toFixed(1)}%`;
                      },
                    },
                    {
                      label: 'INVOICE VALUE',
                      getVal: (cat) => {
                        if (cat === 'OTHER') return '-';
                        const v = weeklyReportData.result[cat].invoiceValue;
                        return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                      },
                    },
                    {
                      label: 'AVG TCK SIZE',
                      getVal: (cat) => {
                        if (cat === 'OTHER') return '-';
                        const billing = weeklyReportData.result[cat].totalBilling;
                        if (billing === 0) return '-';
                        const v = weeklyReportData.result[cat].invoiceValue / billing;
                        return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                      },
                    },
                  ].map((row, rIdx) => (
                    <TableRow 
                      key={rIdx} 
                      className={
                        row.isSubRow 
                          ? 'bg-gray-50/20 hover:bg-gray-50/40 border-l-2 border-l-blue-400/50' 
                          : rIdx % 2 === 0 
                            ? 'bg-white' 
                            : 'bg-gray-50/60'
                      }
                    >
                      <TableCell className={`text-xs py-2.5 ${row.isSubRow ? 'pl-6 text-gray-500 font-medium' : 'font-semibold text-gray-700'}`}>
                        {row.label}
                        {row.note && <span className="text-gray-400 text-[10px] ml-1 font-normal">{row.note}</span>}
                      </TableCell>
                      {['SPARE', 'SERVICE', 'NABL', 'NON NABL'].map(cat => (
                        <TableCell 
                          key={cat} 
                          className={`text-xs text-center py-2.5 ${row.isSubRow ? 'text-gray-500 font-normal' : 'text-gray-600 font-medium'}`}
                        >
                          {row.getVal(cat)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-gray-400">No report data available.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
