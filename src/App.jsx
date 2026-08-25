import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Toaster as ShadcnToaster } from './components/ui/toaster';

import Dashboard from "./pages/Dashboard";
import ServiceInstallation from "./pages/ServiceInstallation";
import TicketAndEnquiry from "./pages/Ticket-and-Enquiry";
import VideoCallSolution from "./pages/VideoCallSolution";
import WarrantyCheck from "./pages/Warranty-Check";
import Quotation from "./pages/Quotation";
import FollowUp from "./pages/FollowUp";
import OrderReceived from "./pages/OrderReceived";
import Warehouse from "./pages/Warehouse";
import SiteVisitPlan from "./pages/SiteVisitPlan";
import TADA from "./pages/TADA";
import EngineerApproval from "./pages/SiteVisitOTPVerification";
import Invoice from "./pages/Invoice";
import AccountVerification from "./pages/AccountVerification";
import Calibration from "./pages/Calibration";
import IMS from "./pages/IMS";
import NotFound from "./pages/not-found";
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AccountablityApproval from './pages/AccountablityApproval';
import CalibrationCertificate from './pages/CalibrationCertificate';
import Conformation from './pages/Conformation';
import Cancle from './pages/Cancle';
import Settings from './pages/Master/Settings';
import Master from './pages/Master/Dropdown';
import TatConfig from './pages/Master/tat-config';

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <ShadcnToaster />
      {/* <Layout> */}
        <Routes>

          <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/serviceinstallation" element={<ServiceInstallation />} />
          <Route path="/ticket-and-enquiry" element={<TicketAndEnquiry />} />
          <Route path="/videocall" element={<VideoCallSolution />} />
          <Route path="/warranty-check" element={<WarrantyCheck />} />
          <Route path="/quotation" element={<Quotation />} />
          <Route path="/followup" element={<FollowUp />} />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/siteplan" element={<SiteVisitPlan />} />
          <Route path="/tada" element={<TADA />} />
          <Route path="/approval" element={<EngineerApproval />} />
          <Route path="/orderreceived" element={<OrderReceived />} />
          <Route path="/invoice" element={<Invoice />} />
          <Route path="/account" element={<AccountVerification />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/ims" element={<IMS />} />

          <Route path="/accountabilityApprovals" element={<AccountablityApproval />} />
          <Route path="/calibrationCertificate" element={<CalibrationCertificate />} />
          <Route path="/conformation" element={<Conformation />} />
          <Route path="/cancel" element={<Cancle />} />
          <Route
            path="/master"
            element={
              <ProtectedRoute requiredRole="admin">
                <Master />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tat-config"
            element={
              <ProtectedRoute requiredRole="admin">
                <TatConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRole="admin">
                <Settings />
              </ProtectedRoute>
            }
          />

          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      {/* </Layout> */}
    </Router>
  );
}

export default App;
