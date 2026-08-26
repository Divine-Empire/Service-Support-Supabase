import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Ticket,
  Users,
  Video,
  FileText,
  Phone,
  MapPin,
  Plane,
  Wrench,
  CheckCircle,
  Receipt,
  Warehouse,
  Settings,
  User,
  LogOutIcon,
  Package,
  UserCog,
  Database,
  Timer,
} from "lucide-react";
import useAuthStore from "../store/authStore";

export const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Service Installation", href: "/serviceinstallation", icon: Wrench },
  { name: "Ticket-and-Enquiry", href: "/ticket-and-enquiry", icon: Ticket },
  { name: "Warranty Check", href: "/warranty-check", icon: CheckCircle },
  { name: "Warehouse", href: "/warehouse", icon: Warehouse },
  { name: "Video Call Solution", href: "/videocall", icon: Video },
  { name: "Quotation", href: "/quotation", icon: FileText },
  { name: "Follow-Up", href: "/followup", icon: Phone },
  { name: "Site Visit Plan", href: "/siteplan", icon: MapPin },
  { name: "TADA", href: "/tada", icon: Plane },
  {
    name: "Site Visit (Verification OTP)",
    href: "/approval",
    icon: CheckCircle,
  },
  { name: "Order Received", href: "/orderreceived", icon: Package },
  { name: "Invoice", href: "/invoice", icon: Receipt },
  { name: "Calibration", href: "/calibration", icon: Settings },
  {
    name: "Calibration Certificate",
    href: "/calibrationCertificate",
    icon: Settings,
  },
  { name: "Cancel", href: "/cancel", icon: Settings },
  { name: "Master", href: "/master", icon: Database },
  { name: "TAT Config", href: "/tat-config", icon: Timer },
  { name: "Settings", href: "/settings", icon: UserCog },
];

export default function Sidebar({ onClose, isMobile = false }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const allowedPages = Array.isArray(user?.page)
    ? user.page.map((page) => page.trim()).map((page) => (page === "Client Details" || page === "Ticket & Enquiry" ? "Ticket-and-Enquiry" : page))
    : [];

  const filteredMenuItems = navigation.filter((item) => {
    if (item.name === "Settings" || item.name === "Master" || item.name === "TAT Config") return user?.role === "admin";
    return (
      allowedPages.includes(item.name) ||
      item.name === "Service Installation" ||
      item.name === "IMS"
    );
  });

  return (
    <div
      className={`${isMobile ? "fixed inset-0 z-40 flex" : "hidden lg:flex"}`}
    >
      {/* Overlay for mobile */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      <div className="w-64 bg-gradient-to-b from-indigo-900 via-purple-900 to-blue-900 text-white flex-shrink-0 h-screen overflow-y-auto z-50 relative flex flex-col">
        <div className="p-6 border-b border-purple-700 bg-gradient-to-r from-indigo-800 to-purple-800">
          <h1 className="text-2xl font-bold text-white" data-testid="app-title">
            Service Support
          </h1>
          <p className="text-purple-200 text-sm mt-1">Management System</p>
        </div>

        <nav className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-4 overflow-y-auto scrollbar-hide flex-1">
            <div className="space-y-1">
              {filteredMenuItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                const colors = [
                  "from-pink-500 to-pink-600",
                  "from-purple-500 to-purple-600",
                  "from-blue-500 to-blue-600",
                  "from-green-500 to-green-600",
                  "from-yellow-500 to-yellow-600",
                  "from-red-500 to-red-600",
                  "from-indigo-500 to-indigo-600",
                  "from-teal-500 to-teal-600",
                  "from-amber-500 to-amber-600",
                  "from-cyan-500 to-cyan-600",
                  "from-fuchsia-500 to-fuchsia-600",
                  "from-rose-500 to-rose-600",
                  "from-emerald-500 to-emerald-600",
                  "from-violet-500 to-violet-600",
                  "from-sky-500 to-sky-600",
                ];
                // const randomColor = colors[Math.floor(Math.random() * colors.length)];
                const randomColor = "from-blue-500 to-blue-600";

                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all mb-1 ${isActive
                        ? `bg-gradient-to-r ${randomColor} text-white shadow-lg`
                        : "text-blue-100 hover:text-white hover:bg-blue-700/50 hover:shadow-md"
                      }`
                    }
                    data-testid={`nav-${item.href.replace("/", "") || "dashboard"
                      }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label || item.name}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Footer - fixed at bottom */}
          <div className="p-4 border-t border-purple-700/50 bg-gradient-to-r from-blue-900/80 to-indigo-900/80 backdrop-blur-sm mt-auto">
            <button
              onClick={() => {
                handleLogout();
                onClose?.();
              }}
              className="flex items-center py-2 px-4 rounded-lg text-white hover:bg-red-600/80 hover:text-white w-full transition-colors mb-3"
            >
              <LogOutIcon className="mr-2" size={18} />
              <span>Logout</span>
            </button>

            <div className="flex items-center text-sm text-white">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mr-2">
                <User size={16} className="text-white" />
              </div>
              <div>
                <p className="font-medium leading-none">
                  {user?.name || "Guest"}
                </p>
                <p className="text-xs text-blue-200">
                  {user?.role === "admin"
                    ? "Administrator"
                    : user?.role === "engineer"
                      ? "Engineer"
                      : "User"}
                </p>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
