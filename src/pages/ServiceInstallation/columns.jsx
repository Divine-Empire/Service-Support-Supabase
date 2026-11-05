import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared";
import { ExternalLink } from "lucide-react";

export const formatDateTime = (date) => {
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

export const formatDateOnly = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatInputDate = (dateStr) => {
  if (!dateStr) return "";
  const str = String(dateStr).trim().split(" ")[0];
  
  // Case 1: Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Case 2: DD-MM-YYYY or DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
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
  const matchY = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
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
  } catch {
    // unparseable: fall through to ""
  }
  
  return "";
};

const isHttp = (v) => !!v && String(v).startsWith("http");

const fileLink = (url, label) =>
  isHttp(url) ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
      {label}
    </a>
  ) : (
    url
  );

const CLIENT_STATUS_TONE = { yes: "success", no: "danger" };
const REMARKS_KEY = "What Did Customer's Say (Remarks)";
const isSiteVisitRow = (r) => (r["Service-Type"] || "").trim().toLowerCase() === "site visit";

// Pending: Approve + order/invoice columns. History: what the follow-up recorded.
export const COLUMNS = [
  { key: "approve", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onApprove }) => (
    <Button size="sm" onClick={() => onApprove(r)}>Approve</Button>
  ) },
  { key: "siNo", label: "SI NO", defaultVisible: true, strong: true, text: (r) => r["SI NO"] },
  { key: "orderNo", label: "Order No", defaultVisible: true, text: (r) => r["Order No."] },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 260, text: (r) => r["COMPANY NAME"] },
  { key: "itemName", label: "Item Name", defaultVisible: true, tabs: ["pending"], wrap: true, width: 260, text: (r) => r["Item-Name"] },
  { key: "invoiceDate", label: "Invoice Date", defaultVisible: true, tabs: ["pending"], text: (r) => formatDateOnly(r["INVOICE DATE"]) },
  { key: "invoiceNo", label: "Invoice No", defaultVisible: true, tabs: ["pending"], text: (r) => r["INVOICE NO"] },
  { key: "invoiceCopy", label: "Invoice Copy", defaultVisible: true, tabs: ["pending"], cell: (r) => fileLink(r["Invoice Copy"], "View Invoice") },
  { key: "clientStatus", label: "Client Status", defaultVisible: true, tabs: ["history"], cell: (r) => (
    r["Client Status"] ? <StatusBadge tone={CLIENT_STATUS_TONE[r["Client Status"].toLowerCase()] || "warning"}>{r["Client Status"]}</StatusBadge> : ""
  ) },
  { key: "serviceType", label: "Service Type", defaultVisible: true, tabs: ["history"], text: (r) => r["Service-Type"] },
  { key: "engineerName", label: "Engineer Name", defaultVisible: true, tabs: ["history"], text: (r) => r["Engineer Name"] },
  { key: "serviceReport", label: "Service Report File", defaultVisible: true, tabs: ["history"], cell: (r) => fileLink(r["Service Report"], "View File") },
  { key: "nextDate", label: "Next Follow-Up Date", defaultVisible: true, text: (r) => formatDateOnly(r["Next Date"]) },
  { key: "remarks", label: "Remarks", defaultVisible: true, wrap: true, width: 200, text: (r) => r[REMARKS_KEY] },
  { key: "invoiceCopyHistory", label: "Invoice Copy", tabs: ["history"], defaultVisible: false, cell: (r) => fileLink(r["Invoice Copy"], "View Invoice") },
  // Empty fragment (not null) so the kit does not print a "-" for rows without an Enquiry button.
  { key: "enquiry", label: "Actions", fixed: true, tabs: ["history"], cell: (r, { onEnquiry }) => (
    isSiteVisitRow(r) ? <Button variant="outline" size="sm" onClick={() => onEnquiry(r)}>Enquiry</Button> : <></>
  ) },
  { key: "materialRcvd", label: "Material Rcvd", defaultVisible: false, text: (r) => r["Actual material rcvd"] || "0" },
  { key: "planned", label: "Planned", defaultVisible: false, text: (r) => formatDateTime(r._planned1) },
  { key: "actual", label: "Actual", defaultVisible: false, tabs: ["history"], text: (r) => formatDateTime(r._actual1) },
];
