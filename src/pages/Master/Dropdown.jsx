import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { ltoSupabase } from "../../lib/supabase/ltoClient";
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
  // Read-only: sourced live from the production Lead-To-Order-Supabase-New
  // project's client master. Editing now happens there, not in this testing
  // project — see [[servicesupport_migration_project]] memory.
  const [companies, setCompanies] = useState([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState("");

  const fetchCompanies = async () => {
    setCompanyLoading(true);
    try {
      const { data, error } = await ltoSupabase
        .from("lto_client_master")
        .select("company_name, state, state_code, gst_number, billing_address, company_group_name")
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

  // ── Engineer Contacts tab state ─────────────────────────────────────
  // WhatsApp numbers for the video-call-scheduled notifications
  // (send-video-call-notifications Edge Function looks this table up by
  // engineer name — see [[whatsapp_meta_integration]]).
  const [engineerContacts, setEngineerContacts] = useState([]);
  const [engineerContactsLoading, setEngineerContactsLoading] = useState(false);
  const [newEngineerName, setNewEngineerName] = useState("");
  const [newEngineerPhone, setNewEngineerPhone] = useState("");
  const [isAddingEngineerContact, setIsAddingEngineerContact] = useState(false);
  const [deleteEngineerTarget, setDeleteEngineerTarget] = useState(null);
  const [isDeletingEngineerContact, setIsDeletingEngineerContact] = useState(false);

  // Single "Edit" modal per engineer — everything except the name (phone,
  // email, bank details) is editable here. Also feeds the TADA Senior
  // Approval email (sss-send-tada-approval-email Edge Function): email
  // joins the CC list, bank fields fill "Bank Details for Transfer".
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [detailsForm, setDetailsForm] = useState({});
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // ── TADA Approval Recipients tab state ──────────────────────────────
  // The Senior Approval email's To/CC list — read live by
  // sss-send-tada-approval-email at send time (see migration 0062).
  const [approvalRecipients, setApprovalRecipients] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientType, setNewRecipientType] = useState("cc");
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState(null);
  const [editingRecipientType, setEditingRecipientType] = useState("cc");
  const [isSavingRecipientEdit, setIsSavingRecipientEdit] = useState(false);
  const [deleteRecipientTarget, setDeleteRecipientTarget] = useState(null);
  const [isDeletingRecipient, setIsDeletingRecipient] = useState(false);

  const fetchApprovalRecipients = async () => {
    setRecipientsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sss_tada_approval_recipients")
        .select("*")
        .order("recipient_type", { ascending: true })
        .order("email", { ascending: true });
      if (error) throw error;
      setApprovalRecipients(data || []);
    } catch (error) {
      console.error("Error fetching approval recipients:", error);
      toast({ title: "Error", description: "Failed to load approval recipients", variant: "destructive" });
    } finally {
      setRecipientsLoading(false);
    }
  };

  const fetchEngineerContacts = async () => {
    setEngineerContactsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sss_engineer_contacts")
        .select("*")
        .order("engineer_name", { ascending: true });
      if (error) throw error;
      setEngineerContacts(data || []);
    } catch (error) {
      console.error("Error fetching engineer contacts:", error);
      toast({ title: "Error", description: "Failed to load engineer contacts", variant: "destructive" });
    } finally {
      setEngineerContactsLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdown();
    fetchCompanies();
    fetchEngineerContacts();
    fetchApprovalRecipients();
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
      const { error } = await supabase.from("sss_dropdown").insert({ category, value });
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
        .from("sss_dropdown")
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
      const { error } = await supabase.from("sss_dropdown").delete().eq("uuid", deleteDropdownTarget.uuid);
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

  // ── Engineer Contacts tab handlers ──────────────────────────────────
  // This tab IS the engineer source of truth now — engineers are added and
  // removed only here (no more separate 'engineer_assign_name' dropdown
  // category). Every page that assigns an engineer reads from
  // sss_engineer_contacts via fetchEngineerNames() (see engineers.js).
  const handleAddEngineerContact = async (e) => {
    e.preventDefault();
    const name = newEngineerName.trim();
    const phone = newEngineerPhone.trim();
    if (!name) {
      alert("Please enter the engineer's name");
      return;
    }
    if (!phone) {
      alert("Please enter a WhatsApp number");
      return;
    }
    if (engineerContacts.some((c) => c.engineer_name.toLowerCase() === name.toLowerCase())) {
      alert("An engineer with this name already exists");
      return;
    }

    setIsAddingEngineerContact(true);
    try {
      const { error } = await supabase
        .from("sss_engineer_contacts")
        .insert({ engineer_name: name, phone_number: phone });
      if (error) throw error;
      toast({ title: "Success", description: "Engineer added successfully" });
      setNewEngineerName("");
      setNewEngineerPhone("");
      fetchEngineerContacts();
    } catch (error) {
      console.error("Error adding engineer:", error);
      toast({ title: "Error", description: "Failed to add engineer", variant: "destructive" });
    } finally {
      setIsAddingEngineerContact(false);
    }
  };

  const handleDeleteEngineerContact = async () => {
    if (!deleteEngineerTarget) return;
    setIsDeletingEngineerContact(true);
    try {
      const { error } = await supabase
        .from("sss_engineer_contacts")
        .delete()
        .eq("engineer_name", deleteEngineerTarget.engineer_name);
      if (error) throw error;
      toast({ title: "Success", description: "Engineer contact deleted successfully" });
      setDeleteEngineerTarget(null);
      fetchEngineerContacts();
    } catch (error) {
      console.error("Error deleting engineer contact:", error);
      toast({ title: "Error", description: "Failed to delete engineer contact", variant: "destructive" });
    } finally {
      setIsDeletingEngineerContact(false);
    }
  };

  const openDetailsModal = (contact) => {
    setDetailsTarget(contact);
    setDetailsForm({
      phoneNumber: contact.phone_number || "",
      email: contact.email || "",
      bankName: contact.bank_name || "",
      accountHolderName: contact.account_holder_name || "",
      accountNumber: contact.account_number || "",
      ifscCode: contact.ifsc_code || "",
      branch: contact.branch || "",
    });
  };

  const handleDetailsFormChange = (field, value) => {
    setDetailsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDetails = async () => {
    if (!detailsTarget) return;
    if (!detailsForm.phoneNumber?.trim()) {
      alert("WhatsApp number cannot be empty");
      return;
    }
    setIsSavingDetails(true);
    try {
      const { error } = await supabase
        .from("sss_engineer_contacts")
        .update({
          phone_number: detailsForm.phoneNumber.trim(),
          email: detailsForm.email || null,
          bank_name: detailsForm.bankName || null,
          account_holder_name: detailsForm.accountHolderName || null,
          account_number: detailsForm.accountNumber || null,
          ifsc_code: detailsForm.ifscCode || null,
          branch: detailsForm.branch || null,
          updated_at: new Date().toISOString(),
        })
        .eq("engineer_name", detailsTarget.engineer_name);
      if (error) throw error;
      toast({ title: "Success", description: "Engineer details saved successfully" });
      setDetailsTarget(null);
      fetchEngineerContacts();
    } catch (error) {
      console.error("Error saving engineer details:", error);
      toast({ title: "Error", description: "Failed to save engineer details", variant: "destructive" });
    } finally {
      setIsSavingDetails(false);
    }
  };

  // ── TADA Approval Recipients tab handlers ───────────────────────────
  const handleAddRecipient = async (e) => {
    e.preventDefault();
    const email = newRecipientEmail.trim().toLowerCase();
    if (!email) {
      alert("Please enter an email address");
      return;
    }

    setIsAddingRecipient(true);
    try {
      const { error } = await supabase
        .from("sss_tada_approval_recipients")
        .upsert({ email, recipient_type: newRecipientType });
      if (error) throw error;
      toast({ title: "Success", description: "Recipient saved successfully" });
      setNewRecipientEmail("");
      setNewRecipientType("cc");
      fetchApprovalRecipients();
    } catch (error) {
      console.error("Error saving recipient:", error);
      toast({ title: "Error", description: "Failed to save recipient", variant: "destructive" });
    } finally {
      setIsAddingRecipient(false);
    }
  };

  const startEditRecipient = (recipient) => {
    setEditingRecipient(recipient);
    setEditingRecipientType(recipient.recipient_type);
  };

  const handleSaveRecipientEdit = async () => {
    if (!editingRecipient) return;
    setIsSavingRecipientEdit(true);
    try {
      const { error } = await supabase
        .from("sss_tada_approval_recipients")
        .update({ recipient_type: editingRecipientType })
        .eq("email", editingRecipient.email);
      if (error) throw error;
      toast({ title: "Success", description: "Recipient updated successfully" });
      setEditingRecipient(null);
      fetchApprovalRecipients();
    } catch (error) {
      console.error("Error updating recipient:", error);
      toast({ title: "Error", description: "Failed to update recipient", variant: "destructive" });
    } finally {
      setIsSavingRecipientEdit(false);
    }
  };

  const handleDeleteRecipient = async () => {
    if (!deleteRecipientTarget) return;
    setIsDeletingRecipient(true);
    try {
      const { error } = await supabase
        .from("sss_tada_approval_recipients")
        .delete()
        .eq("email", deleteRecipientTarget.email);
      if (error) throw error;
      toast({ title: "Success", description: "Recipient deleted successfully" });
      setDeleteRecipientTarget(null);
      fetchApprovalRecipients();
    } catch (error) {
      console.error("Error deleting recipient:", error);
      toast({ title: "Error", description: "Failed to delete recipient", variant: "destructive" });
    } finally {
      setIsDeletingRecipient(false);
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
              <TabsTrigger
                value="engineerContacts"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Engineer Contacts
              </TabsTrigger>
              <TabsTrigger
                value="approvalRecipients"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Approval Recipients
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
            {/* Read-only — sourced live from the production
                Lead-To-Order-Supabase-New project's client master. */}
            <TabsContent value="company" className="mt-0">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
                <Input
                  placeholder="Search by company name or GST number..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="sm:w-80"
                />
              </div>

              <div className="relative overflow-x-auto">
                <div className="max-h-[65vh] overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <th className="text-white px-4 py-3 text-left">Company Name</th>
                        <th className="text-white px-4 py-3 text-left">State</th>
                        <th className="text-white px-4 py-3 text-left">State Code</th>
                        <th className="text-white px-4 py-3 text-left">GST Number</th>
                        <th className="text-white px-4 py-3 text-left">Billing Address</th>
                        <th className="text-white px-4 py-3 text-left">Company Group Name</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-100">
                      {companyLoading ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8">
                            <div className="flex justify-center items-center text-blue-700">
                              <LoaderIcon className="animate-spin w-8 h-8" />
                            </div>
                          </td>
                        </tr>
                      ) : filteredCompanies.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-blue-700">
                            No companies found.
                          </td>
                        </tr>
                      ) : (
                        filteredCompanies.map((company, ind) => (
                          <tr key={company.company_name} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                            <td className="px-4 py-3 text-blue-900 font-medium">{company.company_name}</td>
                            <td className="px-4 py-3 text-blue-900">{company.state || "—"}</td>
                            <td className="px-4 py-3 text-blue-900">{company.state_code || "—"}</td>
                            <td className="px-4 py-3 text-blue-900">{company.gst_number || "—"}</td>
                            <td className="px-4 py-3 text-blue-900">{company.billing_address || "—"}</td>
                            <td className="px-4 py-3 text-blue-900">{company.company_group_name || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ── Engineer Contacts Tab ────────────────────────────── */}
            {/* Single source of truth for engineers app-wide — every page's
                "Engineer Assign" field reads from this table (see
                engineers.js). Add/remove an engineer here, nowhere else. */}
            <TabsContent value="engineerContacts" className="mt-0">
              <div className="border border-gray-200 rounded-lg p-4">
                <form onSubmit={handleAddEngineerContact} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                    placeholder="Engineer name"
                    value={newEngineerName}
                    onChange={(e) => setNewEngineerName(e.target.value)}
                    className="sm:w-64"
                  />
                  <Input
                    placeholder="Enter WhatsApp number"
                    value={newEngineerPhone}
                    onChange={(e) => setNewEngineerPhone(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={isAddingEngineerContact}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shrink-0"
                  >
                    {isAddingEngineerContact && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
                    Add
                  </Button>
                </form>

                <div className="max-h-[55vh] overflow-auto">
                  {engineerContactsLoading ? (
                    <div className="flex justify-center items-center text-blue-700 py-8">
                      <LoaderIcon className="animate-spin w-8 h-8" />
                    </div>
                  ) : engineerContacts.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No engineer contacts yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600">
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Engineer Name</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">WhatsApp Number</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Email</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Bank Name</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Account Holder</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Account Number</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">IFSC Code</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Branch</th>
                          <th className="px-3 py-2 text-right font-semibold w-24 whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {engineerContacts.map((contact, ind) => (
                          <tr key={contact.engineer_name} className={ind % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-2 whitespace-nowrap">{contact.engineer_name}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{contact.phone_number}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{contact.email || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{contact.bank_name || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{contact.account_holder_name || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{contact.account_number || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{contact.ifsc_code || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">{contact.branch || "-"}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="outline" size="sm" onClick={() => openDetailsModal(contact)} className="h-7 px-2 border-blue-200 text-blue-700 hover:bg-blue-50" title="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDeleteEngineerTarget(contact)} className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── TADA Approval Recipients Tab ─────────────────────── */}
            {/* To/CC list for the Senior Approval email (sss-send-tada-
                approval-email), read live at send time — no code change
                needed to add/remove a recipient. The assigned engineer's
                own email (Engineer Contacts tab) is added to CC on top of
                whatever's listed here automatically. */}
            <TabsContent value="approvalRecipients" className="mt-0">
              <div className="border border-gray-200 rounded-lg p-4">
                <form onSubmit={handleAddRecipient} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={newRecipientEmail}
                    onChange={(e) => setNewRecipientEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={newRecipientType} onValueChange={setNewRecipientType}>
                    <SelectTrigger className="sm:w-32">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                      <SelectItem value="to">To</SelectItem>
                      <SelectItem value="cc">Cc</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    disabled={isAddingRecipient}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shrink-0"
                  >
                    {isAddingRecipient && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
                    Add
                  </Button>
                </form>

                <div className="max-h-[55vh] overflow-y-auto">
                  {recipientsLoading ? (
                    <div className="flex justify-center items-center text-blue-700 py-8">
                      <LoaderIcon className="animate-spin w-8 h-8" />
                    </div>
                  ) : approvalRecipients.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No recipients configured yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600">
                          <th className="px-3 py-2 text-left font-semibold">Email</th>
                          <th className="px-3 py-2 text-left font-semibold w-24">Type</th>
                          <th className="px-3 py-2 text-right font-semibold w-28">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {approvalRecipients.map((recipient, ind) => (
                          <tr key={recipient.email} className={ind % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-2">{recipient.email}</td>
                            <td className="px-3 py-2">
                              {editingRecipient?.email === recipient.email ? (
                                <Select value={editingRecipientType} onValueChange={setEditingRecipientType}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                                    <SelectItem value="to">To</SelectItem>
                                    <SelectItem value="cc">Cc</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    recipient.recipient_type === "to"
                                      ? "bg-indigo-100 text-indigo-800"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {recipient.recipient_type === "to" ? "To" : "Cc"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {editingRecipient?.email === recipient.email ? (
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" onClick={handleSaveRecipientEdit} disabled={isSavingRecipientEdit} className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white">
                                    {isSavingRecipientEdit ? <Loader2Icon className="animate-spin w-3 h-3" /> : "Save"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingRecipient(null)} className="h-7 px-2">
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1">
                                  <Button variant="outline" size="sm" onClick={() => startEditRecipient(recipient)} className="h-7 px-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => setDeleteRecipientTarget(recipient)} className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-50">
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

      {/* Engineer contact delete confirmation */}
      <Modal
        isOpen={!!deleteEngineerTarget}
        onClose={() => setDeleteEngineerTarget(null)}
        title="Delete Engineer Contact"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-gray-700">
            Delete the WhatsApp number for{" "}
            <span className="font-semibold">{deleteEngineerTarget?.engineer_name}</span>?
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteEngineerTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDeleteEngineerContact} disabled={isDeletingEngineerContact} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingEngineerContact && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Email & Bank Details modal — feeds the TADA Senior Approval email */}
      <Modal
        isOpen={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={`Details — ${detailsTarget?.engineer_name || ""}`}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">WhatsApp Number</label>
            <Input
              value={detailsForm.phoneNumber || ""}
              onChange={(e) => handleDetailsFormChange("phoneNumber", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <Input
              type="email"
              placeholder="engineer@example.com"
              value={detailsForm.email || ""}
              onChange={(e) => handleDetailsFormChange("email", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Bank Details for Transfer</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Bank Name</label>
            <Input
              value={detailsForm.bankName || ""}
              onChange={(e) => handleDetailsFormChange("bankName", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Account Holder Name</label>
            <Input
              value={detailsForm.accountHolderName || ""}
              onChange={(e) => handleDetailsFormChange("accountHolderName", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Account Number</label>
            <Input
              value={detailsForm.accountNumber || ""}
              onChange={(e) => handleDetailsFormChange("accountNumber", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">IFSC Code</label>
            <Input
              value={detailsForm.ifscCode || ""}
              onChange={(e) => handleDetailsFormChange("ifscCode", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">Branch</label>
            <Input
              value={detailsForm.branch || ""}
              onChange={(e) => handleDetailsFormChange("branch", e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={() => setDetailsTarget(null)} disabled={isSavingDetails}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveDetails}
              disabled={isSavingDetails}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              {isSavingDetails && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approval recipient delete confirmation */}
      <Modal
        isOpen={!!deleteRecipientTarget}
        onClose={() => setDeleteRecipientTarget(null)}
        title="Delete Recipient"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-gray-700">
            Remove <span className="font-semibold">{deleteRecipientTarget?.email}</span> from the TADA approval email's{" "}
            {deleteRecipientTarget?.recipient_type === "to" ? "To" : "Cc"} list?
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteRecipientTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDeleteRecipient} disabled={isDeletingRecipient} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingRecipient && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
