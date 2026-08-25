import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { LoaderIcon, Search, Package, RefreshCw, AlertCircle, XCircle } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const IMS = () => {
  const [data, setData] = useState({ items: [], columns: [] });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("indent");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterItemCode, setFilterItemCode] = useState("All");
  const [filterItemName, setFilterItemName] = useState("All");
  const [indentLiftData, setIndentLiftData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFilterIndenter, setModalFilterIndenter] = useState("All");
  const { toast } = useToast();

  const script_url = import.meta.env.VITE_IMS_SCRIPT_API;
  const sheet_id = import.meta.env.VITE_IMS_SHEET_ID;
  const sheet_name = "IMS";

  const fetchIMSData = async () => {
    try {
      setLoading(true);
      if (activeTab === "indent") {
        const SHEET_ID = import.meta.env.VITE_INDENT_LIFT_SHEET_ID;
        const SHEET_NAME = "INDENT-LIFT";
        const url = `${script_url}?id=${SHEET_ID}&sheetName=${SHEET_NAME}`;
        
        const response = await fetch(url);
        const jsonData = await response.json();
        
        if (jsonData && jsonData.success && jsonData.data) {
          const rawRows = jsonData.data;

          // Map column letters to our data structure
          const mappedRows = rawRows.map((r) => ({
            C: r.C || "",
            D: r.D || "",
            N: r.N || "",
            O: r.O || 0,
            BU: r.BU || 0,
            BV: r.BV || 0,
          }));

          // Filter for Pending Qty (Column BV) > 0
          const validRows = mappedRows.filter((r) => {
            const pending = Number(r.BV || 0);
            return pending > 0;
          });

          // Group by Item Name (Column D)
          const groups = {};
          validRows.forEach((r) => {
            const name = r.D || "Unknown Item";
            if (!groups[name]) {
              groups[name] = {
                itemName: name,
                totalPending: 0,
                records: []
              };
            }
            groups[name].totalPending += Number(r.BV || 0);
            groups[name].records.push(r);
          });
          setIndentLiftData(Object.values(groups));
        } else {
          console.error("Script error or no data:", jsonData?.error);
        }
      } else {
        // Reorder logic — via Next.js server-side proxy (supports restricted sheets)
        const NEXT_API = import.meta.env.VITE_REORDER_API_URL;
        const response = await fetch(NEXT_API);
        const jsonData = await response.json();

        if (jsonData && jsonData.success) {
          setData({ items: jsonData.items || [], columns: jsonData.columns || [] });
        } else {
          console.error("Reorder fetch error:", jsonData.error);
          toast({ title: "Error", description: jsonData.error || "Failed to fetch Reorder data", variant: "destructive" });
        }
      }
    } catch (error) {
      console.error("Error fetching IMS data:", error);
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIMSData();
  }, [activeTab]);

  const items = data.items || [];
  const columns = data.columns || [];

  // Extract unique values for filters
  const categories = ["All", ...new Set(items.map((item) => item["col_B"]).filter(Boolean))].sort();
  const itemCodes = ["All", ...new Set(items.map((item) => item["col_C"]).filter(Boolean))].sort();
  const itemNames = useMemo(() => {
    if (activeTab === "indent") {
      return ["All", ...new Set(indentLiftData.map(item => item.itemName).filter(Boolean))].sort();
    }
    return ["All", ...new Set(items.map(item => item["col_D"]).filter(Boolean))].sort();
  }, [activeTab, indentLiftData, items]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategory("All");
    setFilterItemCode("All");
    setFilterItemName("All");
  };

  const filteredData = items.filter(item => {
    const searchStr = searchTerm.toLowerCase();
    const matchesSearch = Object.values(item).some(val => String(val).toLowerCase().includes(searchStr));
    const matchesCategory = filterCategory === "All" || item["col_B"] === filterCategory;
    const matchesItemCode = filterItemCode === "All" || item["col_C"] === filterItemCode;
    const matchesItemName = filterItemName === "All" || item["col_D"] === filterItemName;

    return matchesSearch && matchesCategory && matchesItemCode && matchesItemName;
  });

  const filteredIndentData = useMemo(() => {
    return indentLiftData.filter(item => {
      const searchStr = searchTerm.toLowerCase();
      const matchesSearch = item.itemName.toLowerCase().includes(searchStr);
      const matchesItemName = filterItemName === "All" || item.itemName === filterItemName;
      return matchesSearch && matchesItemName;
    });
  }, [indentLiftData, searchTerm, filterItemName]);

  return (
    <div className="space-y-6">
      <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                  <Package className="h-6 w-6" />
                  IMS - Inventory Management System
                </CardTitle>
                <p className="text-indigo-600 mt-1">Monitor Indents and Reorder Levels</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
                <Input
                  placeholder="Search inventory..."
                  className="pl-10 border-indigo-100 focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-end gap-4 bg-white/50 p-4 rounded-lg border border-indigo-100/50">
              <div className={`flex-1 grid grid-cols-1 ${activeTab === 'reorder' ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4 w-full`}>
                {activeTab === "reorder" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-indigo-700 uppercase">Category</label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-indigo-100 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                      >
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-indigo-700 uppercase">Item Code</label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-indigo-100 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        value={filterItemCode}
                        onChange={(e) => setFilterItemCode(e.target.value)}
                      >
                        {itemCodes.map(code => <option key={code} value={code}>{code}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-indigo-700 uppercase">Name of Item</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-indigo-100 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={filterItemName}
                    onChange={(e) => setFilterItemName(e.target.value)}
                  >
                    {itemNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 px-4 h-10 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Clear All
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-gray-200 p-1 shadow-sm mb-6">
          <TabsTrigger value="indent" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Indent
          </TabsTrigger>
          <TabsTrigger value="reorder" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
            <AlertCircle className="h-4 w-4 mr-2" />
            Reorder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indent" className="mt-0">
          <IndentLiftTable 
            data={filteredIndentData} 
            loading={loading} 
            onRowClick={(item) => {
              setSelectedItem(item);
              setModalFilterIndenter("All");
              setIsModalOpen(true);
            }} 
          />
        </TabsContent>

        <TabsContent value="reorder" className="mt-0">
          <IMSTable
            data={filteredData}
            columns={columns}
            loading={loading}
            type="reorder"
          />
        </TabsContent>
      </Tabs>

      {/* Drill-down Modal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-white">
            <CardHeader className="bg-indigo-600 text-white flex flex-row justify-between items-center">
              <CardTitle>{selectedItem.itemName}</CardTitle>
              <button className="text-white hover:text-gray-200" onClick={() => setIsModalOpen(false)}>
                <XCircle className="h-6 w-6" />
              </button>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden flex flex-col">
              <div className="p-4 bg-indigo-50 border-b flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-indigo-700 uppercase">Filter By Indenter:</label>
                  <select
                    className="w-[200px] h-8 px-2 rounded border border-indigo-200 bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                    value={modalFilterIndenter}
                    onChange={(e) => setModalFilterIndenter(e.target.value)}
                  >
                    <option value="All">All Indenters</option>
                    {Array.from(new Set(selectedItem.records.map(r => r.C).filter(Boolean))).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left">
                <thead className="bg-indigo-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-indigo-700 uppercase">Indenter Name</th>
                    <th className="px-6 py-3 text-xs font-bold text-indigo-700 uppercase">Approve Qty</th>
                    <th className="px-6 py-3 text-xs font-bold text-indigo-700 uppercase">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-indigo-700 uppercase">Remaining Qty</th>
                    <th className="px-6 py-3 text-xs font-bold text-indigo-700 uppercase">Pending Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedItem.records
                    .filter((r) => {
                      const status = String(r.N || r.col_N || "").toLowerCase().trim();
                      const matchesStatus = status === "approve" || status === "approved";
                      const matchesIndenter = modalFilterIndenter === "All" || r.C === modalFilterIndenter;
                      return matchesStatus && matchesIndenter;
                    })
                    .map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">{r.C || r.col_C}</td>
                        <td className="px-6 py-4 text-sm font-semibold">{r.O || r.col_O}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium uppercase">
                            {r.N || r.col_N}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{r.BU || r.col_BU}</td>
                        <td className="px-6 py-4 text-sm text-indigo-600 font-bold">{r.BV || r.col_BV}</td>
                      </tr>
                    ))}
                  {selectedItem.records.filter((r) => {
                    const status = String(r.N || r.col_N || "").toLowerCase().trim();
                    const matchesStatus = status === "approve" || status === "approved";
                    const matchesIndenter = modalFilterIndenter === "All" || r.C === modalFilterIndenter;
                    return matchesStatus && matchesIndenter;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">
                        No approved records found for this item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </CardContent>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button 
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const IndentLiftTable = ({ data, loading, onRowClick }) => {
  if (loading) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center bg-white shadow-xl">
        <LoaderIcon className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="mt-4 text-gray-500 font-medium">Loading Indent Lift data...</p>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-100 shadow-xl bg-white overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-800 to-blue-800">
              <th className="px-6 py-4 text-xs font-bold text-white uppercase sticky top-0 z-10 bg-indigo-800">Item Name</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase sticky top-0 z-10 bg-indigo-800">Total Pending Qty</th>
              <th className="px-6 py-4 text-xs font-bold text-white uppercase sticky top-0 z-10 bg-indigo-800 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((item, idx) => (
              <tr 
                key={idx} 
                className="hover:bg-indigo-50/50 transition-colors cursor-pointer"
                onClick={() => onRowClick(item)}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.itemName}</td>
                <td className="px-6 py-4 text-sm font-bold text-indigo-600">{item.totalPending}</td>
                <td className="px-6 py-4 text-sm text-indigo-600 font-semibold underline text-right">View Details</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-500 italic">
                  No pending indents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const IMSTable = ({ data, columns, loading, type }) => {
  if (loading) {
    return (
      <Card className="border border-gray-100 shadow-xl p-12 flex flex-col items-center justify-center">
        <LoaderIcon className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="mt-4 text-gray-500 font-medium">Fetching inventory data...</p>
      </Card>
    );
  }

  const getRelevantHeaders = () => {
    if (columns.length === 0) return [];

    // Explicitly target Columns A, B, C and Name of Item
    const coreCols = [
      columns.find(col => col.id === "A"), // GROUP
      columns.find(col => col.id === "B"), // CATEGORY
      columns.find(col => col.id === "C"), // ITEM CODE
      columns.find(col => col.label.toUpperCase().includes("NAME OF ITEM")) || columns.find(col => col.id === "D")
    ].filter(Boolean);

    let targetCols = [];
    if (type === "indent") {
      // Filter for Indent columns (labels containing INDENT but NOT REORDER)
      targetCols = columns.filter((col) =>
        col.label.toUpperCase().includes("INDENT RAISED") &&
        !col.label.toUpperCase().includes("REORDER")
      );
    } else {
      // Filter for Reorder columns (labels containing REORDER)
      targetCols = columns.filter((col) => col.label.toUpperCase().includes("REORDER QUANTITY"));
    }

    // Remove duplicates
    const finalCols = [...new Set([...coreCols, ...targetCols])];
    return finalCols;
  };

  const columnsToShow = getRelevantHeaders();

  return (
    <Card className="border border-gray-100 shadow-xl bg-white overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto max-h-[600px] relative">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-800 to-blue-800">
              {columnsToShow.map((col, idx) => (
                <th
                  key={idx}
                  className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap sticky top-0 z-10 bg-indigo-800 border-b border-indigo-700 shadow-[0_1px_0_rgba(0,0,0,0.1)]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length > 0 ? (
              data.map((item, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-indigo-50/30 transition-colors group">
                  {columnsToShow.map((col, colIdx) => {
                    const val = item[`col_${col.id}`];
                    const isNumber = !isNaN(val) && val !== "";
                    const numVal = parseFloat(val);

                    return (
                      <td key={colIdx} className={`px-6 py-4 text-sm ${colIdx === 0 ? 'font-bold text-indigo-700' : 'text-gray-600'} whitespace-nowrap border-b border-gray-100`}>
                        {type === "reorder" && isNumber && numVal > 0 ? (
                          <span className="px-2 py-1 rounded bg-red-100 text-red-700 font-bold border border-red-200">
                            {val}
                          </span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columnsToShow.length || 1} className="px-6 py-12 text-center text-gray-500 font-medium">
                  No inventory records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default IMS;
