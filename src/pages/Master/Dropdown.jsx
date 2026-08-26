import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";

// Renamed in migration 0043 to match the renamed tickets columns:
// 'category' now holds the NABL/Service/Spare-style values (source for
// Ticket-and-Enquiry.jsx's "Category" field, formerly "Enquiry-Type"),
// 'sub_category' holds the machine-group values (source for its
// "Sub-Category" field, formerly "Category"), and 'enquiry_type' is a
// brand new, initially-empty category sourcing the brand new "Enquiry
// Type" field (used for TAT/planning on stages after Invoice).
const CATEGORY_LABELS = {
  call_type: "Call Type",
  source_of_enquiry: "Source of Enquiry",
  enquiry_receiver_name: "Enquiry Receiver Name",
  category: "Category (Requirement Service Type)",
  sub_category: "Sub-Category (Machine Group)",
  enquiry_type: "Enquiry Type",
  service_location: "Service Location",
  engineer_assign_name: "Engineer Assign Name",
  machine_name: "Machine Name",
  item_name: "Item Name",
};

export default function Master() {
  const [activeTab, setActiveTab] = useState("dropdown");
  const { toast } = useToast();

  // ── Dropdown tab state ──────────────────────────────────────────────
  const [dropdownRows, setDropdownRows] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isAddingValue, setIsAddingValue] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteDropdownTarget, setDeleteDropdownTarget] = useState(null);
  const [isDeletingDropdown, setIsDeletingDropdown] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const fetchDropdown = async () => {
    setDropdownLoading(true);
    try {
      const data = await fetchDropdownRows(null, "*");
      setDropdownRows(data || []);
      if (!selectedCategory && data && data.length > 0) {
        setSelectedCategory(data[0].category);
      }
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
      toast({ title: "Error", description: "Failed to load dropdown data", variant: "destructive" });
    } finally {
      setDropdownLoading(false);
    }
  };

  // ── Company Details tab state ───────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ uuid: null, companyName: "", billingAddress: "", gstNumber: "" });
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState(null);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  const fetchCompanies = async () => {
    setCompanyLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_details")
        .select("*")
        .order("company_name", { ascending: true });
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching company details:", error);
      toast({ title: "Error", description: "Failed to load company details", variant: "destructive" });
    } finally {
      setCompanyLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdown();
    fetchCompanies();
  }, []);

  // ── Dropdown tab handlers ───────────────────────────────────────────
  const categories = [...new Set(dropdownRows.map((r) => r.category))];
  const valuesForCategory = dropdownRows.filter((r) => r.category === selectedCategory);

  const handleAddValue = async (e) => {
    e.preventDefault();
    const category = showNewCategoryInput ? newCategoryName.trim() : selectedCategory;
    const value = newValue.trim();
    if (!category) {
      alert("Please select or enter a category");
      return;
    }
    if (!value) {
      alert("Please enter a value");
      return;
    }

    setIsAddingValue(true);
    try {
      const { error } = await supabase.from("dropdown").insert({ category, value });
      if (error) throw error;
      toast({ title: "Success", description: "Value added successfully" });
      setNewValue("");
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      setSelectedCategory(category);
      fetchDropdown();
    } catch (error) {
      console.error("Error adding value:", error);
      toast({ title: "Error", description: "Failed to add value", variant: "destructive" });
    } finally {
      setIsAddingValue(false);
    }
  };

  const startEditRow = (row) => {
    setEditingRow(row);
    setEditingValue(row.value);
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    const value = editingValue.trim();
    if (!value) {
      alert("Value cannot be empty");
      return;
    }
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("dropdown")
        .update({ value })
        .eq("uuid", editingRow.uuid);
      if (error) throw error;
      toast({ title: "Success", description: "Value updated successfully" });
      setEditingRow(null);
      setEditingValue("");
      fetchDropdown();
    } catch (error) {
      console.error("Error updating value:", error);
      toast({ title: "Error", description: "Failed to update value", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteDropdownValue = async () => {
    if (!deleteDropdownTarget) return;
    setIsDeletingDropdown(true);
    try {
      const { error } = await supabase.from("dropdown").delete().eq("uuid", deleteDropdownTarget.uuid);
      if (error) throw error;
      toast({ title: "Success", description: "Value deleted successfully" });
      setDeleteDropdownTarget(null);
      fetchDropdown();
    } catch (error) {
      console.error("Error deleting value:", error);
      toast({ title: "Error", description: "Failed to delete value", variant: "destructive" });
    } finally {
      setIsDeletingDropdown(false);
    }
  };

  // ── Company Details tab handlers ────────────────────────────────────
  const filteredCompanies = companies.filter((c) => {
    const q = companySearch.toLowerCase();
    return (
      String(c.company_name || "").toLowerCase().includes(q) ||
      String(c.gst_number || "").toLowerCase().includes(q)
    );
  });

  const openCreateCompanyModal = () => {
    setIsEditingCompany(false);
    setCompanyForm({ uuid: null, companyName: "", billingAddress: "", gstNumber: "" });
    setShowCompanyModal(true);
  };

  const openEditCompanyModal = (company) => {
    setIsEditingCompany(true);
    setCompanyForm({
      uuid: company.uuid,
      companyName: company.company_name || "",
      billingAddress: company.billing_address || "",
      gstNumber: company.gst_number || "",
    });
    setShowCompanyModal(true);
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    if (!companyForm.companyName.trim()) {
      alert("Company Name is required");
      return;
    }

    setIsSavingCompany(true);
    try {
      const payload = {
        company_name: companyForm.companyName.trim(),
        billing_address: companyForm.billingAddress.trim() || null,
        gst_number: companyForm.gstNumber.trim() || null,
      };

      if (isEditingCompany) {
        const { error } = await supabase.from("company_details").update(payload).eq("uuid", companyForm.uuid);
        if (error) throw error;
        toast({ title: "Success", description: "Company updated successfully" });
      } else {
        const { error } = await supabase.from("company_details").insert(payload);
        if (error) throw error;
        toast({ title: "Success", description: "Company added successfully" });
      }
      setShowCompanyModal(false);
      fetchCompanies();
    } catch (error) {
      console.error("Error saving company:", error);
      toast({ title: "Error", description: "Failed to save company", variant: "destructive" });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompanyTarget) return;
    setIsDeletingCompany(true);
    try {
      const { error } = await supabase.from("company_details").delete().eq("uuid", deleteCompanyTarget.uuid);
      if (error) throw error;
      toast({ title: "Success", description: "Company deleted successfully" });
      setDeleteCompanyTarget(null);
      fetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast({ title: "Error", description: "Failed to delete company", variant: "destructive" });
    } finally {
      setIsDeletingCompany(false);
    }
  };

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4">
            <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
              <TabsTrigger
                value="dropdown"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Dropdown
              </TabsTrigger>
              <TabsTrigger
                value="company"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Company Details
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* ── Dropdown Tab ─────────────────────────────────────── */}
            <TabsContent value="dropdown" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
                <div className="border border-gray-200 rounded-lg p-3 space-y-1 max-h-[70vh] overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-500 uppercase px-2 pb-2">Categories</p>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setShowNewCategoryInput(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedCategory === cat && !showNewCategoryInput
                          ? "bg-blue-600 text-white font-medium"
                          : "text-gray-700 hover:bg-blue-50"
                      }`}
                    >
                      {CATEGORY_LABELS[cat] || cat}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNewCategoryInput(true)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1 ${
                      showNewCategoryInput
                        ? "bg-blue-600 text-white font-medium"
                        : "text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    <Plus className="w-4 h-4" /> New Category
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <form onSubmit={handleAddValue} className="flex flex-col sm:flex-row gap-2 mb-4">
                    {showNewCategoryInput && (
                      <Input
                        placeholder="New category key (e.g. payment_mode)"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="sm:w-64"
                      />
                    )}
                    <Input
                      placeholder="Enter new value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={isAddingValue}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shrink-0"
                    >
                      {isAddingValue && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
                      Add
                    </Button>
                  </form>

                  <div className="max-h-[55vh] overflow-y-auto">
                    {dropdownLoading ? (
                      <div className="flex justify-center items-center text-blue-700 py-8">
                        <LoaderIcon className="animate-spin w-8 h-8" />
                      </div>
                    ) : !showNewCategoryInput && valuesForCategory.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No values yet for this category.</p>
                    ) : showNewCategoryInput ? (
                      <p className="text-gray-500 text-center py-8">Add the first value for your new category above.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-600">
                            <th className="px-3 py-2 text-left font-semibold">Value</th>
                            <th className="px-3 py-2 text-right font-semibold w-28">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {valuesForCategory.map((row, ind) => (
                            <tr key={row.uuid} className={ind % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                              <td className="px-3 py-2">
                                {editingRow?.uuid === row.uuid ? (
                                  <Input
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="h-8"
                                    autoFocus
                                  />
                                ) : (
                                  row.value
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {editingRow?.uuid === row.uuid ? (
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit} className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white">
                                      {isSavingEdit ? <Loader2Icon className="animate-spin w-3 h-3" /> : "Save"}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingRow(null)} className="h-7 px-2">
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1">
                                    <Button variant="outline" size="sm" onClick={() => startEditRow(row)} className="h-7 px-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setDeleteDropdownTarget(row)} className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-50">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Company Details Tab ──────────────────────────────── */}
            <TabsContent value="company" className="mt-0">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
                <Input
                  placeholder="Search by company name or GST number..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="sm:w-80"
                />
                <Button
                  onClick={openCreateCompanyModal}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  New Company
                </Button>
              </div>

              <div className="relative overflow-x-auto">
                <div className="max-h-[65vh] overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white px-4 py-3 text-left w-[100px]">Actions</th>
                        <th className="text-white px-4 py-3 text-left">Company Name</th>
                        <th className="text-white px-4 py-3 text-left">Billing Address</th>
                        <th className="text-white px-4 py-3 text-left">GST Number</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {companyLoading ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8">
                            <div className="flex justify-center items-center text-blue-700">
                              <LoaderIcon className="animate-spin w-8 h-8" />
                            </div>
                          </td>
                        </tr>
                      ) : filteredCompanies.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-blue-700">
                            No companies found.
                          </td>
                        </tr>
                      ) : (
                        filteredCompanies.map((company, ind) => (
                          <tr key={company.uuid} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditCompanyModal(company)} className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-2">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDeleteCompanyTarget(company)} className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-2">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-blue-900 font-medium">{company.company_name}</td>
                            <td className="px-4 py-3 text-blue-900">{company.billing_address || "—"}</td>
                            <td className="px-4 py-3 text-blue-900">{company.gst_number || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Dropdown value delete confirmation */}
      <Modal
        isOpen={!!deleteDropdownTarget}
        onClose={() => setDeleteDropdownTarget(null)}
        title="Delete Value"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-gray-700">
            Delete <span className="font-semibold">{deleteDropdownTarget?.value}</span> from{" "}
            <span className="font-semibold">{CATEGORY_LABELS[deleteDropdownTarget?.category] || deleteDropdownTarget?.category}</span>?
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteDropdownTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDeleteDropdownValue} disabled={isDeletingDropdown} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingDropdown && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Company create/edit modal */}
      <Modal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        title={isEditingCompany ? "Edit Company" : "New Company"}
        size="lg"
      >
        <form onSubmit={handleCompanySubmit} className="space-y-4 p-2">
          <div>
            <Label>Company Name *</Label>
            <Input
              value={companyForm.companyName}
              onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyName: e.target.value }))}
              placeholder="Enter company name"
            />
          </div>
          <div>
            <Label>Billing Address</Label>
            <Input
              value={companyForm.billingAddress}
              onChange={(e) => setCompanyForm((prev) => ({ ...prev, billingAddress: e.target.value }))}
              placeholder="Enter billing address"
            />
          </div>
          <div>
            <Label>GST Number</Label>
            <Input
              value={companyForm.gstNumber}
              onChange={(e) => setCompanyForm((prev) => ({ ...prev, gstNumber: e.target.value }))}
              placeholder="Enter GST number"
            />
          </div>
          <div className="flex justify-end space-x-4 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCompanyModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSavingCompany} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              {isSavingCompany && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              {isEditingCompany ? "Save Changes" : "Create Company"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Company delete confirmation */}
      <Modal
        isOpen={!!deleteCompanyTarget}
        onClose={() => setDeleteCompanyTarget(null)}
        title="Delete Company"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteCompanyTarget?.company_name}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteCompanyTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDeleteCompany} disabled={isDeletingCompany} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingCompany && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
