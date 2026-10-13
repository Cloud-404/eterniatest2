import { useIsMobile } from "@/hooks/use-mobile";
import MobileAppointments from "@/components/mobile/MobileAppointments";
import ExpertDashboard from "@/pages/dashboard/ExpertDashboard";

import { useState } from "react";
import {
  Calendar, Clock, User, Video, Phone, CheckCircle, Search, Coins, X, Loader2, RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
import VideoCallModal from "@/components/videosdk/VideoCallModal";
import { useAuth } from "@/contexts/AuthContext";
import { useAppointments } from "@/hooks/useAppointments";
import { useCredits } from "@/hooks/useCredits";
import { format } from "date-fns";

const Appointments = () => {
  const isMobile = useIsMobile();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [callModal, setCallModal] = useState<{ open: boolean; mode: "video" | "audio"; appointmentId?: string }>({ open: false, mode: "video" });
  const [bookingDialog, setBookingDialog] = useState<{ open: boolean; expert?: any; slot?: any }>({ open: false });
  const [sessionType, setSessionType] = useState<"video" | "audio">("video");

  const { balance } = useCredits();
  const { experts, slots, upcomingAppointments, pastAppointments, isLoading, bookAppointment, cancelAppointment, isBooking } = useAppointments();

  // If user is an expert, show Expert Dashboard instead
  if (profile?.role === "expert") return <ExpertDashboard />;

  const handleJoinCall = (type: string, aptId: string) => setCallModal({ open: true, mode: type === "video" ? "video" : "audio", appointmentId: aptId });
  const handleBookSlot = (expert: any, slot: any) => setBookingDialog({ open: true, expert, slot });
  const confirmBooking = () => {
    if (!bookingDialog.expert || !bookingDialog.slot) return;
    bookAppointment({ expertId: bookingDialog.expert.id, slotId: bookingDialog.slot.id, slotTime: bookingDialog.slot.start_time, sessionType, creditCost: 50 });
    setBookingDialog({ open: false });
  };
  const getExpertSlots = (expertId: string) => slots.filter((s) => s.expert_id === expertId);

  if (isMobile) return <MobileAppointments />;

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-display mb-1">Expert Connect</h1>
            <p className="text-sm text-muted-foreground">Book sessions with verified professionals</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
              <Coins className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">{balance} ECC</span>
            </div>
            
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-semibold font-display mb-4">My Appointments</h2>
          <div className="flex gap-2 mb-6">
            <Button variant={activeTab === "upcoming" ? "default" : "ghost"} onClick={() => setActiveTab("upcoming")} size="sm">Upcoming ({upcomingAppointments.length})</Button>
            <Button variant={activeTab === "past" ? "default" : "ghost"} onClick={() => setActiveTab("past")} size="sm">Past</Button>
          </div>
          <div className="space-y-3">
            {(activeTab === "upcoming" ? upcomingAppointments : pastAppointments).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No {activeTab} appointments</div>
            ) : (activeTab === "upcoming" ? upcomingAppointments : pastAppointments).map((apt) => (
              <div key={apt.id} className="p-4 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-white" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{apt.expert?.username || "Expert"}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 ${apt.status === "confirmed" ? "bg-eternia-success/10 text-eternia-success" : apt.status === "pending" ? "bg-eternia-warning/10 text-eternia-warning" : apt.status === "completed" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{apt.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(apt.slot_time), "MMM d")}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(apt.slot_time), "h:mm a")}</span>
                      <span className="flex items-center gap-1">{apt.session_type === "video" ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}{apt.session_type}</span>
                    </div>
                    {apt.reschedule_reason && (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                          <RotateCcw className="w-3 h-3" />Rescheduled by Dr. {apt.expert?.username || "Expert"}
                        </div>
                        {apt.rescheduled_from && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span>{format(new Date(apt.rescheduled_from), "MMM d, h:mm a")}</span>
                            <span>→</span>
                            <span className="text-foreground font-medium">{format(new Date(apt.slot_time), "MMM d, h:mm a")}</span>
                          </div>
                        )}
                        <p className="text-muted-foreground">{apt.reschedule_reason}</p>
                      </div>
                    )}
                    {activeTab === "upcoming" && (apt.status === "confirmed" || apt.status === "pending") && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={() => handleJoinCall(apt.session_type, apt.id)} className="gap-1 h-7 text-xs">{apt.session_type === "video" ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}Join</Button>
                        <Button variant="ghost" size="sm" onClick={() => cancelAppointment(apt.id)} className="text-destructive h-7 text-xs"><X className="w-3 h-3 mr-1" />Cancel</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-base font-semibold font-display">Available Experts</h2>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search experts..." className="pl-9 w-48 bg-card h-9 text-sm" /></div>
          </div>
          {experts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-border"><User className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="text-sm">No experts available</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {experts.map((expert) => {
                const expertSlots = getExpertSlots(expert.id);
                return (
                  <div key={expert.id} className="p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center"><User className="w-7 h-7 text-white" /></div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${expertSlots.length > 0 ? "bg-eternia-success/10 text-eternia-success" : "bg-muted text-muted-foreground"}`}>{expertSlots.length > 0 ? "Available" : "No slots"}</span>
                    </div>
                    <h3 className="font-semibold text-base mb-0.5">{expert.username}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{expert.specialty || "Mental Health Professional"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3"><span>⭐ 4.9</span><span>{expert.total_sessions} sessions</span></div>
                    {expertSlots.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        <p className="text-[11px] text-muted-foreground">Available slots:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {expertSlots.slice(0, 3).map((slot) => (<Button key={slot.id} variant="outline" size="sm" onClick={() => handleBookSlot(expert, slot)} className="text-[11px] h-7 px-2">{format(new Date(slot.start_time), "MMM d, h:mm a")}</Button>))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div><p className="text-[10px] text-muted-foreground">Cost</p><p className="font-semibold text-sm flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-primary" />50 ECC</p></div>
                      {expertSlots.length > 0 && <Button size="sm" className="h-8 text-xs" onClick={() => handleBookSlot(expert, expertSlots[0])}>Book Now</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={bookingDialog.open} onOpenChange={(open) => setBookingDialog({ open })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Book Appointment</DialogTitle><DialogDescription>Confirm your appointment with {bookingDialog.expert?.username}</DialogDescription></DialogHeader>
          {bookingDialog.slot && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="flex items-center gap-3"><Calendar className="w-4 h-4 text-primary" /><span className="text-sm font-medium">{format(new Date(bookingDialog.slot.start_time), "EEEE, MMMM d, yyyy")}</span></div>
                <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-primary" /><span className="text-sm">{format(new Date(bookingDialog.slot.start_time), "h:mm a")} - {format(new Date(bookingDialog.slot.end_time), "h:mm a")}</span></div>
              </div>
              <div><p className="text-xs text-muted-foreground mb-2">Session Type</p>
                <div className="flex gap-2">
                  <Button variant={sessionType === "video" ? "default" : "outline"} onClick={() => setSessionType("video")} className="flex-1 gap-1.5 h-9 text-sm"><Video className="w-4 h-4" />Video</Button>
                  <Button variant={sessionType === "audio" ? "default" : "outline"} onClick={() => setSessionType("audio")} className="flex-1 gap-1.5 h-9 text-sm"><Phone className="w-4 h-4" />Audio</Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20"><span className="text-sm">Cost</span><span className="font-semibold text-sm flex items-center gap-1.5"><Coins className="w-4 h-4 text-primary" />50 ECC</span></div>
              {balance < 50 && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">Insufficient credits.</div>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBookingDialog({ open: false })} size="sm">Cancel</Button>
            <Button onClick={confirmBooking} disabled={isBooking || balance < 50} size="sm" className="gap-1.5">{isBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VideoCallModal isOpen={callModal.open} onClose={() => setCallModal({ open: false, mode: "video" })} participantName={profile?.username || "Student"} participantId={profile?.id || user?.id} mode={callModal.mode} appointmentId={callModal.appointmentId} />
    </DashboardLayout>
  );
};

export default Appointments;
