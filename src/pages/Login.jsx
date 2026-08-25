import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, User, Lock, Eye, EyeOff, Loader2Icon } from "lucide-react";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);
  const [loading, setLaoding] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLaoding(true);
    const success = await login(username, password);
    setLaoding(false);

    if (success) {
      const user = useAuthStore.getState().user;
      toast.success(`Welcome back, ${user.name}!`);

        localStorage.setItem('currentUsername', user.username);

      const pages = (user.page || [])
        .map((item) => item.trim())
        .map((item) => (item === "Client Details" || item === "Ticket & Enquiry" ? "Ticket-and-Enquiry" : item));

      // console.log("pages", pages);

      const mainPages = [
        "Dashboard",
        "Ticket-and-Enquiry",
        "Video Call Solution",
        "Quotation",
        "Follow-Up",
        "Site Visit Plan",
        "TADA",
        "Site Visit (Verification OTP)",
        "Order Received",
        "Invoice",
        "Account Verification",
        "Calibration",
        "Accountability & Approvals",
        "Calibration Certificate",
        "Conformation",
        "Cancel"
      ];

      let pagesss = "";
      for (let key of mainPages) {
        if (pages.includes(key)) {
          pagesss = key;
          break;
        }
      }

      if (pagesss === "Dashboard") {
        navigate("/");
      } else if (pagesss === "Ticket-and-Enquiry") {
        navigate("/ticket-and-enquiry");
      } else if (pagesss === "Video Call Solution") {
        navigate("/videocall");
      } else if (pagesss === "Quotation") {
        navigate("/quotation");
      } else if (pagesss === "Follow-Up") {
        navigate("/followup");
      } else if (pagesss === "Site Visit Plan") {
        navigate("/siteplan");
      }else if (pagesss === "TADA") {
        navigate("/tada");
      }  else if (pagesss === "Site Visit (Verification OTP)") {
        navigate("/approval");
      } else if (pagesss === "Order Received") {
        navigate("/orderreceived");
      } else if (pagesss === "Invoice") {
        navigate("/invoice");
      } else if (pagesss === "Account Verification") {
        navigate("/account");
      } else if (pagesss === "Calibration") {
        navigate("/calibration");
      }else if (pagesss === "Accountability & Approvals") {
        navigate("/accountabilityApprovals");
      }else if (pagesss === "Calibration Certificate") {
        navigate("/calibrationCertificate");
      }else if (pagesss === "Conformation") {
        navigate("/conformation");
      }else if (pagesss === "Cancel") {
        navigate("/cancel");
      }

      // Redirect based on role if needed
    } else {
      toast.error("Invalid credentials");
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-slate-600 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Service System Support
          </h2>
          {/* <p className="mt-2 text-sm text-gray-600">
            Order to Delivery Management
          </p> */}
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full pl-10 pr-12 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="disabled:bg-indigo-400 disabled:cursor-not-allowed group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading && <Loader2Icon className="animate-spin" />}
              Sign in
            </button>
          </div>

          <div className="text-sm text-center text-gray-600"></div>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        Powered by <strong>Botivate</strong>
      </div>
    </div>
  );
};

export default Login;
