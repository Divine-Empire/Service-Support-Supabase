import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase/client";

// The 5 stages this was seeded with. The admin can still add further stages
// beyond this list (see the "New Stage" modal) — this is just what's
// pre-populated with the 1-hour default.
const DEFAULT_STAGES = ["Warranty-Check", "Video-Call", "Quotation", "Follow-Up", "Warehouse"];

/** {days, hours, minutes} -> total minutes, for writing to duration_minutes. */
function durationToMinutes({ days, hours, minutes }) {
  const d = Number(days) || 0;
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return d * 24 * 60 + h * 60 + m;
}

/** total minutes -> {days, hours, minutes}, for prefilling the edit form. */
function minutesToDuration(totalMinutes) {
  const total = Number(totalMinutes) || 0;
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const minutes = total % 60;
  return { days, hours, minutes };
}

function formatDuration(totalMinutes) {
  const { days, hours, minutes } = minutesToDuration(totalMinutes);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

const emptyForm = { uuid: null, stageName: "", days: 0, hours: 1, minutes: 0 };

export default function TatConfig() {
  const [stages, setStages] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchStages = async () => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabase
        .from("tat_config")
        .select("*")
        .order("stage_name", { ascending: true });
      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error("Error fetching TAT config:", error);
      toast({ title: "Error", description: "Failed to load TAT config", variant: "destructive" });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (stage) => {
    setIsEditMode(true);
    const { days, hours, minutes } = minutesToDuration(stage.duration_minutes);
    setFormData({ uuid: stage.uuid, stageName: stage.stage_name, days, hours, minutes });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.stageName.trim()) {
      alert("Stage name is required");
      return;
    }

    const durationMinutes = durationToMinutes(formData);
    if (durationMinutes <= 0) {
      alert("TAT duration must be greater than 0");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const { error } = await supabase
          .from("tat_config")
          .update({
            stage_name: formData.stageName.trim(),
            duration_minutes: durationMinutes,
            updated_at: new Date().toISOString(),
          })
          .eq("uuid", formData.uuid);
        if (error) throw error;
        toast({ title: "Success", description: "TAT updated successfully" });
      } else {
        const { error } = await supabase.from("tat_config").insert({
          stage_name: formData.stageName.trim(),
          duration_minutes: durationMinutes,
        });
        if (error) throw error;
        toast({ title: "Success", description: "Stage added successfully" });
      }
      setShowModal(false);
      fetchStages();
    } catch (error) {
      console.error("Error saving TAT config:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") ? "That stage already exists" : "Failed to save TAT config",
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
      const { error } = await supabase.from("tat_config").delete().eq("uuid", deleteTarget.uuid);
      if (error) throw error;
      toast({ title: "Success", description: "Stage deleted successfully" });
      setDeleteTarget(null);
      fetchStages();
    } catch (error) {
      console.error("Error deleting TAT config:", error);
      toast({ title: "Error", description: "Failed to delete stage", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-blue-900 text-xl font-bold flex items-center gap-2">
            TAT Config
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {stages.length}
            </span>
          </h2>

          <Button
            onClick={openCreateModal}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-sm transition-all duration-300 rounded-lg px-4 py-2 flex items-center gap-1.5 group shrink-0 h-9"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            New Stage
          </Button>
        </CardHeader>

        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  <th className="text-white px-4 py-3 text-left w-[100px]">Actions</th>
                  <th className="text-white px-4 py-3 text-left">Stage</th>
                  <th className="text-white px-4 py-3 text-left">TAT</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-blue-100">
                {fetchLoading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8">
                      <div className="flex justify-center items-center text-blue-700">
                        <LoaderIcon className="animate-spin w-8 h-8" />
                      </div>
                    </td>
                  </tr>
                ) : stages.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-blue-700">
                      No stages configured.
                    </td>
                  </tr>
                ) : (
                  stages.map((stage, ind) => (
                    <tr key={stage.uuid} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditModal(stage)} className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-2">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(stage)} className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-2">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-blue-900 font-medium">{stage.stage_name}</td>
                      <td className="px-4 py-3 text-blue-900">{formatDuration(stage.duration_minutes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditMode ? "Edit Stage TAT" : "New Stage"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-2">
          <div>
            <Label>Stage Name *</Label>
            {isEditMode ? (
              <Input value={formData.stageName} disabled className="bg-slate-50" />
            ) : (
              <Input
                value={formData.stageName}
                onChange={(e) => setFormData((prev) => ({ ...prev, stageName: e.target.value }))}
                placeholder="e.g. Warranty-Check"
                list="default-stage-suggestions"
              />
            )}
            <datalist id="default-stage-suggestions">
              {DEFAULT_STAGES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <Label>TAT Duration *</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Input
                  type="number"
                  min="0"
                  value={formData.days}
                  onChange={(e) => setFormData((prev) => ({ ...prev, days: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Days</p>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  value={formData.hours}
                  onChange={(e) => setFormData((prev) => ({ ...prev, hours: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Hours</p>
              </div>
              <div>
                <Input
                  type="number"
                  min="0"
                  value={formData.minutes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, minutes: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Minutes</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              = {durationToMinutes(formData)} minutes total
            </p>
          </div>

          <div className="flex justify-end space-x-4 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              {isSubmitting && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              {isEditMode ? "Save Changes" : "Create Stage"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Stage"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-gray-700">
            Delete TAT config for <span className="font-semibold">{deleteTarget?.stage_name}</span>?
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
