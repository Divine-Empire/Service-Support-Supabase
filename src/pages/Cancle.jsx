import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

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

export default function Cancle() {
  const [activeTab, setActiveTab] = useState("pending");

  const [cancelSheetDataa, setCancelSheetData] = useState([]);
  const { toast } = useToast();

  const [fetchLoading, setFetchLoading] = useState(false);

  const sheet_url =
    import.meta.env.VITE_APPS_SCRIPT_API;
  const Sheet_Id = import.meta.env.VITE_GOOGLE_SHEET_ID;

  const fetchCancleSheet = async () => {
    try {
      setFetchLoading(true);
      const response = await fetch(`${sheet_url}?sheet=Cancel`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const headers = result.data[0];
        const formattedData = result.data.slice(1).map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            const key = header.toLowerCase().replace(/\s+/g, "_");
            obj[key] = row[index] || null;
          });
          return obj;
        });

        setCancelSheetData(formattedData);
      } else {
        console.log("No data available");
        return [];
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error("Failed to load master data");
      throw error;
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchCancleSheet();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const userName = localStorage.getItem("currentUsername");

  const roleStorage = localStorage.getItem("o2d-auth-storage");
  const parsedData = JSON.parse(roleStorage);
  const role = parsedData.state.user.role;


  const cancelSheetData = role === "user" ? cancelSheetDataa.filter(
    (item) => item["cre_name"] === userName
  ) : cancelSheetDataa;


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
                  className="data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  Cancel ({cancelSheetData.length})
                </TabsTrigger>
              </TabsList>
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
                            Ticket ID
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
                            Title
                          </th>

                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Description
                          </th>

                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Stage name
                          </th>
                          <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-blue-100">
                        {cancelSheetData.length === 0 ? (
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
                          cancelSheetData.map((ticket, ind) => (
                            <tr
                              key={ind}
                              className={
                                ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                              }
                            >
                              <td className="px-4 py-3 font-medium text-blue-800">
                                {ticket.ticket_id}
                              </td>

                              <td className="px-4 py-3 text-blue-900">
                                {ticket.client_name}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.phone_number}
                              </td>

                              <td className="px-4 py-3 text-blue-900">
                                {ticket.email_address}
                              </td>

                              <td className="px-4 py-3 text-blue-900">
                                {ticket.category}
                              </td>

                              <td className="px-4 py-3 text-blue-900">
                                {ticket.title}
                              </td>

                              <td className="px-4 py-3 text-blue-900">
                                {ticket.description}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.stage_name}
                              </td>
                              <td className="px-4 py-3 text-blue-900">
                                {ticket.remarks}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-4">
                      {cancelSheetData.length === 0 ? (
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
                        cancelSheetData.map((ticket, ind) => (
                          <Card
                            key={ind}
                            className={`${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"
                              } border-l-4 border-l-indigo-500`}
                          >
                            <CardContent className="p-4 space-y-3">
                              {/* Header with Ticket ID */}
                              <div>
                                <h3 className="font-bold text-blue-800 text-lg">
                                  {ticket.ticket_id}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {ticket.client_name}
                                </p>
                              </div>

                              {/* Contact Information */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Phone
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.phone_number}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Email
                                  </p>
                                  <p className="text-blue-900 truncate">
                                    {ticket.email_address || "N/A"}
                                  </p>
                                </div>
                              </div>

                              {/* Category & Title */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Category
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.category || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">
                                    Title
                                  </p>
                                  <p className="text-blue-900">
                                    {ticket.title || "N/A"}
                                  </p>
                                </div>
                              </div>

                              {/* Stage Name */}
                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Stage Name
                                </p>
                                <p className="text-blue-900">
                                  {ticket.stage_name || "N/A"}
                                </p>
                              </div>

                              {/* Description */}
                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Description
                                </p>
                                <p className="text-blue-900 line-clamp-3">
                                  {ticket.description || "N/A"}
                                </p>
                              </div>

                              {/* Remarks */}
                              <div>
                                <p className="text-gray-500 font-medium text-sm">
                                  Remarks
                                </p>
                                <p className="text-blue-900 line-clamp-3">
                                  {ticket.remarks || "N/A"}
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
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
