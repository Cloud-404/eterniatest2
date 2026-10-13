import { useState, useRef } from "react";
import {
  Home, Calendar, MessageCircle, FileText, User, Clock, CheckCircle,
  AlertTriangle, Video, Phone, Loader2, Plus, Trash2, Search,
  LogOut, RefreshCw, ChevronRight
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
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabType = "home" | "schedule" | "sessions" | "notes" | "profile";

const MobileExpertDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const captureSnippetRef = useRef<(() => Promise<string>) | null>(null);
  const [callModal, setCallModal] = useState<{ open: boolean; mode: "video" | "audio"; appointmentId?: string }>({ open: false, mode: "video" });
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);

  // Slot dialog
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [slotDate, setSlotDate] = useState<Date>();
  const [slotStartTime, setSlotStartTime] = useState("09:00");
  const [slotEndTime, setSlotEndTime] = useState("10:00");
  const [slotInstitution, setSlotInstitution] = useState<string>("all");

  // Escalation
  const [escalationDialog, setEscalationDialog] = useState<{ open: boolean; appointmentId?: string }>({ open: false });
  const [escalationReason, setEscalationReason] = useState("");

  // Reschedule
  const [rescheduleDialog, setRescheduleDialog] = useState<{ open: boolean; appointmentId?: string; currentTime?: string; studentId?: string }>({ open: false });
  const [rescheduleSlotId, setRescheduleSlotId] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  // Notes
  const [notesSearch, setNotesSearch] = useState("");

  // Queries
  const { data: myAppointments = [], isLoading } = useQuery({
    queryKey: ["expert-appointments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("appointments").select("*, student:profiles!appointments_student_id_fkey(username, institution_id)").eq("expert_id", user.id).order("slot_time", { ascending: true });
      if (error) throw error; return data;
    }, enabled: !!user,
  });

  const { data: mySlots = [] } = useQuery({
    queryKey: ["expert-slots", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("expert_availability").select("*").eq("expert_id", user.id).order("start_time", { ascending: true });
      if (error) throw error; return data;
    }, enabled: !!user,
  });

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").eq("is_active", true);
      if (error) throw error; return data;
    },
  });

  const createSlot = useMutation({
    mutationFn: async () => {
      if (!user || !slotDate) throw new Error("Select a date");
      const s = new Date(slotDate); const [sh, sm] = slotStartTime.split(":").map(Number); s.setHours(sh, sm, 0, 0);
      const e = new Date(slotDate); const [eh, em] = slotEndTime.split(":").map(Number); e.setHours(eh, em, 0, 0);
      if (e <= s) throw new Error("End time must be after start time");
      const { error } = await supabase.from("expert_availability").insert({ expert_id: user.id, start_time: s.toISOString(), end_time: e.toISOString(), institution_id: slotInstitution !== "all" ? slotInstitution : null });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expert-slots"] }); toast.success("Slot created"); setSlotDialogOpen(false); setSlotDate(undefined); },
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
      const { error } = await supabase.from("appointments").update({ status: "completed" as const, completed_at: new Date().toISOString(), session_notes_encrypted: notes }).eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expert-appointments"] }); toast.success("Session completed"); setSessionNotes(""); setSelectedAppointment(null); },
  });

  const upcoming = myAppointments.filter((a) => a.status === "pending" || a.status === "confirmed");
  const completed = myAppointments.filter((a) => a.status === "completed");
  const futureSlots = mySlots.filter((s) => new Date(s.start_time) > new Date());

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
    onSuccess: () => { toast.success("Escalation submitted with emergency contact"); setEscalationDialog({ open: false }); setEscalationReason(""); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  const tabs: { key: TabType; icon: typeof Home; label: string }[] = [
    { key: "home", icon: Home, label: "Home" },
    { key: "schedule", icon: Calendar, label: "Schedule" },
    { key: "sessions", icon: MessageCircle, label: "Sessions" },
    { key: "notes", icon: FileText, label: "Notes" },
    { key: "profile", icon: User, label: "Profile" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-28">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-display">Expert Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your practice</p>
          </div>
          
        </div>

        {/* Fixed bottom tab bar - replaces DashboardLayout's bottom nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-[60] bg-background/95 backdrop-blur-xl border-t border-border/30"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex items-center justify-around h-16">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[44px] min-h-[44px] transition-colors active:opacity-70",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className="relative">
                    <tab.icon className={cn("w-5 h-5", active ? "stroke-[2.5]" : "stroke-[1.5]")} />
                    {active && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className={cn("text-[10px] leading-none", active ? "font-semibold" : "font-normal")}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* HOME */}
        {activeTab === "home" && (
          <div className="space-y-3">
            {/* L3 Emergency Alerts */}
            <ExpertL3AlertPanel />
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Appointments</p>
              <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => setSlotDialogOpen(true)}><Plus className="w-3.5 h-3.5" />Add Slot</Button>
            </div>
            {[...upcoming, ...completed.slice(0, 3)].map((apt: any) => (
              <div key={apt.id} className="p-4 rounded-2xl bg-card border border-border/50">
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    apt.status === "completed" ? "bg-eternia-success/10" : "bg-gradient-to-br from-emerald-500 to-teal-500"
                  )}>
                    {apt.status === "completed" ? <CheckCircle className="w-5 h-5 text-eternia-success" /> : apt.session_type === "video" ? <Video className="w-5 h-5 text-white" /> : <Phone className="w-5 h-5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{apt.student?.username}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(apt.slot_time), "MMM d · h:mm a")}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px]",
                        apt.status === "completed" ? "bg-eternia-success/10 text-eternia-success" : "bg-eternia-warning/10 text-eternia-warning"
                      )}>{apt.status}</span>
                      {apt.status !== "completed" && apt.status !== "cancelled" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-accent/10 text-accent-foreground flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5 text-primary" />AI Monitor
                        </span>
                      )}
                    </div>
                    {apt.status !== "completed" && apt.status !== "cancelled" && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Button size="sm" className="gap-1 h-7 text-[10px] px-2" onClick={() => setCallModal({ open: true, mode: apt.session_type === "video" ? "video" : "audio", appointmentId: apt.id })}>Join</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setRescheduleDialog({ open: true, appointmentId: apt.id, currentTime: apt.slot_time, studentId: apt.student_id })}><RefreshCw className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 text-eternia-warning" onClick={() => setEscalationDialog({ open: true, appointmentId: apt.id })}><AlertTriangle className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setSelectedAppointment(apt.id)}>Complete</Button>
                      </div>
                    )}
                    {apt.status === "completed" && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 text-eternia-warning" onClick={() => setEscalationDialog({ open: true, appointmentId: apt.id })}><AlertTriangle className="w-3 h-3" />Escalate</Button>
                      </div>
                    )}
                  </div>
                </div>
                {selectedAppointment === apt.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <Textarea placeholder="Session notes..." value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} className="min-h-[60px] bg-muted/30 text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => completeSession.mutate({ appointmentId: apt.id, notes: sessionNotes })} disabled={completeSession.isPending} className="gap-1 h-8 text-xs"><CheckCircle className="w-3.5 h-3.5" />Done</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedAppointment(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {upcoming.length === 0 && completed.length === 0 && (
              <div className="text-center py-10 text-muted-foreground"><Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="text-sm">No appointments</p></div>
            )}
          </div>
        )}

        {/* SCHEDULE */}
        {activeTab === "schedule" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Your Slots ({futureSlots.length})</p>
              <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => setSlotDialogOpen(true)}><Plus className="w-3.5 h-3.5" />Add</Button>
            </div>
            {futureSlots.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No upcoming slots</p>
              : futureSlots.map((slot) => (
                <div key={slot.id} className="p-3 rounded-2xl bg-card border border-border/50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{format(new Date(slot.start_time), "EEE, MMM d")}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(slot.start_time), "h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}</p>
                  </div>
                  {slot.is_booked ? <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">Booked</span>
                    : <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteSlot.mutate(slot.id)}><Trash2 className="w-4 h-4" /></Button>}
                </div>
              ))}
          </div>
        )}

        {/* SESSIONS */}
        {activeTab === "sessions" && (
          <div className="space-y-2">
            {myAppointments.length === 0 ? <div className="text-center py-10 text-muted-foreground"><MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="text-sm">No sessions</p></div>
              : myAppointments.map((apt: any) => (
                <div key={apt.id} className="p-3 rounded-2xl bg-card border border-border/50 flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="font-semibold text-sm truncate">{apt.student?.username}</p><p className="text-xs text-muted-foreground">{format(new Date(apt.slot_time), "MMM d, h:mm a")}</p></div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs shrink-0",
                    apt.status === "completed" ? "bg-eternia-success/10 text-eternia-success" : apt.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-eternia-warning/10 text-eternia-warning"
                  )}>{apt.status}</span>
                </div>
              ))}
          </div>
        )}

        {/* NOTES */}
        {activeTab === "notes" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search notes..." value={notesSearch} onChange={(e) => setNotesSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            {completed.filter((a: any) => a.session_notes_encrypted).filter((a: any) => !notesSearch || (a.student?.username || "").toLowerCase().includes(notesSearch.toLowerCase()) || a.session_notes_encrypted.toLowerCase().includes(notesSearch.toLowerCase())).length === 0
              ? <div className="text-center py-10 text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="text-sm">No notes</p></div>
              : completed.filter((a: any) => a.session_notes_encrypted).filter((a: any) => !notesSearch || (a.student?.username || "").toLowerCase().includes(notesSearch.toLowerCase()) || a.session_notes_encrypted.toLowerCase().includes(notesSearch.toLowerCase())).map((apt: any) => (
                <div key={apt.id} className="p-4 rounded-2xl bg-card border border-border/50">
                  <div className="flex items-center justify-between mb-2"><p className="font-semibold text-sm">{apt.student?.username}</p><p className="text-xs text-muted-foreground">{format(new Date(apt.slot_time), "MMM d")}</p></div>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl">{apt.session_notes_encrypted}</p>
                </div>
              ))}
          </div>
        )}

        {/* PROFILE */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-card border border-border/50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-eternia flex items-center justify-center shrink-0"><User className="w-7 h-7 text-background" /></div>
                <div><h2 className="text-lg font-bold">{profile?.username}</h2><p className="text-xs text-muted-foreground capitalize">{profile?.role}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div><p className="text-[10px] text-muted-foreground">Licence No.</p><p className="text-sm font-medium">—</p></div>
                <div><p className="text-[10px] text-muted-foreground">CRR Verification</p>
                  {profile?.is_verified ? <span className="text-sm font-medium text-eternia-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Verified</span>
                    : <span className="text-sm font-medium text-eternia-warning flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pending</span>}
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-between h-10 text-sm" onClick={() => setActiveTab("schedule")}>Edit Availability<ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" className="w-full justify-between h-10 text-sm" onClick={() => toast.info("Coming soon")}>Change Password<ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" className="w-full justify-between h-10 text-sm text-destructive" onClick={signOut}><span className="flex items-center gap-2"><LogOut className="w-4 h-4" />Logout</span><ChevronRight className="w-4 h-4" /></Button>
          </div>
        )}
      </div>

      {/* Add Slot Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Slot</DialogTitle><DialogDescription>Create availability</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start h-10 text-sm", !slotDate && "text-muted-foreground")}><Calendar className="w-4 h-4 mr-2" />{slotDate ? format(slotDate, "PPP") : "Pick date"}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><CalendarPicker mode="single" selected={slotDate} onSelect={setSlotDate} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className={cn("p-3 pointer-events-auto")} /></PopoverContent>
            </Popover>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Start</label><Input type="time" value={slotStartTime} onChange={(e) => setSlotStartTime(e.target.value)} className="h-10 text-sm" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">End</label><Input type="time" value={slotEndTime} onChange={(e) => setSlotEndTime(e.target.value)} className="h-10 text-sm" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Institution</label>
              <Select value={slotInstitution} onValueChange={setSlotInstitution}><SelectTrigger className="h-10 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>Cancel</Button>
            <Button disabled={!slotDate || createSlot.isPending} onClick={() => createSlot.mutate()}>{createSlot.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalation Dialog */}
      <Dialog open={escalationDialog.open} onOpenChange={(o) => { if (!o) { setEscalationDialog({ open: false }); setEscalationReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-eternia-warning" />Escalate to SPOC</DialogTitle><DialogDescription>Describe the concern to trigger SPOC review.</DialogDescription></DialogHeader>
          <Textarea placeholder="Reason for escalation..." value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} className="min-h-[80px] text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEscalationDialog({ open: false }); setEscalationReason(""); }}>Cancel</Button>
            <Button disabled={!escalationReason.trim() || submitEscalation.isPending} onClick={() => submitEscalation.mutate()} className="gap-1.5">
              {submitEscalation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialog.open} onOpenChange={(o) => { if (!o) { setRescheduleDialog({ open: false }); setRescheduleReason(""); setRescheduleSlotId(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" />Reschedule</DialogTitle><DialogDescription>Pick a new slot and provide a reason.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {rescheduleDialog.currentTime && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-sm">
                <p className="text-xs text-muted-foreground mb-0.5">Current</p>
                <p className="font-medium text-sm">{format(new Date(rescheduleDialog.currentTime), "EEE, MMM d · h:mm a")}</p>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">New Slot</label>
              <Select value={rescheduleSlotId} onValueChange={setRescheduleSlotId}>
                <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select slot" /></SelectTrigger>
                <SelectContent>
                  {futureSlots.filter(s => !s.is_booked).map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>{format(new Date(slot.start_time), "MMM d, h:mm a")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea placeholder="Reason..." value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} className="min-h-[70px] text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRescheduleDialog({ open: false }); setRescheduleReason(""); setRescheduleSlotId(""); }}>Cancel</Button>
            <Button disabled={!rescheduleSlotId || !rescheduleReason.trim()} onClick={async () => {
              if (!user || !rescheduleDialog.appointmentId) return;
              const selectedSlot = futureSlots.find(s => s.id === rescheduleSlotId);
              if (!selectedSlot) return;
              try {
                const { error } = await supabase.from("appointments").update({
                  slot_time: selectedSlot.start_time, slot_id: selectedSlot.id,
                  rescheduled_from: rescheduleDialog.currentTime, rescheduled_by: user.id, reschedule_reason: rescheduleReason,
                } as any).eq("id", rescheduleDialog.appointmentId);
                if (error) throw error;
                await supabase.from("expert_availability").update({ is_booked: true }).eq("id", selectedSlot.id);
                if (rescheduleDialog.studentId) {
                  await supabase.from("notifications").insert({
                    user_id: rescheduleDialog.studentId, type: "reschedule", title: "Appointment Rescheduled",
                    message: `Dr. ${profile?.username || "Expert"} rescheduled your appointment. Reason: ${rescheduleReason}`,
                    metadata: { appointment_id: rescheduleDialog.appointmentId, old_time: rescheduleDialog.currentTime, new_time: selectedSlot.start_time, expert_name: profile?.username, reason: rescheduleReason },
                  } as any);
                }
                queryClient.invalidateQueries({ queryKey: ["expert-appointments"] });
                queryClient.invalidateQueries({ queryKey: ["expert-slots"] });
                toast.success("Rescheduled & student notified");
                setRescheduleDialog({ open: false }); setRescheduleReason(""); setRescheduleSlotId("");
              } catch (err: any) { toast.error(err.message); }
            }} className="gap-1"><RefreshCw className="w-4 h-4" />Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VideoCallModal isOpen={callModal.open} onClose={() => setCallModal({ open: false, mode: "video" })} participantName={profile?.username || "Expert"} mode={callModal.mode} appointmentId={callModal.appointmentId} enableMonitoring={true} onCaptureSnippetReady={(fn) => { captureSnippetRef.current = fn; }} />
    </DashboardLayout>
  );
};

export default MobileExpertDashboard;
