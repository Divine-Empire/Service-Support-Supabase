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
import { navigation } from "../../components/Sidebar";

const ROLES = ["admin", "user", "engineer"];

// Pages that are always visible regardless of the page-access list, so
// offering them as toggles here wouldn't do anything — leave them out.
const ASSIGNABLE_PAGES = navigation
  .map((item) => item.name)
  .filter((name) => !["Service Installation", "IMS", "Settings", "Master"].includes(name));

const emptyForm = {
  uuid: null,
  fullName: "",
  username: "",
  password: "",
  role: "user",
  page: [],
};

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const togglePage = (pageName) => {
    setFormData((prev) => ({
      ...prev,
      page: prev.page.includes(pageName)
        ? prev.page.filter((p) => p !== pageName)
        : [...prev.page, pageName],
    }));
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setIsEditMode(true);
    setFormData({
      uuid: user.uuid,
      fullName: user.full_name || "",
      username: user.username || "",
      password: "",
      role: user.role || "user",
      page: Array.isArray(user.page) ? user.page.map((p) => p.trim()) : [],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      alert("Full name is required");
      return;
    }
    if (!formData.username.trim()) {
      alert("Username is required");
      return;
    }
    if (!isEditMode && !formData.password.trim()) {
      alert("Password is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const { error } = await supabase.rpc("admin_update_user", {
          p_uuid: formData.uuid,
          p_full_name: formData.fullName.trim(),
          p_username: formData.username.trim(),
          p_role: formData.role,
          p_page: formData.page,
          p_password: formData.password.trim() || null,
        });
        if (error) throw error;
        toast({ title: "Success", description: "User updated successfully" });
      } else {
        const { error } = await supabase.rpc("admin_create_user", {
          p_full_name: formData.fullName.trim(),
          p_username: formData.username.trim(),
          p_password: formData.password.trim(),
          p_role: formData.role,
          p_page: formData.page,
        });
        if (error) throw error;
        toast({ title: "Success", description: "User created successfully" });
      }
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate")
          ? "That username is already taken"
          : "Failed to save user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("admin_delete_user", {
        p_uuid: deleteTarget.uuid,
      });
      if (error) throw error;
      toast({ title: "Success", description: "User deleted successfully" });
      setDeleteTarget(null);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-blue-900 text-xl font-bold flex items-center gap-2">
            User Management
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {users.length}
            </span>
          </h2>

          <Button
            onClick={openCreateModal}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-sm transition-all duration-300 rounded-lg px-4 py-2 flex items-center gap-1.5 group shrink-0 h-9"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            New User
          </Button>
        </CardHeader>

        <CardContent>
          <div className="relative overflow-x-auto">
            <div className="max-h-[calc(104vh-200px)] overflow-y-auto">
              <table className="hidden sm:block w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[100px] sticky top-0">Actions</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[180px] sticky top-0">Full Name</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[150px] sticky top-0">Username</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left w-[120px] sticky top-0">Role</th>
                    <th className="text-white border-b border-blue-500 px-4 py-3 text-left sticky top-0">Page Access</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-blue-100">
                  {fetchLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 bg-white">
                        <div className="flex justify-center items-center text-blue-700">
                          <LoaderIcon className="animate-spin w-8 h-8" />
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 bg-white">
                        <h1 className="text-blue-700">No users found.</h1>
                      </td>
                    </tr>
                  ) : (
                    users.map((user, ind) => (
                      <tr key={user.uuid} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-2 shadow-sm"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget(user)}
                              className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-2 shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-blue-900 font-semibold">{user.full_name}</td>
                        <td className="px-4 py-3 text-blue-900">{user.username}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 capitalize">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-blue-900">
                          <div className="flex flex-wrap gap-1 max-w-2xl">
                            {(user.page || []).map((p) => (
                              <span key={p} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                {p.trim()}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Mobile Card View */}
              <div className="sm:hidden space-y-4">
                {fetchLoading ? (
                  <div className="text-center py-8 bg-white">
                    <div className="flex justify-center items-center text-blue-700">
                      <LoaderIcon className="animate-spin w-8 h-8" />
                    </div>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 bg-white">
                    <h1 className="text-blue-700">No users found.</h1>
                  </div>
                ) : (
                  users.map((user, ind) => (
                    <Card key={user.uuid} className={`border-l-4 border-l-blue-500 ${ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-blue-800 text-lg">{user.full_name}</h3>
                            <p className="text-sm text-gray-600">{user.username}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-2 shadow-sm"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget(user)}
                              className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-2 shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 capitalize">
                            {user.role}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium text-sm mb-1">Page Access</p>
                          <div className="flex flex-wrap gap-1">
                            {(user.page || []).map((p) => (
                              <span key={p} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                {p.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditMode ? "Edit User" : "New User"}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              placeholder="Enter full name"
            />
          </div>
          <div>
            <Label>Username *</Label>
            <Input
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              placeholder="Enter login username"
            />
          </div>
          <div>
            <Label>{isEditMode ? "Password (leave blank to keep unchanged)" : "Password *"}</Label>
            <Input
              type="text"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              placeholder={isEditMode ? "Enter new password" : "Enter password"}
            />
          </div>
          <div>
            <Label>Role *</Label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Page Access</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 max-h-56 overflow-y-auto border border-gray-200 rounded-md p-3">
              {ASSIGNABLE_PAGES.map((pageName) => (
                <label key={pageName} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.page.includes(pageName)}
                    onChange={() => togglePage(pageName)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  {pageName}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md transition-all duration-300"
            >
              {isSubmitting && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              {isEditMode ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteTarget?.full_name}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
