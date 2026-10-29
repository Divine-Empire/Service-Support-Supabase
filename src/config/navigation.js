import {
  BarChart3,
  ClipboardList,
  Ticket,
  Wrench,
  ShieldCheck,
  Video,
  Warehouse,
  FileText,
  Phone,
  Receipt,
  MapPin,
  Plane,
  Mail,
  KeyRound,
  UserCheck,
  Gauge,
  Award,
  Truck,
  XCircle,
  Database,
  UserCog,
} from "lucide-react";

// Single source for the menu, the header title, the Settings page-access list
// and the post-login landing page.
// `name` is the page-access key stored in sss_login_users.page — never rename it;
// change `label` to change what the user sees. Order = menu order (pipeline order).
export const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Service Installation", href: "/serviceinstallation", icon: Wrench },
  { name: "Ticket-and-Enquiry", label: "Ticket & Enquiry", href: "/ticket-and-enquiry", icon: Ticket },
  { name: "Warranty Check", href: "/warranty-check", icon: ShieldCheck },
  { name: "Video Call Solution", href: "/videocall", icon: Video },
  { name: "Warehouse", href: "/warehouse", icon: Warehouse },
  { name: "Quotation", href: "/quotation", icon: FileText },
  { name: "Follow-Up", href: "/followup", icon: Phone },
  { name: "Site Visit Plan", href: "/siteplan", icon: MapPin },
  { name: "TADA", href: "/tada", icon: Plane },
  { name: "TADA Approval", href: "/tada-approval", icon: Mail },
  { name: "Site Visit (Verification OTP)", label: "Site Visit OTP", href: "/approval", icon: KeyRound },
  { name: "CRM Verification", href: "/crm-verification", icon: UserCheck },
  { name: "Invoice", href: "/invoice", icon: Receipt },
  { name: "Spare Dispatch Details", label: "Spare Dispatch", href: "/sparedispatch", icon: Truck },
  { name: "Calibration", href: "/calibration", icon: Gauge },
  { name: "Calibration Certificate", href: "/calibrationCertificate", icon: Award },
  { name: "Report", href: "/report", icon: ClipboardList },
  { name: "Cancel", label: "Cancelled Tickets", href: "/cancel", icon: XCircle },
  {
    name: "Master",
    href: "/master",
    icon: Database,
    adminOnly: true,
    children: [
      { label: "Dropdown", href: "/master/dropdown" },
      { label: "Company Details", href: "/master/company" },
      { label: "Item Master", href: "/master/items" },
      { label: "Engineer List", href: "/master/engineers" },
      { label: "Recipients for Mail", href: "/master/recipients" },
      { label: "TAT Master", href: "/master/tat" },
    ],
  },
  { name: "Settings", href: "/settings", icon: UserCog, adminOnly: true },
];

// Visible to every signed-in user regardless of their page list.
export const ALWAYS_VISIBLE = ["Service Installation"];

export const navLabel = (item) => item.label || item.name;

// Older page lists stored this page under previous names.
const LEGACY_PAGE_NAMES = { "Client Details": "Ticket-and-Enquiry", "Ticket & Enquiry": "Ticket-and-Enquiry" };

export function allowedPageNames(user) {
  if (!Array.isArray(user?.page)) return [];
  return user.page.map((p) => p.trim()).map((p) => LEGACY_PAGE_NAMES[p] || p);
}

// Menu items this user may open (admin = everything).
export function visibleNavigation(user) {
  if (user?.role === "admin") return navigation;
  const allowed = allowedPageNames(user);
  return navigation.filter(
    (item) => !item.adminOnly && (allowed.includes(item.name) || ALWAYS_VISIBLE.includes(item.name))
  );
}

// Where to send a user right after login: the first page they were given,
// falling back to the always-visible pages only if they have nothing else.
export function landingPath(user) {
  if (user?.role === "admin") return "/";
  const items = visibleNavigation(user);
  const assigned = items.find((item) => !ALWAYS_VISIBLE.includes(item.name));
  return (assigned || items[0])?.href || "/";
}

// Menu item for the header title; a sub-page reads "Master · Dropdown".
export function navItemForPath(pathname) {
  for (const item of navigation) {
    if (item.href === pathname) return item;
    const child = item.children?.find((c) => c.href === pathname);
    if (child) return { ...child, label: navLabel(item) + " · " + child.label };
  }
  return undefined;
}
