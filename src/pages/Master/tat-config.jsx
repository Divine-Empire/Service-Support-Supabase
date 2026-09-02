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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Modal } from "../../components/ui/modal";
import { useToast } from "../../hooks/use-toast";
import { Loader2Icon, LoaderIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase/client";

// Every pipeline stage whose `<next_stage>_planned` is TAT-based (i.e. reads
// tat_config via src/lib/supabase/stagePlanning.js's computeStagePlanned),
// in pipeline order. "New Stage" only lets the admin pick from this fixed
// list (no more manual free-text stage names) — keeps stage_name values
// from ever drifting out of sync with what stagePlanning.js actually looks
// up. Add a stage's name here whenever a new TAT-driven rule is added to
// stagePlanning.js.
const ALL_STAGE_NAMES = [
  "Warranty-Check",
  "Video-Call",
  "Warehouse",
  "Quotation",
  "Follow-Up",
  "OTP Verification",
  "Invoice",
  "Calibration",
  "Calibration Certificate",
  "Spare Dispatch",
];

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

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

/** "10:00:00" -> "10:00" for a native <input type="time">. */
function toTimeInputValue(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).slice(0, 5);
}

const emptyForm = { uuid: null, stageName: "", days: 0, hours: 1, minutes: 0, responsiblePerson: "" };

export default function TatConfig() {
  const [activeTab, setActiveTab] = useState("stages");
  const { toast } = useToast();

  // ── Stages tab state ────────────────────────────────────────────────
  const [stages, setStages] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Office Hours tab state ──────────────────────────────────────────
  const [officeHours, setOfficeHours] = useState(null);
  const [officeHoursLoading, setOfficeHoursLoading] = useState(false);
  const [officeHoursForm, setOfficeHoursForm] = useState({ startTime: "10:00", endTime: "18:00", weeklyOffDays: [0] });
  const [isSavingOfficeHours, setIsSavingOfficeHours] = useState(false);

  // ── Holidays tab state ───────────────────────────────────────────────
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ uuid: null, holidayName: "", holidayDate: "" });
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [deleteHolidayTarget, setDeleteHolidayTarget] = useState(null);
  const [isDeletingHoliday, setIsDeletingHoliday] = useState(false);

  const fetchStages = async () => {
    setFetchLoading(true);
    try {
      const { data, error } = await supabase
        .from("sss_tat_config")
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

  const fetchOfficeHours = async () => {
    setOfficeHoursLoading(true);
    try {
      const { data, error } = await supabase.from("sss_office_hours").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      if (data) {
        setOfficeHours(data);
        setOfficeHoursForm({
          startTime: toTimeInputValue(data.start_time),
          endTime: toTimeInputValue(data.end_time),
          weeklyOffDays: data.weekly_off_days || [],
        });
      }
    } catch (error) {
      console.error("Error fetching office hours:", error);
      toast({ title: "Error", description: "Failed to load office hours", variant: "destructive" });
    } finally {
      setOfficeHoursLoading(false);
    }
  };

  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    try {
      const { data, error } = await supabase
        .from("sss_holidays")
        .select("*")
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      toast({ title: "Error", description: "Failed to load holidays", variant: "destructive" });
    } finally {
      setHolidaysLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
    fetchOfficeHours();
    fetchHolidays();
  }, []);

  // Stages not yet configured — the only ones selectable when creating a
  // new one (prevents duplicate stage_name rows via the dropdown itself).
  const availableStageNames = ALL_STAGE_NAMES.filter(
    (name) => !stages.some((s) => s.stage_name === name)
  );

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (stage) => {
    setIsEditMode(true);
    const { days, hours, minutes } = minutesToDuration(stage.duration_minutes);
    setFormData({
      uuid: stage.uuid,
      stageName: stage.stage_name,
      days,
      hours,
      minutes,
      responsiblePerson: stage.responsible_person || "",
    });
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
          .from("sss_tat_config")
          .update({
            stage_name: formData.stageName.trim(),
            duration_minutes: durationMinutes,
            responsible_person: formData.responsiblePerson.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("uuid", formData.uuid);
        if (error) throw error;
        toast({ title: "Success", description: "TAT updated successfully" });
      } else {
        const { error } = await supabase.from("sss_tat_config").insert({
          stage_name: formData.stageName.trim(),
          duration_minutes: durationMinutes,
          responsible_person: formData.responsiblePerson.trim() || null,
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
      const { error } = await supabase.from("sss_tat_config").delete().eq("uuid", deleteTarget.uuid);
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

  const toggleWeeklyOffDay = (dayValue) => {
    setOfficeHoursForm((prev) => {
      const has = prev.weeklyOffDays.includes(dayValue);
      return {
        ...prev,
        weeklyOffDays: has
          ? prev.weeklyOffDays.filter((d) => d !== dayValue)
          : [...prev.weeklyOffDays, dayValue].sort(),
      };
    });
  };

  const handleSaveOfficeHours = async (e) => {
    e.preventDefault();

    if (!officeHoursForm.startTime || !officeHoursForm.endTime) {
      alert("Please set both start and end time");
      return;
    }
    if (officeHoursForm.endTime <= officeHoursForm.startTime) {
      alert("End time must be after start time");
      return;
    }

    setIsSavingOfficeHours(true);
    try {
      const { error } = await supabase
        .from("sss_office_hours")
        .update({
          start_time: `${officeHoursForm.startTime}:00`,
          end_time: `${officeHoursForm.endTime}:00`,
          weekly_off_days: officeHoursForm.weeklyOffDays,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
      toast({ title: "Success", description: "Office hours updated successfully" });
      fetchOfficeHours();
    } catch (error) {
      console.error("Error saving office hours:", error);
      toast({ title: "Error", description: "Failed to save office hours", variant: "destructive" });
    } finally {
      setIsSavingOfficeHours(false);
    }
  };

  const openCreateHolidayModal = () => {
    setHolidayForm({ uuid: null, holidayName: "", holidayDate: "" });
    setShowHolidayModal(true);
  };

  const openEditHolidayModal = (holiday) => {
    setHolidayForm({ uuid: holiday.id, holidayName: holiday.holiday_name, holidayDate: holiday.holiday_date });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();

    if (!holidayForm.holidayName.trim()) {
      alert("Holiday name is required");
      return;
    }
    if (!holidayForm.holidayDate) {
      alert("Holiday date is required");
      return;
    }

    setIsSavingHoliday(true);
    try {
      if (holidayForm.uuid) {
        const { error } = await supabase
          .from("sss_holidays")
          .update({ holiday_name: holidayForm.holidayName.trim(), holiday_date: holidayForm.holidayDate })
          .eq("id", holidayForm.uuid);
        if (error) throw error;
        toast({ title: "Success", description: "Holiday updated successfully" });
      } else {
        const { error } = await supabase.from("sss_holidays").insert({
          holiday_name: holidayForm.holidayName.trim(),
          holiday_date: holidayForm.holidayDate,
        });
        if (error) throw error;
        toast({ title: "Success", description: "Holiday added successfully" });
      }
      setShowHolidayModal(false);
      fetchHolidays();
    } catch (error) {
      console.error("Error saving holiday:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") ? "A holiday is already set for that date" : "Failed to save holiday",
        variant: "destructive",
      });
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deleteHolidayTarget) return;
    setIsDeletingHoliday(true);
    try {
      const { error } = await supabase.from("sss_holidays").delete().eq("id", deleteHolidayTarget.id);
      if (error) throw error;
      toast({ title: "Success", description: "Holiday deleted successfully" });
      setDeleteHolidayTarget(null);
      fetchHolidays();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      toast({ title: "Error", description: "Failed to delete holiday", variant: "destructive" });
    } finally {
      setIsDeletingHoliday(false);
    }
  };

  const formatHolidayDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-t-lg border-b border-blue-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-blue-900 text-xl font-bold">TAT Config</h2>
              <TabsList className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <TabsTrigger value="stages" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Stages ({stages.length})
                </TabsTrigger>
                <TabsTrigger value="officeHours" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Office Hours
                </TabsTrigger>
                <TabsTrigger value="holidays" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Holidays ({holidays.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {activeTab === "stages" && (
              <Button
                onClick={openCreateModal}
                disabled={availableStageNames.length === 0}
                title={availableStageNames.length === 0 ? "All stages already configured" : undefined}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-sm transition-all duration-300 rounded-lg px-4 py-2 flex items-center gap-1.5 group shrink-0 h-9 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                New Stage
              </Button>
            )}
            {activeTab === "holidays" && (
              <Button
                onClick={openCreateHolidayModal}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-sm transition-all duration-300 rounded-lg px-4 py-2 flex items-center gap-1.5 group shrink-0 h-9"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                Add Holiday
              </Button>
            )}
          </CardHeader>

          <CardContent>
            {/* ── Stages tab ──────────────────────────────────────────── */}
            <TabsContent value="stages" className="mt-0">
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                      <th className="text-white px-4 py-3 text-left w-[100px]">Actions</th>
                      <th className="text-white px-4 py-3 text-left">Stage</th>
                      <th className="text-white px-4 py-3 text-left">TAT</th>
                      <th className="text-white px-4 py-3 text-left">Responsible Person</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-blue-100">
                    {fetchLoading ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8">
                          <div className="flex justify-center items-center text-blue-700">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        </td>
                      </tr>
                    ) : stages.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-blue-700">
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
                          <td className="px-4 py-3 text-blue-900">{stage.responsible_person || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Office Hours tab ────────────────────────────────────── */}
            <TabsContent value="officeHours" className="mt-0">
              {officeHoursLoading ? (
                <div className="flex justify-center items-center text-blue-700 py-8">
                  <LoaderIcon className="animate-spin w-8 h-8" />
                </div>
              ) : (
                <form onSubmit={handleSaveOfficeHours} className="max-w-lg space-y-4 p-2">
                  <p className="text-sm text-gray-600">
                    Every <code>&lt;next_stage&gt;_planned</code> timestamp across the app is confined to this
                    window — a stage submitted after closing time (or whose TAT runs past it) rolls over to the
                    next working day's opening time instead of landing outside office hours.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Time *</Label>
                      <Input
                        type="time"
                        value={officeHoursForm.startTime}
                        onChange={(e) => setOfficeHoursForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>End Time *</Label>
                      <Input
                        type="time"
                        value={officeHoursForm.endTime}
                        onChange={(e) => setOfficeHoursForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Weekly Off Days</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {WEEKDAYS.map((day) => {
                        const isOff = officeHoursForm.weeklyOffDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleWeeklyOffDay(day.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isOff
                                ? "bg-red-100 text-red-800 border-red-200"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      These recur every week automatically. For one-off dates (national/company holidays), use
                      the Holidays tab instead.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isSavingOfficeHours}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      {isSavingOfficeHours && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
                      Save Office Hours
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>

            {/* ── Holidays tab ────────────────────────────────────────── */}
            <TabsContent value="holidays" className="mt-0">
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                      <th className="text-white px-4 py-3 text-left w-[100px]">Actions</th>
                      <th className="text-white px-4 py-3 text-left">Date</th>
                      <th className="text-white px-4 py-3 text-left">Holiday Name</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-blue-100">
                    {holidaysLoading ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8">
                          <div className="flex justify-center items-center text-blue-700">
                            <LoaderIcon className="animate-spin w-8 h-8" />
                          </div>
                        </td>
                      </tr>
                    ) : holidays.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-blue-700">
                          No holidays added.
                        </td>
                      </tr>
                    ) : (
                      holidays.map((holiday, ind) => (
                        <tr key={holiday.id} className={ind % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditHolidayModal(holiday)} className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-2">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDeleteHolidayTarget(holiday)} className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-2">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-blue-900 font-medium">{formatHolidayDate(holiday.holiday_date)}</td>
                          <td className="px-4 py-3 text-blue-900">{holiday.holiday_name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Create / Edit Stage Modal */}
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
              <Select
                value={formData.stageName || undefined}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, stageName: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg">
                  {availableStageNames.length === 0 ? (
                    <SelectItem value="none" disabled>
                      All stages already configured
                    </SelectItem>
                  ) : (
                    availableStageNames.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
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

          <div>
            <Label>Responsible Person</Label>
            <Input
              value={formData.responsiblePerson}
              onChange={(e) => setFormData((prev) => ({ ...prev, responsiblePerson: e.target.value }))}
              placeholder="e.g. Piyush Tiwari"
            />
            <p className="text-xs text-gray-500 mt-1">
              Shown on Dashboard's "Generate Report" PDF as the person accountable for this stage's delay.
            </p>
          </div>

          <div className="flex justify-end space-x-4 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting || (!isEditMode && availableStageNames.length === 0)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isSubmitting && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              {isEditMode ? "Save Changes" : "Create Stage"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Stage confirmation */}
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

      {/* Add / Edit Holiday Modal */}
      <Modal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        title={holidayForm.uuid ? "Edit Holiday" : "Add Holiday"}
        size="sm"
      >
        <form onSubmit={handleSaveHoliday} className="space-y-4 p-2">
          <div>
            <Label>Holiday Name *</Label>
            <Input
              value={holidayForm.holidayName}
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, holidayName: e.target.value }))}
              placeholder="e.g. Diwali, Republic Day, Company Anniversary"
            />
          </div>
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={holidayForm.holidayDate}
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, holidayDate: e.target.value }))}
            />
          </div>
          <div className="flex justify-end space-x-4 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowHolidayModal(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSavingHoliday}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {isSavingHoliday && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              {holidayForm.uuid ? "Save Changes" : "Add Holiday"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Holiday confirmation */}
      <Modal
        isOpen={!!deleteHolidayTarget}
        onClose={() => setDeleteHolidayTarget(null)}
        title="Delete Holiday"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <p className="text-gray-700">
            Delete holiday <span className="font-semibold">{deleteHolidayTarget?.holiday_name}</span> (
            {formatHolidayDate(deleteHolidayTarget?.holiday_date)})?
          </p>
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => setDeleteHolidayTarget(null)}>Cancel</Button>
            <Button type="button" onClick={handleDeleteHoliday} disabled={isDeletingHoliday} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingHoliday && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
