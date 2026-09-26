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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { useToast } from "../../hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Users as UsersIcon,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { navigation } from "../../components/Sidebar";

const ROLES = ["admin", "user", "engineer"];

// Pages that are always visible regardless of the page-access list, so
// offering them as toggles here wouldn't do anything — leave them out.
const ASSIGNABLE_PAGES = navigation
  .map((item) => item.name)
  .filter((name) => !["Service Installation", "Settings", "Master"].includes(name));

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
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());
  const { toast } = useToast();

  const fetchUsers = async () => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabase.rpc("sss_admin_list_users");
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

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

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

  const handleRoleChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      role: value,
      page: value === "admin" ? [...ASSIGNABLE_PAGES] : prev.page,
    }));
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData(emptyForm);
    setShowPassword(false);
    setIsUserDialogOpen(true);
  };

  const openEditModal = (user) => {
    setIsEditMode(true);
    setFormData({
      uuid: user.uuid,
      fullName: user.full_name || "",
      username: user.username || "",
      password: user.password || "",
      role: user.role || "user",
      page: Array.isArray(user.page) ? user.page.map((p) => p.trim()) : [],
    });
    setShowPassword(true);
    setIsUserDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      toast({ title: "Missing information", description: "Full name is required.", variant: "destructive" });
      return;
    }
    if (!formData.username.trim()) {
      toast({ title: "Missing information", description: "Username is required.", variant: "destructive" });
      return;
    }
    if (!isEditMode && !formData.password.trim()) {
      toast({ title: "Missing information", description: "Password is required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const { error } = await supabase.rpc("sss_admin_update_user", {
          p_uuid: formData.uuid,
          p_full_name: formData.fullName.trim(),
          p_username: formData.username.trim(),
          p_role: formData.role,
          p_page: formData.page,
          p_password: formData.password.trim() || null,
        });
        if (error) throw error;
        toast({ title: "User updated", description: `${formData.username} has been updated successfully.` });
      } else {
        const { error } = await supabase.rpc("sss_admin_create_user", {
          p_full_name: formData.fullName.trim(),
          p_username: formData.username.trim(),
          p_password: formData.password.trim(),
          p_role: formData.role,
          p_page: formData.page,
        });
        if (error) throw error;
        toast({ title: "User created", description: `${formData.username} has been created successfully.` });
      }
      setIsUserDialogOpen(false);
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
      const { error } = await supabase.rpc("sss_admin_delete_user", {
        p_uuid: deleteTarget.uuid,
      });
      if (error) throw error;
      toast({ title: "User deleted", description: `${deleteTarget.full_name} has been removed successfully.` });
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
      <Tabs defaultValue="users">
        <Card>
          <CardHeader className="border-b py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="users" className="gap-2 font-medium">
                  <UsersIcon className="h-4 w-4" />
                  User Management
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button onClick={fetchUsers} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={openCreateModal}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <TabsContent value="users" className="mt-0">
              {/* Sub-header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50/50">
                <p className="text-sm text-muted-foreground">
                  Manage application accounts, credentials, and stage access permissions
                </p>
                <Badge variant="outline" className="font-mono shrink-0">
                  {users.length} Active Users
                </Badge>
              </div>

              {fetchLoading ? (
                <div className="flex items-center justify-center h-48">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                  <span className="ml-2 text-muted-foreground">Loading users...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[100px]">Actions</TableHead>
                        <TableHead className="w-[180px]">Full Name</TableHead>
                        <TableHead className="w-[150px]">Username</TableHead>
                        <TableHead className="w-[160px]">Password</TableHead>
                        <TableHead className="w-[120px]">Role</TableHead>
                        <TableHead>Page Access</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.uuid} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => openEditModal(user)}
                              >
                                <Edit className="h-4 w-4 text-slate-600 hover:text-indigo-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => setDeleteTarget(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-800">
                            {user.full_name}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {user.username}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-mono text-sm">
                              <span>
                                {visiblePasswords.has(user.uuid)
                                  ? user.password || "—"
                                  : "••••••••"}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(user.uuid)}
                                className="text-gray-400 hover:text-gray-600"
                                tabIndex={-1}
                              >
                                {visiblePasswords.has(user.uuid) ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.role === "admin" ? "default" : "secondary"}
                              className="capitalize text-xs font-semibold"
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.role === "admin" ||
                              (Array.isArray(user.page) && user.page.length >= ASSIGNABLE_PAGES.length) ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                                >
                                  All Steps (Full Access)
                                </Badge>
                              ) : !Array.isArray(user.page) || user.page.length === 0 ? (
                                <span className="text-xs text-muted-foreground italic">
                                  No pages assigned
                                </span>
                              ) : (
                                user.page.map((p) => (
                                  <Badge
                                    key={p}
                                    variant="outline"
                                    className="text-xs bg-slate-50 text-slate-700 border-slate-200"
                                  >
                                    {p.trim()}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            No users found in database
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* DIALOG: User Create / Edit */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit User Account" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update credentials, role, and assigned page access"
                : "Create a new user profile with specific page permissions"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Row 1: Username + Full Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  placeholder="e.g. jdoe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
            </div>

            {/* Row 2: Password + Role */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password {isEditMode ? "" : "*"}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    placeholder={isEditMode ? "Leave blank to keep unchanged" : "Enter password"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={handleRoleChange}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role} className="capitalize">
                        {role === "admin"
                          ? "Admin (Full Access & Settings)"
                          : role === "user"
                          ? "User (Assigned Pages Only)"
                          : "Engineer"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Page Access */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Page Access</Label>
                {formData.role === "admin" ? (
                  <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                    <Lock className="h-3 w-3" />
                    Auto-granted (Admin)
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs text-indigo-600"
                    onClick={() => {
                      if (formData.page.length === ASSIGNABLE_PAGES.length) {
                        setFormData((prev) => ({ ...prev, page: [] }));
                      } else {
                        setFormData((prev) => ({ ...prev, page: [...ASSIGNABLE_PAGES] }));
                      }
                    }}
                  >
                    {formData.page.length === ASSIGNABLE_PAGES.length
                      ? "Deselect All"
                      : "Select All Pages"}
                  </Button>
                )}
              </div>
              {formData.role === "admin" && (
                <p className="text-xs text-muted-foreground">
                  Admins automatically get access to every page — the list below is locked and informational only.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3 bg-slate-50/50">
                {ASSIGNABLE_PAGES.map((pageName) => (
                  <div key={pageName} className="flex items-center space-x-2">
                    <Checkbox
                      id={`page-${pageName}`}
                      checked={
                        formData.role === "admin" ? true : formData.page.includes(pageName)
                      }
                      disabled={formData.role === "admin"}
                      onCheckedChange={() => togglePage(pageName)}
                    />
                    <Label
                      htmlFor={`page-${pageName}`}
                      className={`text-sm font-normal ${
                        formData.role === "admin" ? "text-muted-foreground" : "cursor-pointer"
                      }`}
                    >
                      {pageName}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  !formData.username ||
                  !formData.fullName ||
                  (!isEditMode && !formData.password)
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmitting && <RefreshCw className="animate-spin w-4 h-4 mr-2" />}
                {isEditMode ? "Update User" : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.full_name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting && <RefreshCw className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
