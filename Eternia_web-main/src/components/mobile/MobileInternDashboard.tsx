import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home, MessageCircle, FileText, User, Clock, CheckCircle,
  AlertTriangle, Loader2, Search, LogOut, Lock,
  Play, Award, BookOpen, ChevronLeft, Shield, Gift, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabType = "training" | "sessions" | "notes" | "profile";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface TrainingModule {
  id: string;
  day_number: number;
  title: string;
  description: string;
  duration: string;
  objectives: string[];
  content: string;
  has_quiz: boolean;
  quiz_questions: QuizQuestion[];
  is_active: boolean;
}

const MobileInternDashboard = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("training");
  const [activeModule, setActiveModule] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const savedProgress: number[] = (profile as any)?.training_progress || [];
  const [completedModules, setCompletedModules] = useState<number[]>(savedProgress);

  const profileProgress = (profile as any)?.training_progress;
  const [lastSynced, setLastSynced] = useState<string>("");
  if (profileProgress && JSON.stringify(profileProgress) !== lastSynced && JSON.stringify(profileProgress) !== JSON.stringify(completedModules)) {
    setCompletedModules(profileProgress);
    setLastSynced(JSON.stringify(profileProgress));
  }

  const captureSnippetRef = useRef<(() => Promise<string>) | null>(null);
  const [escalationDialog, setEscalationDialog] = useState<{ open: boolean; sessionId?: string }>({ open: false });
  const [escalationReason, setEscalationReason] = useState("");
  const [notesSearch, setNotesSearch] = useState("");

  const { data: trainingModules = [] } = useQuery({
    queryKey: ["training-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .order("day_number", { ascending: true });
      if (error) throw error;
      return (data as any[]) as TrainingModule[];
    },
  });

  const trainingStatus = (profile as any)?.training_status || "not_started";
  const isTrainingComplete = trainingStatus === "active" || trainingStatus === "completed";
  const isInterviewPending = trainingStatus === "interview_pending";
  const progress = isTrainingComplete ? 100 : isInterviewPending ? 95 : trainingModules.length > 0 ? (completedModules.length / trainingModules.length) * 100 : 0;
  const lockedTabs: TabType[] = isTrainingComplete ? [] : ["sessions", "notes", "profile"];

  const { data: mySessions = [], isLoading } = useQuery({
    queryKey: ["intern-sessions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("peer_sessions").select("*, student:profiles!peer_sessions_student_id_fkey(username, institution_id)").eq("intern_id", user.id).order("created_at", { ascending: false });
      if (error) throw error; return data;
    }, enabled: !!user,
  });

  // Realtime subscription for new/updated peer sessions
  useEffect(() => {
    if (!user) return;
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`intern-peer-sessions-mobile-${user.id}-${suffix}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "peer_sessions",
        filter: `intern_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["intern-sessions", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);
  
  // Auto-activate verified intern in interview_pending state
  useEffect(() => {
    if (user && profile && (profile as any).is_verified && (profile as any).training_status === "interview_pending") {
      const activate = async () => {
        const currentProgress = (profile as any).training_progress || [];
        const newProgress = currentProgress.includes(7) ? currentProgress : [...currentProgress, 7];
        await supabase
          .from("profiles")
          .update({
            training_status: "active",
            training_progress: newProgress,
          })
          .eq("id", user.id);
        
        toast.success("Account activated! Your training is complete.");
        await refreshProfile();
        queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      };
      activate();
    }
  }, [user, profile, refreshProfile, queryClient]);

  const submitEscalation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      let snippet: string | null = null;
      if (captureSnippetRef.current) {
        toast.info("Capturing transcript (±10s)...");
        snippet = await captureSnippetRef.current();
      }
      const { data, error } = await supabase.functions.invoke("escalate-emergency", {
        body: {
          peer_session_id: escalationDialog.sessionId || null,
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

  const activeSessions = mySessions.filter((s) => s.status === "active");
  const completedSessions = mySessions.filter((s) => s.status === "completed");
  const currentModule = activeModule !== null ? trainingModules.find(m => m.day_number === activeModule) : null;

  const handleCompleteModule = async (mod: TrainingModule) => {
    if (mod.has_quiz && mod.quiz_questions.length > 0) {
      const allCorrect = mod.quiz_questions.every((q, i) => quizAnswers[i] === q.correctIndex);
      if (!allCorrect) { toast.error("Some answers are incorrect. Try again."); return; }
    }
    const newModules = [...completedModules, mod.day_number];
    setCompletedModules(newModules);
    if (user) {
      const newStatus = newModules.length >= trainingModules.length ? "interview_pending" : "in_progress";
      await supabase.from("profiles").update({ training_progress: newModules, training_status: newStatus }).eq("id", user.id);
    }
    setActiveModule(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    toast.success(`Day ${mod.day_number} completed!`);
  };

  const tabs: { key: TabType; icon: typeof Home; label: string }[] = [
    { key: "training", icon: BookOpen, label: "Training" },
    { key: "sessions", icon: MessageCircle, label: "Sessions" },
    { key: "notes", icon: FileText, label: "Notes" },
    { key: "profile", icon: User, label: "Profile" },
  ];

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-display">Intern Dashboard</h1>
            <p className="text-sm text-muted-foreground">Training & peer sessions</p>
          </div>
          {isTrainingComplete ? <Award className="w-5 h-5 text-eternia-success" /> : <Lock className="w-5 h-5 text-eternia-warning" />}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isLocked = lockedTabs.includes(tab.key);
            return (
              <button key={tab.key} onClick={() => {
                if (isLocked) { toast.info("Complete training to unlock"); return; }
                setActiveTab(tab.key);
                setActiveModule(null);
              }} className={cn("shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium",
                activeTab === tab.key ? "bg-primary text-primary-foreground"
                  : isLocked ? "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                  : "bg-muted/50 text-muted-foreground"
              )}>
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <tab.icon className="w-3.5 h-3.5" />}{tab.label}
              </button>
            );
          })}
        </div>

        {/* TRAINING — MODULE LIST */}
        {activeTab === "training" && !currentModule && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-eternia-warning/10 border border-eternia-warning/20">
              <div className="flex items-center gap-2 mb-2"><BookOpen className="w-4 h-4 text-eternia-warning" />
                <p className="font-medium text-sm">{isTrainingComplete ? "Training Complete! 🎉" : isInterviewPending ? "Interview Pending" : "Training Required"}</p>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{completedModules.length}/{trainingModules.length} done</p>
            </div>

            {/* Final Interview Card */}
            {isInterviewPending && (
              <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Award className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Final Interview</h3>
                    <p className="text-[10px] text-muted-foreground">Day 7 — Modules complete</p>
                  </div>
                </div>
                {(profile as any)?.is_verified ? (
                  <div className="p-2.5 rounded-lg bg-eternia-success/10 border border-eternia-success/20 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-eternia-success" />
                    <p className="text-xs font-medium text-eternia-success">Verified! Dashboard unlocking.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      An Eternia expert will share a meeting link. Once approved, an admin will verify your account and unlock Peer Connect.
                    </p>
                    <div className="p-2 rounded-lg bg-muted/30 border border-border/30 flex items-start gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-[10px] text-muted-foreground">Awaiting interview & verification</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Referral Code Skip */}
            {!isTrainingComplete && !isInterviewPending && (
              <MobileReferralCodeInput user={user} queryClient={queryClient} refreshProfile={refreshProfile} />
            )}

            <div className="space-y-2">
              {trainingModules.map((m) => {
                const done = completedModules.includes(m.day_number);
                const isNext = !done && completedModules.length + 1 === m.day_number;
                const locked = !done && !isNext;
                return (
                  <div key={m.day_number} className={cn("p-3 rounded-2xl border", done ? "bg-eternia-success/5 border-eternia-success/20" : isNext ? "bg-primary/5 border-primary/20" : "bg-card border-border/50 opacity-50")}>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                        done ? "bg-eternia-success/20 text-eternia-success" : isNext ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>{done ? <CheckCircle className="w-4 h-4" /> : locked ? <Lock className="w-3 h-3" /> : m.day_number}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">Day {m.day_number}: {m.title}</p>
                          {m.has_quiz && <span className="px-1 py-0.5 rounded text-[8px] bg-eternia-warning/10 text-eternia-warning">Quiz</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{m.duration}</p>
                      </div>
                      {done && <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setActiveModule(m.day_number); setQuizAnswers({}); setQuizSubmitted(false); }}>Review</Button>}
                      {isNext && m.day_number !== 7 && <Button size="sm" className="h-6 text-[10px] px-2 gap-0.5" onClick={() => { setActiveModule(m.day_number); setQuizAnswers({}); setQuizSubmitted(false); }}><Play className="w-2.5 h-2.5" />Start</Button>}
                      {isNext && m.day_number === 7 && <span className="text-[10px] text-eternia-warning font-medium">Interview</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Active", value: activeSessions.length, icon: MessageCircle, color: "text-primary" },
                { label: "Done", value: completedSessions.length, icon: CheckCircle, color: "text-eternia-success" },
                { label: "Training", value: `${completedModules.length}/7`, icon: BookOpen, color: "text-eternia-warning" },
                { label: "Flagged", value: mySessions.filter((s) => s.is_flagged).length, icon: AlertTriangle, color: "text-destructive" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-2xl bg-card border border-border/50 text-center">
                  <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
                  <p className="text-base font-bold leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRAINING — MODULE DETAIL */}
        {activeTab === "training" && currentModule && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="gap-1 text-xs -ml-1" onClick={() => { setActiveModule(null); setQuizAnswers({}); setQuizSubmitted(false); }}>
              <ChevronLeft className="w-4 h-4" />Back
            </Button>

            <div className="p-4 rounded-2xl bg-card border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">{currentModule.day_number}</div>
                <div>
                  <h2 className="text-base font-bold font-display">Day {currentModule.day_number}: {currentModule.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3" />{currentModule.duration}
                    {currentModule.has_quiz && <span className="px-1 py-0.5 rounded bg-eternia-warning/10 text-eternia-warning text-[10px]">Quiz</span>}
                  </div>
                </div>
              </div>

              {/* Objectives */}
              <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-xs font-semibold mb-1.5 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-primary" />Objectives</h3>
                <ul className="space-y-1">
                  {currentModule.objectives.map((obj, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-primary mt-0.5 shrink-0" />{obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Content */}
              <div className="mb-4">
                {currentModule.content.split("\\n\\n").map((p, i) => (
                  <div key={i} className="mb-3">
                    {p.split("\\n").map((line, j) => {
                      if (line.startsWith("**") && line.endsWith("**")) return <h3 key={j} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.replace(/\*\*/g, "")}</h3>;
                      if (line.startsWith("• ")) return <p key={j} className="text-xs text-muted-foreground ml-3 mb-0.5">• {line.slice(2)}</p>;
                      if (line.startsWith("✅ ") || line.startsWith("❌ ")) return <p key={j} className="text-xs text-muted-foreground ml-3 mb-0.5">{line}</p>;
                      return line.trim() ? <p key={j} className="text-xs text-muted-foreground leading-relaxed">{line}</p> : null;
                    })}
                  </div>
                ))}
              </div>

              {/* Quiz */}
              {currentModule.has_quiz && currentModule.quiz_questions.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Award className="w-4 h-4 text-eternia-warning" />Quiz</h3>
                  <div className="space-y-4">
                    {currentModule.quiz_questions.map((q, qi) => (
                      <div key={qi} className="p-3 rounded-lg bg-muted/20 border border-border/30">
                        <p className="text-xs font-medium mb-2">{qi + 1}. {q.question}</p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oi) => {
                            const selected = quizAnswers[qi] === oi;
                            const isCorrect = oi === q.correctIndex;
                            const show = quizSubmitted;
                            return (
                              <button key={oi}
                                onClick={() => { if (!quizSubmitted) setQuizAnswers(prev => ({ ...prev, [qi]: oi })); }}
                                disabled={quizSubmitted}
                                className={cn("w-full text-left p-2.5 rounded-lg text-xs border transition-all",
                                  show && selected && isCorrect ? "bg-eternia-success/10 border-eternia-success/30 text-eternia-success"
                                  : show && selected && !isCorrect ? "bg-destructive/10 border-destructive/30 text-destructive"
                                  : show && isCorrect ? "bg-eternia-success/5 border-eternia-success/20"
                                  : selected ? "bg-primary/10 border-primary/30"
                                  : "bg-card border-border/50 text-muted-foreground"
                                )}>
                                <span className="font-medium mr-1.5">{String.fromCharCode(65 + oi)}.</span>{opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
                {completedModules.includes(currentModule.day_number) ? (
                  <span className="text-xs text-eternia-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Completed</span>
                ) : currentModule.day_number === 7 ? (
                  <span className="text-xs text-muted-foreground italic">Requires live interview</span>
                ) : currentModule.has_quiz && !quizSubmitted ? (
                  <Button size="sm" onClick={() => setQuizSubmitted(true)} disabled={Object.keys(quizAnswers).length < currentModule.quiz_questions.length} className="text-xs h-8">Submit Quiz</Button>
                ) : currentModule.has_quiz && quizSubmitted ? (
                  currentModule.quiz_questions.every((q, i) => quizAnswers[i] === q.correctIndex) ? (
                    <Button size="sm" onClick={() => handleCompleteModule(currentModule)} className="text-xs h-8 gap-1"><CheckCircle className="w-3 h-3" />Complete</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }} className="text-xs h-8">Retry</Button>
                  )
                ) : (
                  <Button size="sm" onClick={() => handleCompleteModule(currentModule)} className="text-xs h-8 gap-1"><CheckCircle className="w-3 h-3" />Complete</Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SESSIONS */}
        {activeTab === "sessions" && (
          <div className="space-y-2">
            {mySessions.length === 0 ? <div className="text-center py-10 text-muted-foreground"><MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="text-sm">No sessions</p></div>
              : mySessions.map((s: any) => (
                <div key={s.id} className={cn("p-3 rounded-2xl border", s.is_flagged ? "bg-destructive/5 border-destructive/20" : "bg-card border-border/50")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0"><p className="font-medium text-sm truncate">{s.student?.username || "Student"}</p><p className="text-xs text-muted-foreground">{format(new Date(s.created_at), "MMM d, h:mm a")}</p></div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px]",
                        s.is_flagged ? "bg-destructive/10 text-destructive" : s.status === "active" ? "bg-eternia-success/10 text-eternia-success" : "bg-primary/10 text-primary"
                      )}>{s.is_flagged ? "⚠" : s.status}</span>
                      {s.status === "active" && !s.is_flagged && (
                        <>
                          <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => navigate(`/dashboard/peer-connect?sessionId=${s.id}`)}>Join</Button>
                          <Button size="sm" variant="ghost" className="text-destructive h-7 px-1.5" onClick={() => setEscalationDialog({ open: true, sessionId: s.id })}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* NOTES */}
        {activeTab === "notes" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." value={notesSearch} onChange={(e) => setNotesSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            {completedSessions.length === 0 ? <div className="text-center py-10 text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="text-sm">No history</p></div>
              : completedSessions.filter((s: any) => !notesSearch || (s.student?.username || "").toLowerCase().includes(notesSearch.toLowerCase())).map((s: any) => (
                <div key={s.id} className="p-3 rounded-2xl bg-card border border-border/50">
                  <div className="flex items-center justify-between mb-1"><p className="font-medium text-sm">{s.student?.username || "Student"}</p><p className="text-xs text-muted-foreground">{format(new Date(s.created_at), "MMM d")}</p></div>
                  {s.escalation_note_encrypted && <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">{s.escalation_note_encrypted}</p>}
                  <div className="flex gap-2 mt-1.5">
                    {s.is_flagged && <span className="px-2 py-0.5 rounded-full text-[10px] bg-destructive/10 text-destructive">Flagged</span>}
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-eternia-success/10 text-eternia-success">Done</span>
                  </div>
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
                <div><p className="text-[10px] text-muted-foreground">CRR Verification</p>
                  {profile?.is_verified ? <span className="text-sm font-medium text-eternia-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Verified</span>
                    : <span className="text-sm font-medium text-eternia-warning flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pending</span>}
                </div>
                <div><p className="text-[10px] text-muted-foreground">Training</p><p className={cn("text-sm font-medium", isTrainingComplete ? "text-eternia-success" : "text-eternia-warning")}>{isTrainingComplete ? "Complete" : isInterviewPending ? "Interview" : `${completedModules.length}/7`}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Sessions</p><p className="text-sm font-medium">{completedSessions.length}</p></div>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm text-destructive" onClick={signOut}><LogOut className="w-4 h-4" />Logout</Button>
          </div>
        )}
      </div>

      {/* Escalation Dialog */}
      <Dialog open={escalationDialog.open} onOpenChange={(o) => setEscalationDialog({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Submit Escalation</DialogTitle>
            <DialogDescription>Describe the reason</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason..." value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} className="min-h-[80px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalationDialog({ open: false })}>Cancel</Button>
            <Button variant="destructive" disabled={!escalationReason.trim() || submitEscalation.isPending} onClick={() => submitEscalation.mutate()}>
              {submitEscalation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MobileInternDashboard;

function MobileReferralCodeInput({ user, queryClient, refreshProfile }: { user: any; queryClient: any; refreshProfile: () => Promise<void> }) {
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);
    try {
      const { data: codeRow, error } = await supabase
        .from("intern_referral_codes")
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .single();
      if (error || !codeRow) { toast.error("Invalid referral code"); return; }
      if (codeRow.is_used) { toast.error("This code has already been used"); return; }
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) { toast.error("This code has expired"); return; }

      // Update profile FIRST — if this fails, the code stays unused
      const { error: profileError } = await supabase.from("profiles").update({
        training_status: "active",
        is_verified: true,
        training_progress: [1, 2, 3, 4, 5, 6, 7],
      }).eq("id", user.id);

      if (profileError) throw profileError;

      // Only mark code as used after profile update succeeds
      await supabase.from("intern_referral_codes").update({
        is_used: true,
        assigned_to: user.id,
        used_at: new Date().toISOString(),
      }).eq("id", codeRow.id);

      toast.success("Referral code applied! Dashboard unlocked.");
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to redeem code");
    } finally {
      setLoading(false);
    }
  };

  if (!showInput) {
    return (
      <div className="p-4 rounded-2xl bg-primary/5 border border-dashed border-primary/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Have a referral code?</p>
            <p className="text-xs text-muted-foreground">Skip training with a code from your admin</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowInput(true)} className="shrink-0">
          Enter Code
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
      <p className="text-xs font-medium flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 text-primary" />Enter Referral Code</p>
      <div className="flex gap-2">
        <Input placeholder="REF-ABC12345" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="h-8 text-xs font-mono flex-1" />
        <Button size="sm" className="h-8 text-xs" onClick={handleRedeem} disabled={!code.trim() || loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowInput(false); setCode(""); }}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
