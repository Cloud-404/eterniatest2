import { useState } from "react";
import { Calendar, Clock, User, Video, Phone, CheckCircle, Coins, X, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
import VideoCallModal from "@/components/videosdk/VideoCallModal";
import MobileExpertDashboard from "@/components/mobile/MobileExpertDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useAppointments } from "@/hooks/useAppointments";
import { useCredits } from "@/hooks/useCredits";
import { format } from "date-fns";

const MobileAppointments = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [callModal, setCallModal] = useState<{ open: boolean; mode: "video" | "audio"; appointmentId?: string }>({ open: false, mode: "video" });
  const [bookingDialog, setBookingDialog] = useState<{ open: boolean; expert?: any; slot?: any }>({ open: false });
  const [sessionType, setSessionType] = useState<"video" | "audio">("video");

  const { balance } = useCredits();
  const { experts, slots, upcomingAppointments, pastAppointments, isLoading, bookAppointment, cancelAppointment, isBooking } = useAppointments();

  // If user is an expert, show expert dashboard
  if (profile?.role === "expert") return <MobileExpertDashboard />;

  const handleBookSlot = (expert: any, slot: any) => setBookingDialog({ open: true, expert, slot });
  const confirmBooking = () => {
    if (!bookingDialog.expert || !bookingDialog.slot) return;
    bookAppointment({ expertId: bookingDialog.expert.id, slotId: bookingDialog.slot.id, slotTime: bookingDialog.slot.start_time, sessionType, creditCost: 50 });
    setBookingDialog({ open: false });
  };
  const getExpertSlots = (expertId: string) => slots.filter((s) => s.expert_id === expertId);

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-display">Appointments</h1>
            <p className="text-sm text-muted-foreground">Book sessions with professionals</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border">
              <Coins className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">{balance} ECC</span>
            </div>
            
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border/50 p-4">
          <h2 className="text-sm font-semibold font-display mb-3">My Appointments</h2>
          <div className="flex gap-2 mb-4">
            <Button variant={activeTab === "upcoming" ? "default" : "ghost"} onClick={() => setActiveTab("upcoming")} size="sm" className="h-9 text-xs px-3">
              Upcoming ({upcomingAppointments.length})
            </Button>
            <Button variant={activeTab === "past" ? "default" : "ghost"} onClick={() => setActiveTab("past")} size="sm" className="h-9 text-xs px-3">Past</Button>
          </div>
          <div className="space-y-3">
            {(activeTab === "upcoming" ? upcomingAppointments : pastAppointments).length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No {activeTab} appointments</p>
            ) : (activeTab === "upcoming" ? upcomingAppointments : pastAppointments).map((apt) => (
              <div key={apt.id} className="p-4 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl surface-mint flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{apt.expert?.username || "Expert"}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${
                        apt.status === "confirmed" ? "bg-eternia-success/10 text-eternia-success" :
                        apt.status === "pending" ? "bg-eternia-warning/10 text-eternia-warning" :
                        apt.status === "completed" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                      }`}>{apt.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(apt.slot_time), "MMM d")}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{format(new Date(apt.slot_time), "h:mm a")}</span>
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
                        <Button variant="outline" size="sm" onClick={() => setCallModal({ open: true, mode: apt.session_type === "video" ? "video" : "audio", appointmentId: apt.id })} className="gap-1.5 h-9 text-xs px-3">
                          {apt.session_type === "video" ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}Join
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => cancelAppointment(apt.id)} className="text-destructive h-9 text-xs px-3">
                          <X className="w-3.5 h-3.5 mr-1" />Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold font-display mb-3">Available Experts</h2>
          {experts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-border"><User className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">No experts available</p></div>
          ) : (
            <div className="space-y-3">
              {experts.map((expert) => {
                const expertSlots = getExpertSlots(expert.id);
                return (
                  <div key={expert.id} className="p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl surface-mint flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-foreground/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{expert.username}</h3>
                        <p className="text-xs text-muted-foreground">{expert.specialty || "Mental Health Professional"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>⭐ 4.9</span><span>{expert.total_sessions} sessions</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${expertSlots.length > 0 ? "bg-eternia-success/10 text-eternia-success" : "bg-muted text-muted-foreground"}`}>
                        {expertSlots.length > 0 ? "Available" : "No slots"}
                      </span>
                    </div>
                    {expertSlots.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {expertSlots.slice(0, 3).map((slot) => (
                          <Button key={slot.id} variant="outline" size="sm" onClick={() => handleBookSlot(expert, slot)} className="text-xs h-9 px-3">
                            {format(new Date(slot.start_time), "MMM d, h:mm a")}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                       <p className="font-semibold text-sm flex items-center gap-1.5"><Coins className="w-4 h-4 text-primary" />50 ECC</p>
                      {expertSlots.length > 0 && (
                        <Button size="sm" className="h-10 text-sm px-4" onClick={() => handleBookSlot(expert, expertSlots[0])}>Book Now</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={bookingDialog.open} onOpenChange={(open) => setBookingDialog({ open })}>
        <DialogContent className="max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-base">Book Appointment</DialogTitle>
            <DialogDescription className="text-sm">With {bookingDialog.expert?.username}</DialogDescription>
          </DialogHeader>
          {bookingDialog.slot && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <p className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />{format(new Date(bookingDialog.slot.start_time), "EEE, MMM d")}</p>
                <p className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />{format(new Date(bookingDialog.slot.start_time), "h:mm a")}</p>
              </div>
              <div className="flex gap-2">
                <Button variant={sessionType === "video" ? "default" : "outline"} onClick={() => setSessionType("video")} className="flex-1 gap-1.5 h-10 text-sm"><Video className="w-4 h-4" />Video</Button>
                <Button variant={sessionType === "audio" ? "default" : "outline"} onClick={() => setSessionType("audio")} className="flex-1 gap-1.5 h-10 text-sm"><Phone className="w-4 h-4" />Audio</Button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                <span className="text-sm">Cost</span>
                <span className="font-semibold text-sm flex items-center gap-1.5"><Coins className="w-4 h-4 text-primary" />50 ECC</span>
              </div>
              {balance < 50 && <p className="text-xs text-destructive">Insufficient credits.</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBookingDialog({ open: false })} className="h-10 text-sm">Cancel</Button>
            <Button onClick={confirmBooking} disabled={isBooking || balance < 50} className="h-10 text-sm gap-1.5">
              {isBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VideoCallModal isOpen={callModal.open} onClose={() => setCallModal({ open: false, mode: "video" })} participantName={profile?.username || "Student"} mode={callModal.mode} appointmentId={callModal.appointmentId} />
    </DashboardLayout>
  );
};

export default MobileAppointments;
