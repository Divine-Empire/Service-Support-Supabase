import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./layout";
import ProtectedRoute from "../components/ProtectedRoute";
import Login from "../pages/Login";

// Each page is its own chunk, loaded on first visit (Layout wraps <Outlet /> in Suspense).
const Dashboard = lazy(() => import("../pages/Dashboard"));
const ServiceInstallation = lazy(() => import("../pages/ServiceInstallation"));
const TicketAndEnquiry = lazy(() => import("../pages/Ticket-and-Enquiry"));
const VideoCallSolution = lazy(() => import("../pages/VideoCallSolution"));
const WarrantyCheck = lazy(() => import("../pages/Warranty-Check"));
const Quotation = lazy(() => import("../pages/Quotation"));
const FollowUp = lazy(() => import("../pages/FollowUp"));
const Warehouse = lazy(() => import("../pages/Warehouse"));
const SiteVisitPlan = lazy(() => import("../pages/SiteVisitPlan"));
const TADA = lazy(() => import("../pages/TADA"));
const TadaApproval = lazy(() => import("../pages/TadaApproval"));
const TadaDecision = lazy(() => import("../pages/TadaDecision"));
const SiteVisitOTPVerification = lazy(() => import("../pages/SiteVisitOTPVerification"));
const CrmVerification = lazy(() => import("../pages/CrmVerification"));
const Invoice = lazy(() => import("../pages/Invoice"));
const Calibration = lazy(() => import("../pages/Calibration"));
const CalibrationCertificate = lazy(() => import("../pages/CalibrationCertificate"));
const SpareDispatchDetails = lazy(() => import("../pages/SpareDispatchDetails"));
const CancelledTickets = lazy(() => import("../pages/Cancelled_Tickets"));
const Report = lazy(() => import("../pages/Report"));
const Settings = lazy(() => import("../pages/Master/Settings"));
const MasterDropdown = lazy(() => import("../pages/Master/DropdownMaster"));
const MasterCompany = lazy(() => import("../pages/Master/CompanyDetails"));
const MasterSections = lazy(() => import("../pages/Master/MasterSections"));
const TatConfig = lazy(() => import("../pages/Master/tat-config"));

const admin = (element) => <ProtectedRoute requiredRole="admin">{element}</ProtectedRoute>;

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public — no login. Reached only via the token link in the
          Senior Approval email (sss-send-tada-approval-email). Outside Layout,
          so it has its own Suspense. */}
      <Route path="/tada-decision" element={<TadaDecision />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="serviceinstallation" element={<ServiceInstallation />} />
        <Route path="ticket-and-enquiry" element={<TicketAndEnquiry />} />
        <Route path="videocall" element={<VideoCallSolution />} />
        <Route path="warranty-check" element={<WarrantyCheck />} />
        <Route path="quotation" element={<Quotation />} />
        <Route path="followup" element={<FollowUp />} />
        <Route path="warehouse" element={<Warehouse />} />
        <Route path="siteplan" element={<SiteVisitPlan />} />
        <Route path="tada" element={<TADA />} />
        <Route path="tada-approval" element={<TadaApproval />} />
        <Route path="approval" element={<SiteVisitOTPVerification />} />
        <Route path="crm-verification" element={<CrmVerification />} />
        <Route path="invoice" element={<Invoice />} />
        <Route path="calibration" element={<Calibration />} />
        <Route path="calibrationCertificate" element={<CalibrationCertificate />} />
        <Route path="sparedispatch" element={<SpareDispatchDetails />} />
        <Route path="cancel" element={<CancelledTickets />} />
        <Route path="report" element={<Report />} />
        <Route path="master" element={<Navigate to="/master/dropdown" replace />} />
        <Route path="master/dropdown" element={admin(<MasterDropdown />)} />
        <Route path="master/company" element={admin(<MasterCompany />)} />
        <Route path="master/items" element={admin(<MasterSections section="items" />)} />
        <Route path="master/engineers" element={admin(<MasterSections section="engineers" />)} />
        <Route path="master/recipients" element={admin(<MasterSections section="recipients" />)} />
        <Route path="master/tat" element={admin(<TatConfig />)} />
        <Route path="tat-config" element={<Navigate to="/master/tat" replace />} />
        <Route path="settings" element={admin(<Settings />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
