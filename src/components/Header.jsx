// import React from "react";
// import { Bell, Search, User } from "lucide-react";
// import useAuthStore from "../store/authStore";

// const Header = ({ children }) => {
//   const { user } = useAuthStore();

//   return (
//     <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
//       <div className="flex justify-between items-center py-3 px-4 sm:px-6">
//         <div className="flex items-center">
//           {children}
//           <div className="ml-4 max-w-md hidden sm:block">
//             <div className="relative">
//               <h2
//                 className="text-2xl font-semibold text-slate-800"
//                 data-testid="page-title"
//               >
//                 Service Support System
//               </h2>
//             </div>
//           </div>
//         </div>
//         <div className="flex items-center space-x-4">
//           <div className="relative">
//             <Bell
//               size={20}
//               className="text-gray-500 cursor-pointer hover:text-indigo-600"
//             />
//             <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
//           </div>
//           <div className="flex items-center space-x-2 cursor-pointer">
//             <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
//               <User size={20} className="text-indigo-600" />
//             </div>
//             <div className="hidden md:block">
//               <p className="text-sm font-medium">{user?.name || "Guest"}</p>
//               <p className="text-xs text-gray-500">
//                 {user?.role === "admin" ? "Administrator" : "User"}
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>
//     </header>
//   );
// };

// export default Header;



import React from "react";
import { Bell, Search, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

const Header = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      <div className="flex justify-between items-center py-3 px-4 sm:px-6">
        <div className="flex items-center">
          {children}
          <div className="ml-4 max-w-md hidden sm:block">
            <div className="relative">
              <h2
                className="text-2xl font-semibold text-slate-800"
                data-testid="page-title"
              >
                Service Support System
              </h2>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Bell
              size={20}
              className="text-gray-500 cursor-pointer hover:text-indigo-600"
            />
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <User size={20} className="text-indigo-600" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium">{user?.name || "Guest"}</p>
              <p className="text-xs text-gray-500">
                {user?.role === "admin" ? "Administrator" : "User"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut size={18} className="mr-1" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;