import React, { useState, useEffect, useRef } from "react";
import {
  Home, Calendar, MessageCircle, FileText, User, Clock, CheckCircle,
  AlertTriangle, Video, Phone, Loader2, Plus, Trash2, Search,
  Shield, LogOut, Lock, Settings, Ban, RefreshCw, ChevronRight, Bell
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
import VideoCallModal from "@/components/videosdk/VideoCallModal";
import ExpertL3AlertPanel from "@/components/expert/ExpertL3AlertPanel";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabType = "home" | "schedule" | "sessions" | "notes" | "profile";

const TABS: { key: TabType; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "schedule", label: "Schedule", icon: Calendar },
  { key: "sessions", label: "Sessions", icon: MessageCircle },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "profile", label: "Profile", icon: User },
];

const ExpertDashboardContent = () => {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Call modal
  const captureSnippetRef = useRef<(() => Promise<string>) | null>(null);
  const [callModal, setCallModal] = useState<{ open: boolean; mode: "video" | "audio"; appointmentId?: string }>({ open: false, mode: "video" });

  // Session completion
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);

  // Slot creation dialog
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [slotDate, setSlotDate] = useState<Date>();
  const [slotStartTime, setSlotStartTime] = useState("09:00");
  const [slotEndTime, setSlotEndTime] = useState("10:00");
  const [slotInstitution, setSlotInstitution] = useState<string>("all");

  // Schedule calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");

  // Escalation dialog
  const [escalationDialog, setEscalationDialog] = useState<{ open: boolean; appointmentId?: string }>({ open: false });
  const [escalationReason, setEscalationReason] = useState("");

  // Reschedule dialog
  const [rescheduleDialog, setRescheduleDialog] = useState<{ open: boolean; appointmentId?: string; currentTime?: string; studentId?: string; studentName?: string }>({ open: false });
  const [rescheduleSlotId, setRescheduleSlotId] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  // Notes search/filter
  const [notesSearch, setNotesSearch] = useState("");
  const [notesFilterInstitution, setNotesFilterInstitution] = useState<string>("all");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Session timer
  const [sessionTimer, setSessionTimer] = useState<{ appointmentId: string; startTime: number } | null>(null);

  // Queries
  const { data: myAppointments = [], isLoading } = useQuery({
    queryKey: ["expert-appointments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*, student:profiles!appointments_student_id_fkey(username, institution_id)")
        .eq("expert_id", user.id)
        .order("slot_time", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: mySlots = [] } = useQuery({
    queryKey: ["expert-slots", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("expert_availability")
        .select("id, expert_id, start_time, end_time, is_booked, institution_id, recurrence_rule")
        .eq("expert_id", user.id)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Realtime listener for L3 handoff notifications
  useEffect(() => {
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`expert-l3-notifications-${user.id}-${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const notif = payload.new as any;
          if (notif?.type === "l3_handoff") {
            toast.error("🚨 L3 Critical Session — Immediate Attention Required", {
              description: notif.message?.substring(0, 150) || "A BlackBox session needs expert intervention",
              duration: 30000,
              action: {
                label: "Go to Alerts",
                onClick: () => setActiveTab("home"),
              },
            });
            // Switch to home tab to show ExpertL3AlertPanel
            setActiveTab("home");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);


  const createSlot = useMutation({
    mutationFn: async () => {
      if (!user || !slotDate) throw new Error("Select a date");
      const startDateTime = new Date(slotDate);
      const [sh, sm] = slotStartTime.split(":").map(Number);
      startDateTime.setHours(sh, sm, 0, 0);
      const endDateTime = new Date(slotDate);
      const [eh, em] = slotEndTime.split(":").map(Number);
      endDateTime.setHours(eh, em, 0, 0);
      if (endDateTime <= startDateTime) throw new Error("End time must be after start time");
      const { error } = await supabase.from("expert_availability").insert({
        expert_id: user.id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        institution_id: slotInstitution !== "all" ? slotInstitution : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-slots"] });
      toast.success("Slot created");
      setSlotDialogOpen(false);
      setSlotDate(undefined);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSlot = useMutation({
    mutationFn: async (slotId: string) => {
      // Set slot_id = null on any appointments referencing this slot first,
      // avoiding database foreign key constraint violations during deletion.
      await supabase.from("appointments").update({ slot_id: null } as any).eq("slot_id", slotId);
      
      const { error } = await supabase.from("expert_availability").delete().eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-slots"] });
      toast.success("Slot removed");
    },
    onError: (error: any) => {
      console.error("Failed to delete slot:", error);
      toast.error(error.message || "Failed to remove slot");
    },
  });

  const completeSession = useMutation({
    mutationFn: async ({ appointmentId, notes }: { appointmentId: string; notes: string }) => {
      const { error } = await supabase.from("appointments").update({
        status: "completed" as const,
        completed_at: new Date().toISOString(),
        session_notes_encrypted: notes,
      }).eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-appointments"] });
      toast.success("Session completed");
      setSessionNotes("");
      setSelectedAppointment(null);
      setSessionTimer(null);
    },
  });

  const updateAppointmentStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // If status is updated to cancelled, free the slot in expert_availability
      if (status === "cancelled") {
        const { data: appt } = await supabase
          .from("appointments")
          .select("slot_id")
          .eq("id", id)
          .single();
        if (appt?.slot_id) {
          await supabase
            .from("expert_availability")
            .update({ is_booked: false })
            .eq("id", appt.slot_id);
        }
      }

      const { error } = await supabase.from("appointments").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["expert-slots"] });
      toast.success("Appointment updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update appointment");
    },
  });

  const submitEscalation = useMutation({
    mutationFn: async () => {
      if (!user || !escalationDialog.appointmentId) throw new Error("Missing data");
      let snippet: string | null = null;
      if (captureSnippetRef.current) {
        toast.info("Capturing transcript (±10s)...");
        snippet = await captureSnippetRef.current();
      }
      const { data, error } = await supabase.functions.invoke("escalate-emergency", {
        body: {
          appointment_id: escalationDialog.appointmentId,
          justification: escalationReason,
          transcript_snippet: snippet || null,
        },
      });
      if (error) throw new Error(error.message || "Escalation failed");
      if (data?.error) throw new Error(data.error);
      if (data?.contact) {
        toast.info(`Emergency contact: ${data.contact.name} (${data.contact.phone})`);
      }
    },
    onSuccess: () => {
      toast.success("Escalation submitted to SPOC with emergency contact");
      setEscalationDialog({ open: false });
      setEscalationReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: async ({ appointmentId, notes }: { appointmentId: string; notes: string }) => {
      const { error } = await supabase.from("appointments").update({
        session_notes_encrypted: notes,
      }).eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-appointments"] });
      toast.success("Note saved");
      setEditingNoteId(null);
      setEditingNoteText("");
    },
  });

  // Derived data
  const upcoming = myAppointments.filter((a) => a.status === "pending" || a.status === "confirmed");
  const completed = myAppointments.filter((a) => a.status === "completed");
  const futureSlots = mySlots.filter((s) => new Date(s.start_time) > new Date());

  // Calendar helpers
  const getCalendarDays = () => {
    if (calendarView === "month") {
      const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(calendarMonth, { weekStartsOn: 1 });
      const end = endOfWeek(calendarMonth, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
  };

  const getSlotsForDay = (day: Date) => mySlots.filter((s) => isSameDay(new Date(s.start_time), day));
  const getAppointmentsForDay = (day: Date) => myAppointments.filter((a) => isSameDay(new Date(a.slot_time), day));

  // Notes filtering
  const filteredNotes = myAppointments
    .filter((a: any) => a.session_notes_encrypted)
    .filter((a: any) => {
      if (notesSearch && !(a.student?.username || "").toLowerCase().includes(notesSearch.toLowerCase()) && !a.session_notes_encrypted.toLowerCase().includes(notesSearch.toLowerCase())) return false;
      if (notesFilterInstitution !== "all" && a.student?.institution_id !== notesFilterInstitution) return false;
      return true;
    });

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl xl:text-3xl font-bold font-display">Expert Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage appointments, schedule & sessions</p>
          </div>
          
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-3 xl:px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 justify-center",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* =================== HOME TAB =================== */}
        {activeTab === "home" && (
          <div className="space-y-4">
            {/* L3 Emergency Alerts */}
            <ExpertL3AlertPanel />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold font-display">Appointments</h2>
              <Button size="sm" className="gap-1.5" onClick={() => { setActiveTab("schedule"); }}>
                <Plus className="w-4 h-4" />Add Availability
              </Button>
            </div>

            {upcoming.length === 0 && completed.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No appointments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...upcoming, ...completed.slice(0, 5)].map((apt: any) => (
                  <div key={apt.id} className="p-4 rounded-xl bg-card border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                        apt.status === "completed"
                          ? "bg-eternia-success/10"
                          : "bg-gradient-to-br from-emerald-500 to-teal-500"
                      )}>
                        {apt.status === "completed"
                          ? <CheckCircle className="w-5 h-5 text-eternia-success" />
                          : apt.session_type === "video"
                            ? <Video className="w-5 h-5 text-white" />
                            : <Phone className="w-5 h-5 text-white" />
                        }
                      </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">{apt.student?.username || "Student"}</p>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                            apt.status === "completed" ? "bg-eternia-success/10 text-eternia-success"
                              : apt.status === "confirmed" ? "bg-primary/10 text-primary"
                                : apt.status === "cancelled" ? "bg-destructive/10 text-destructive"
                                  : "bg-eternia-warning/10 text-eternia-warning"
                          )}>{apt.status}</span>
                          {apt.status !== "completed" && apt.status !== "cancelled" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent-foreground flex items-center gap-1">
                              <Shield className="w-3 h-3 text-primary" />AI Monitor: Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{format(new Date(apt.slot_time), "EEE, MMM d · h:mm a")}</p>

                        {apt.status !== "completed" && apt.status !== "cancelled" && (
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <Button size="sm" className="gap-1 h-7 text-[11px] px-3" onClick={() => {
                              setCallModal({ open: true, mode: apt.session_type === "video" ? "video" : "audio", appointmentId: apt.id });
                              setSessionTimer({ appointmentId: apt.id, startTime: Date.now() });
                            }}>
                              {apt.session_type === "video" ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}Join Session
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] px-3" onClick={() => setRescheduleDialog({ open: true, appointmentId: apt.id, currentTime: apt.slot_time, studentId: apt.student_id, studentName: apt.student?.username })}>
                              <RefreshCw className="w-3 h-3" />Reschedule
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] px-3 text-eternia-warning" onClick={() => setEscalationDialog({ open: true, appointmentId: apt.id })}>
                              <AlertTriangle className="w-3 h-3" />Escalate
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-7 text-[11px] px-3 text-muted-foreground" onClick={() => setActiveTab("notes")}>
                              <FileText className="w-3 h-3" />View History
                            </Button>
                          </div>
                        )}
                        {apt.status === "completed" && (
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] px-3 text-eternia-warning" onClick={() => setEscalationDialog({ open: true, appointmentId: apt.id })}>
                              <AlertTriangle className="w-3 h-3" />Escalate
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-7 text-[11px] px-3 text-muted-foreground" onClick={() => setActiveTab("notes")}>
                              <FileText className="w-3 h-3" />View Notes
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================== SCHEDULE TAB =================== */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {/* Calendar controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </Button>
                <h2 className="text-base font-semibold font-display min-w-[140px] text-center">{format(calendarMonth, "MMMM yyyy")}</h2>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="flex bg-muted/50 rounded-lg p-0.5 ml-2">
                  <button onClick={() => setCalendarView("month")} className={cn("px-3 py-1 rounded-md text-xs font-medium", calendarView === "month" ? "bg-background shadow-sm" : "text-muted-foreground")}>Month</button>
                  <button onClick={() => setCalendarView("week")} className={cn("px-3 py-1 rounded-md text-xs font-medium", calendarView === "week" ? "bg-background shadow-sm" : "text-muted-foreground")}>Week</button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" className="gap-1.5 h-8" onClick={() => setSlotDialogOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />Add Slot
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => toast.info("Block slot feature coming soon")}>
                  <Ban className="w-3.5 h-3.5" />Block Slot
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => toast.info("Recurring slots coming soon")}>
                  <RefreshCw className="w-3.5 h-3.5" />Recurring
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-eternia-success/30 border border-eternia-success/50" />Free</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/30 border border-primary/50" />Booked</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted border border-border" />Blocked</span>
            </div>

            {/* Calendar grid */}
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {getCalendarDays().map((day, i) => {
                  const daySlots = getSlotsForDay(day);
                  const dayAppts = getAppointmentsForDay(day);
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={i} className={cn(
                      "min-h-[60px] xl:min-h-[80px] p-1.5 border-b border-r border-border/30",
                      !isCurrentMonth && "opacity-30",
                      isToday && "bg-primary/5"
                    )}>
                      <p className={cn("text-xs font-medium mb-1", isToday && "text-primary")}>{format(day, "d")}</p>
                      <div className="space-y-0.5">
                        {daySlots.map((slot) => (
                          <div key={slot.id} className={cn(
                            "px-1 py-0.5 rounded text-[9px] truncate",
                            slot.is_booked
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-eternia-success/20 text-eternia-success border border-eternia-success/30"
                          )}>
                            {format(new Date(slot.start_time), "HH:mm")}
                          </div>
                        ))}
                        {dayAppts.filter((a) => !daySlots.some((s) => s.id === a.slot_id)).map((apt) => (
                          <div key={apt.id} className="px-1 py-0.5 rounded text-[9px] truncate bg-primary/20 text-primary border border-primary/30">
                            {format(new Date(apt.slot_time), "HH:mm")}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming slots list */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Upcoming Slots ({futureSlots.length})</h3>
              {futureSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 bg-card rounded-xl border border-border/50">No upcoming slots</p>
              ) : (
                <div className="space-y-2">
                  {futureSlots.map((slot) => (
                    <div key={slot.id} className="p-3 rounded-xl bg-card border border-border/50 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(slot.start_time), "EEE, MMM d")}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(slot.start_time), "h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}</p>
                      </div>
                      {slot.is_booked ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">Booked</span>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteSlot.mutate(slot.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================== SESSIONS TAB =================== */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold font-display">All Sessions</h2>
            {myAppointments.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No sessions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myAppointments.map((apt: any) => (
                  <div key={apt.id} className={cn(
                    "p-4 rounded-xl border",
                    apt.status === "cancelled" ? "bg-muted/20 border-border/30" : "bg-card border-border/50"
                  )}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">{apt.student?.username || "Student"}</p>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                            apt.status === "completed" ? "bg-eternia-success/10 text-eternia-success"
                              : apt.status === "confirmed" ? "bg-primary/10 text-primary"
                                : apt.status === "cancelled" ? "bg-destructive/10 text-destructive"
                                  : "bg-eternia-warning/10 text-eternia-warning"
                          )}>{apt.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{format(new Date(apt.slot_time), "EEE, MMM d · h:mm a")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(apt.status === "pending" || apt.status === "confirmed") && (
                          <>
                            <Button size="sm" className="gap-1 h-7 text-[11px] px-2.5" onClick={() => {
                              setCallModal({ open: true, mode: apt.session_type === "video" ? "video" : "audio", appointmentId: apt.id });
                              setSessionTimer({ appointmentId: apt.id, startTime: Date.now() });
                            }}>
                              {apt.session_type === "video" ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}Join
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" onClick={() => updateAppointmentStatus.mutate({ id: apt.id, status: "cancelled" })}>Cancel</Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" onClick={() => setRescheduleDialog({ open: true, appointmentId: apt.id, currentTime: apt.slot_time, studentId: apt.student_id, studentName: (apt as any).student?.username })}>
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        {apt.status === "completed" && (
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] px-2.5 text-eternia-warning" onClick={() => setEscalationDialog({ open: true, appointmentId: apt.id })}>
                            <AlertTriangle className="w-3 h-3" />Escalate
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* In-session controls when session timer is active */}
                    {sessionTimer?.appointmentId === apt.id && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-eternia-success animate-pulse" />
                            <span className="text-xs font-medium text-eternia-success">Session Active</span>
                          </div>
                          <SessionTimerDisplay startTime={sessionTimer.startTime} />
                        </div>
                        <Textarea placeholder="Session notes (encrypted)..." value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} className="min-h-[60px] bg-muted/30 text-sm mb-2" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="destructive" className="gap-1 h-7 text-[11px]" onClick={() => {
                            setCallModal({ open: false, mode: "video" });
                            setSessionTimer(null);
                          }}>End Call</Button>
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] text-destructive border-destructive/30" onClick={() => setEscalationDialog({ open: true, appointmentId: apt.id })}>
                            <AlertTriangle className="w-3 h-3" />Escalate
                          </Button>
                          <Button size="sm" className="gap-1 h-7 text-[11px]" onClick={() => completeSession.mutate({ appointmentId: apt.id, notes: sessionNotes })} disabled={completeSession.isPending}>
                            <CheckCircle className="w-3 h-3" />Complete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================== NOTES TAB =================== */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold font-display">Session Notes</h2>

            {/* Search & Filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by student or content..." value={notesSearch} onChange={(e) => setNotesSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <Select value={notesFilterInstitution} onValueChange={setNotesFilterInstitution}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Institution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Institutions</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredNotes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No session notes found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotes.map((apt: any) => (
                  <div key={apt.id} className="p-4 rounded-xl bg-card border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{apt.student?.username || "Student"}</p>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(apt.slot_time), "MMM d, yyyy · h:mm a")}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => {
                        if (editingNoteId === apt.id) {
                          saveNote.mutate({ appointmentId: apt.id, notes: editingNoteText });
                        } else {
                          setEditingNoteId(apt.id);
                          setEditingNoteText(apt.session_notes_encrypted || "");
                        }
                      }}>
                        {editingNoteId === apt.id ? "Save" : "Edit"}
                      </Button>
                    </div>
                    {editingNoteId === apt.id ? (
                      <Textarea value={editingNoteText} onChange={(e) => setEditingNoteText(e.target.value)} className="min-h-[60px] bg-muted/30 text-sm" />
                    ) : (
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{apt.session_notes_encrypted}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================== PROFILE TAB =================== */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-eternia flex items-center justify-center shrink-0">
                  <User className="w-8 h-8 text-background" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold font-display">{profile?.username || "Expert"}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{profile?.role}</p>
                  {profile?.specialty && <p className="text-sm text-primary mt-1">{profile.specialty}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Licence No.</p>
                  <p className="text-sm font-medium">—</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">CRR Verification</p>
                  <div className="flex items-center gap-1.5">
                    {profile?.is_verified ? (
                      <><CheckCircle className="w-4 h-4 text-eternia-success" /><span className="text-sm font-medium text-eternia-success">Verified</span></>
                    ) : (
                      <><Clock className="w-4 h-4 text-eternia-warning" /><span className="text-sm font-medium text-eternia-warning">Pending</span></>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                  <p className="text-sm font-medium">{profile?.total_sessions || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium">{profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "—"}</p>
                </div>
              </div>
            </div>

            {profile?.bio && (
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Bio</p>
                <p className="text-sm">{profile.bio}</p>
              </div>
            )}

            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-between h-10 text-sm" onClick={() => setActiveTab("schedule")}>
                Edit Availability<ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between h-10 text-sm" onClick={() => toast.info("Password change coming soon")}>
                Change Password<ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between h-10 text-sm text-destructive hover:text-destructive" onClick={signOut}>
                <span className="flex items-center gap-2"><LogOut className="w-4 h-4" />Logout</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Slot Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Availability Slot</DialogTitle>
            <DialogDescription>Create a new time slot for student bookings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 text-sm", !slotDate && "text-muted-foreground")}>
                  <Calendar className="w-4 h-4 mr-2" />{slotDate ? format(slotDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker mode="single" selected={slotDate} onSelect={setSlotDate} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Start Time</label><Input type="time" value={slotStartTime} onChange={(e) => setSlotStartTime(e.target.value)} className="h-10 text-sm" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">End Time</label><Input type="time" value={slotEndTime} onChange={(e) => setSlotEndTime(e.target.value)} className="h-10 text-sm" /></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Institution</label>
              <Select value={slotInstitution} onValueChange={setSlotInstitution}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="All institutions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Institutions</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>Cancel</Button>
            <Button disabled={!slotDate || createSlot.isPending} onClick={() => createSlot.mutate()}>
              {createSlot.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalation Dialog */}
      <Dialog open={escalationDialog.open} onOpenChange={(o) => setEscalationDialog({ open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Submit Escalation</DialogTitle>
            <DialogDescription>Describe the reason for escalation. This will be reviewed by the institution SPOC.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for escalation..." value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalationDialog({ open: false })}>Cancel</Button>
            <Button variant="destructive" disabled={!escalationReason.trim() || submitEscalation.isPending} onClick={() => submitEscalation.mutate()}>
              {submitEscalation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialog.open} onOpenChange={(o) => { if (!o) { setRescheduleDialog({ open: false }); setRescheduleReason(""); setRescheduleSlotId(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" />Reschedule Appointment</DialogTitle>
            <DialogDescription>Pick a new slot and provide a reason for rescheduling.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {rescheduleDialog.currentTime && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
                <p className="text-xs text-muted-foreground mb-1">Current time</p>
                <p className="font-medium">{format(new Date(rescheduleDialog.currentTime), "EEE, MMM d · h:mm a")}</p>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">New Slot</label>
              <Select value={rescheduleSlotId} onValueChange={setRescheduleSlotId}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select a slot" /></SelectTrigger>
                <SelectContent>
                  {futureSlots.filter(s => !s.is_booked).map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {format(new Date(slot.start_time), "EEE, MMM d · h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reason for rescheduling</label>
              <Textarea placeholder="e.g. Emergency, schedule conflict..." value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} className="min-h-[80px] text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRescheduleDialog({ open: false }); setRescheduleReason(""); setRescheduleSlotId(""); }}>Cancel</Button>
            <Button
              disabled={!rescheduleSlotId || !rescheduleReason.trim()}
              onClick={async () => {
                if (!user || !rescheduleDialog.appointmentId) return;
                const selectedSlot = futureSlots.find(s => s.id === rescheduleSlotId);
                if (!selectedSlot) return;
                try {
                  // Update appointment
                  const { error } = await supabase.from("appointments").update({
                    slot_time: selectedSlot.start_time,
                    slot_id: selectedSlot.id,
                    rescheduled_from: rescheduleDialog.currentTime,
                    rescheduled_by: user.id,
                    reschedule_reason: rescheduleReason,
                  } as any).eq("id", rescheduleDialog.appointmentId);
                  if (error) throw error;

                  // Mark new slot as booked
                  await supabase.from("expert_availability").update({ is_booked: true }).eq("id", selectedSlot.id);

                  // Notify student
                  if (rescheduleDialog.studentId) {
                    await supabase.from("notifications").insert({
                      user_id: rescheduleDialog.studentId,
                      type: "reschedule",
                      title: "Appointment Rescheduled",
                      message: `Dr. ${profile?.username || "Expert"} rescheduled your appointment. Reason: ${rescheduleReason}`,
                      metadata: {
                        appointment_id: rescheduleDialog.appointmentId,
                        old_time: rescheduleDialog.currentTime,
                        new_time: selectedSlot.start_time,
                        expert_name: profile?.username,
                        reason: rescheduleReason,
                      },
                    } as any);
                  }

                  queryClient.invalidateQueries({ queryKey: ["expert-appointments"] });
                  queryClient.invalidateQueries({ queryKey: ["expert-slots"] });
                  toast.success("Appointment rescheduled & student notified");
                  setRescheduleDialog({ open: false });
                  setRescheduleReason("");
                  setRescheduleSlotId("");
                } catch (err: any) {
                  toast.error(err.message || "Failed to reschedule");
                }
              }}
              className="gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />Confirm Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VideoCallModal isOpen={callModal.open} onClose={() => setCallModal({ open: false, mode: "video" })} participantName={profile?.username || "Expert"} mode={callModal.mode} appointmentId={callModal.appointmentId} enableMonitoring={true} onCaptureSnippetReady={(fn) => { captureSnippetRef.current = fn; }} onEscalate={() => { if (callModal.appointmentId) { setEscalationDialog({ open: true, appointmentId: callModal.appointmentId }); } }} />
    </DashboardLayout>
  );
};

// Session timer component
function SessionTimerDisplay({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded">
      <Clock className="w-3 h-3 inline mr-1" />
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

export default ExpertDashboardContent;
