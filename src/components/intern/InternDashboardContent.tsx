import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home, MessageCircle, FileText, User, Clock, CheckCircle,
  AlertTriangle, Loader2, Search, Shield, LogOut, Lock,
  Play, Award, BookOpen, ChevronRight, ChevronLeft, X, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabType = "training" | "sessions" | "notes" | "profile";

const TABS: { key: TabType; label: string; icon: typeof Home }[] = [
  { key: "training", label: "Training", icon: BookOpen },
  { key: "sessions", label: "Peer Sessions", icon: MessageCircle },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "profile", label: "Profile", icon: User },
];

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

const InternDashboardContent = () => {
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
  const [notesFilterInstitution, setNotesFilterInstitution] = useState<string>("all");

  const { data: trainingModules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["training-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("id, day_number, title, description, duration, objectives, content, has_quiz, quiz_questions, is_active")
        .order("day_number", { ascending: true });
      if (error) throw error;
      return (data as any[]) as TrainingModule[];
    },
  });

  const trainingStatus = (profile as any)?.training_status || "not_started";
  const isTrainingComplete = trainingStatus === "active" || trainingStatus === "completed";
  const isInterviewPending = trainingStatus === "interview_pending";
  const trainingProgress = isTrainingComplete ? 100 : isInterviewPending ? 95 : trainingModules.length > 0 ? (completedModules.length / trainingModules.length) * 100 : 0;
  const lockedTabs: TabType[] = isTrainingComplete ? [] : ["sessions", "notes", "profile"];

  const { data: mySessions = [], isLoading } = useQuery({
    queryKey: ["intern-sessions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("peer_sessions")
        .select("*, student:profiles!peer_sessions_student_id_fkey(username, institution_id)")
        .eq("intern_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime subscription for new/updated peer sessions
  useEffect(() => {
    if (!user) return;
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`intern-peer-sessions-${user.id}-${suffix}`)
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

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const submitEscalation = useMutation({
    mutationFn: async () => {
      if (!user || !escalationDialog.sessionId) throw new Error("Missing data");
      let snippet: string | null = null;
      if (captureSnippetRef.current) {
        toast.info("Capturing transcript (±10s)...");
        snippet = await captureSnippetRef.current();
      }
      // Fallback: for chat-based peer sessions, pull recent messages as transcript
      if (!snippet) {
        const { data: messages } = await supabase
          .from("peer_messages")
          .select("content_encrypted, sender_id, created_at")
          .eq("session_id", escalationDialog.sessionId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (messages && messages.length > 0) {
          snippet = messages
            .reverse()
            .map((m: any) => `[${format(new Date(m.created_at), "HH:mm:ss")}] ${m.sender_id === user.id ? "Intern" : "Student"}: ${m.content_encrypted}`)
            .join("\n");
        }
      }
      const { data, error } = await supabase.functions.invoke("escalate-emergency", {
        body: {
          peer_session_id: escalationDialog.sessionId,
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
      if (!allCorrect) {
        if (mod.day_number === 3 || mod.day_number === 6) {
          if (user) {
            await supabase.from("profiles").update({ training_status: "failed" }).eq("id", user.id);
          }
          toast.error("Assessment failed. Review the material and try again.");
        } else {
          toast.error("Some answers are incorrect. Please review and try again.");
        }
        return;
      }
    }
    const newModules = [...completedModules, mod.day_number];
    setCompletedModules(newModules);
    if (user) {
      let newStatus = "in_progress";
      if (mod.day_number === 3) newStatus = "assessment_pending";
      else if (newModules.length >= trainingModules.length) newStatus = "interview_pending";
      else if (mod.day_number === 6) newStatus = "interview_pending";
      await supabase.from("profiles").update({ training_progress: newModules, training_status: newStatus }).eq("id", user.id);
    }
    setActiveModule(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    toast.success(`Day ${mod.day_number} completed!`);
  };

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Intern Dashboard</h1>
            <p className="text-sm text-muted-foreground">Training & peer sessions</p>
          </div>
          {isTrainingComplete ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-eternia-success/10 border border-eternia-success/20">
              <Award className="w-4 h-4 text-eternia-success" />
              <span className="text-xs font-medium text-eternia-success">Certified</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-eternia-warning/10 border border-eternia-warning/20">
              <Lock className="w-4 h-4 text-eternia-warning" />
              <span className="text-xs font-medium text-eternia-warning">{completedModules.length}/7 Training</span>
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl">
          {TABS.map((tab) => {
            const isLocked = lockedTabs.includes(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (isLocked) { toast.info("Complete training to unlock this tab"); return; }
                  setActiveTab(tab.key);
                  setActiveModule(null);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center",
                  activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm"
                    : isLocked ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <tab.icon className="w-4 h-4" />}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* =================== TRAINING TAB =================== */}
        {activeTab === "training" && !currentModule && (
          <div className="space-y-4">
             <div className="p-4 rounded-xl bg-eternia-warning/10 border border-eternia-warning/20">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-5 h-5 text-eternia-warning" />
                <p className="font-medium text-sm">
                  {isTrainingComplete ? "Training Complete! 🎉" : isInterviewPending ? "Interview Pending — Awaiting expert evaluation" : "Training Required — Complete all 7 modules"}
                </p>
              </div>
              <Progress value={trainingProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{completedModules.length}/{trainingModules.length} completed</p>
            </div>

            {/* Referral Code Skip */}
            {!isTrainingComplete && !isInterviewPending && (
              <ReferralCodeInput user={user} queryClient={queryClient} refreshProfile={refreshProfile} />
            )}

            {/* Final Interview Card */}
            {isInterviewPending && (
              <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Final Interview — Day 7</h3>
                    <p className="text-xs text-muted-foreground">Your training modules are complete</p>
                  </div>
                </div>
                {(profile as any)?.is_verified ? (
                  <div className="p-3 rounded-lg bg-eternia-success/10 border border-eternia-success/20 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-eternia-success" />
                    <p className="text-sm font-medium text-eternia-success">Verified! Your dashboard is being unlocked.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      An Eternia expert will schedule a brief interview with you. They will share a meeting link externally (email/chat). Once the interview is complete and approved, an admin will verify your account and unlock Peer Connect.
                    </p>
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30 flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-[11px] text-muted-foreground">Awaiting expert interview & admin verification</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {trainingModules.map((mod) => {
                const done = completedModules.includes(mod.day_number);
                const isNext = !done && completedModules.length + 1 === mod.day_number;
                const locked = !done && !isNext;
                const isDay7 = mod.day_number === 7;
                return (
                  <div key={mod.day_number} className={cn(
                    "p-4 rounded-xl border transition-all",
                    done ? "bg-eternia-success/5 border-eternia-success/20"
                      : isNext ? "bg-primary/5 border-primary/20"
                      : "bg-card border-border/50 opacity-50"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold",
                        done ? "bg-eternia-success/20 text-eternia-success" : isNext ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {done ? <CheckCircle className="w-5 h-5" /> : locked ? <Lock className="w-4 h-4" /> : mod.day_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold">Day {mod.day_number}: {mod.title}</p>
                          {mod.has_quiz && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-eternia-warning/10 text-eternia-warning">Quiz</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{mod.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{mod.duration}</span>
                          <span>{mod.objectives.length} objectives</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {done ? (
                          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setActiveModule(mod.day_number); setQuizAnswers({}); setQuizSubmitted(false); }}>
                            Review <ChevronRight className="w-3 h-3" />
                          </Button>
                        ) : isNext && !isDay7 ? (
                          <Button size="sm" className="gap-1 text-xs" onClick={() => { setActiveModule(mod.day_number); setQuizAnswers({}); setQuizSubmitted(false); }}>
                            <Play className="w-3 h-3" />Start
                          </Button>
                        ) : isNext && isDay7 ? (
                          <span className="text-xs text-eternia-warning font-medium">Interview</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Active", value: activeSessions.length, icon: MessageCircle, color: "text-primary" },
                { label: "Completed", value: completedSessions.length, icon: CheckCircle, color: "text-eternia-success" },
                { label: "Training", value: `${completedModules.length}/7`, icon: BookOpen, color: "text-eternia-warning" },
                { label: "Flagged", value: mySessions.filter((s) => s.is_flagged).length, icon: AlertTriangle, color: "text-destructive" },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl bg-card border border-border/50 text-center">
                  <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-1`} />
                  <p className="text-xl font-bold leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================== MODULE DETAIL VIEW =================== */}
        {activeTab === "training" && currentModule && (
          <div className="space-y-6">
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setActiveModule(null); setQuizAnswers({}); setQuizSubmitted(false); }}>
              <ChevronLeft className="w-4 h-4" />Back to modules
            </Button>

            <div className="p-6 rounded-xl bg-card border border-border/50">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {currentModule.day_number}
                </div>
                <div>
                  <h2 className="text-xl font-bold font-display mb-1">Day {currentModule.day_number}: {currentModule.title}</h2>
                  <p className="text-sm text-muted-foreground">{currentModule.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{currentModule.duration}</span>
                    {currentModule.has_quiz && <span className="px-1.5 py-0.5 rounded bg-eternia-warning/10 text-eternia-warning font-medium">Includes Quiz</span>}
                  </div>
                </div>
              </div>

              {/* Objectives */}
              <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Learning Objectives</h3>
                <ul className="space-y-1.5">
                  {currentModule.objectives.map((obj, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Content */}
              <div className="prose prose-sm prose-invert max-w-none mb-6">
                {currentModule.content.split("\n\n").map((paragraph, i) => (
                  <div key={i} className="mb-4">
                    {paragraph.split("\n").map((line, j) => {
                      if (line.startsWith("**") && line.endsWith("**")) {
                        return <h3 key={j} className="text-base font-semibold text-foreground mt-4 mb-2">{line.replace(/\*\*/g, "")}</h3>;
                      }
                      if (line.startsWith("• ")) {
                        return <p key={j} className="text-sm text-muted-foreground ml-4 mb-1">• {line.slice(2)}</p>;
                      }
                      if (line.startsWith("✅ ") || line.startsWith("❌ ")) {
                        return <p key={j} className="text-sm text-muted-foreground ml-4 mb-1">{line}</p>;
                      }
                      if (line.match(/^\d+\. \*\*/)) {
                        const parts = line.match(/^(\d+\. \*\*)(.+?)(\*\*)(.*)/);
                        if (parts) return <p key={j} className="text-sm text-foreground mb-1"><span className="font-semibold">{parts[1].replace("**","")}{parts[2]}</span>{parts[4]}</p>;
                      }
                      return line.trim() ? <p key={j} className="text-sm text-muted-foreground leading-relaxed">{line}</p> : null;
                    })}
                  </div>
                ))}
              </div>

              {/* Quiz Section */}
              {currentModule.has_quiz && currentModule.quiz_questions.length > 0 && (
                <div className="border-t border-border pt-6">
                  <h3 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-eternia-warning" />Assessment Quiz
                  </h3>
                  <div className="space-y-6">
                    {currentModule.quiz_questions.map((q, qi) => (
                      <div key={qi} className="p-4 rounded-lg bg-muted/20 border border-border/30">
                        <p className="text-sm font-medium mb-3">{qi + 1}. {q.question}</p>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => {
                            const selected = quizAnswers[qi] === oi;
                            const isCorrect = oi === q.correctIndex;
                            const showResult = quizSubmitted;
                            return (
                              <button
                                key={oi}
                                onClick={() => { if (!quizSubmitted) setQuizAnswers(prev => ({ ...prev, [qi]: oi })); }}
                                className={cn(
                                  "w-full text-left p-3 rounded-lg text-sm transition-all border",
                                  showResult && selected && isCorrect ? "bg-eternia-success/10 border-eternia-success/30 text-eternia-success"
                                    : showResult && selected && !isCorrect ? "bg-destructive/10 border-destructive/30 text-destructive"
                                    : showResult && isCorrect ? "bg-eternia-success/5 border-eternia-success/20"
                                    : selected ? "bg-primary/10 border-primary/30 text-foreground"
                                    : "bg-card border-border/50 text-muted-foreground hover:bg-muted/50"
                                )}
                                disabled={quizSubmitted}
                              >
                                <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
                {completedModules.includes(currentModule.day_number) ? (
                  <span className="text-sm text-eternia-success flex items-center gap-1"><CheckCircle className="w-4 h-4" />Completed</span>
                ) : currentModule.day_number === 7 ? (
                  <span className="text-sm text-muted-foreground italic">This module requires a live interview with an expert</span>
                ) : currentModule.has_quiz && !quizSubmitted ? (
                  <Button
                    onClick={() => setQuizSubmitted(true)}
                    disabled={Object.keys(quizAnswers).length < currentModule.quiz_questions.length}
                  >
                    Submit Quiz
                  </Button>
                ) : currentModule.has_quiz && quizSubmitted ? (
                  <>
                    {currentModule.quiz_questions.every((q, i) => quizAnswers[i] === q.correctIndex) ? (
                      <Button onClick={() => handleCompleteModule(currentModule)} className="gap-1">
                        <CheckCircle className="w-4 h-4" />Complete Module
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }}>
                        Retry Quiz
                      </Button>
                    )}
                  </>
                ) : (
                  <Button onClick={() => handleCompleteModule(currentModule)} className="gap-1">
                    <CheckCircle className="w-4 h-4" />Complete Module
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================== PEER SESSIONS TAB =================== */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold font-display">All Peer Sessions</h2>
            {mySessions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No sessions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mySessions.map((session: any) => (
                  <div key={session.id} className={cn("p-4 rounded-xl border", session.is_flagged ? "bg-destructive/5 border-destructive/20" : "bg-card border-border/50")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">{session.student?.username || "Student"}</p>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                            session.is_flagged ? "bg-destructive/10 text-destructive"
                              : session.status === "active" ? "bg-eternia-success/10 text-eternia-success"
                              : session.status === "completed" ? "bg-primary/10 text-primary"
                              : "bg-eternia-warning/10 text-eternia-warning"
                          )}>{session.is_flagged ? "⚠ Flagged" : session.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{format(new Date(session.created_at), "EEE, MMM d · h:mm a")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {session.status === "active" && (
                          <>
                            <Button size="sm" className="gap-1 h-7 text-[11px] px-2.5" onClick={() => navigate(`/dashboard/peer-connect?sessionId=${session.id}`)}>Join</Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" onClick={async () => {
                              await supabase.from("peer_sessions").update({ status: "completed" as any, ended_at: new Date().toISOString() }).eq("id", session.id);
                              queryClient.invalidateQueries({ queryKey: ["intern-sessions"] });
                              toast.success("Session ended");
                            }}>End</Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 text-destructive border-destructive/30" onClick={() => setEscalationDialog({ open: true, sessionId: session.id })}>
                              <AlertTriangle className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================== NOTES TAB =================== */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold font-display">Session History</h2>
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by student..." value={notesSearch} onChange={(e) => setNotesSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <Select value={notesFilterInstitution} onValueChange={setNotesFilterInstitution}>
                <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="Institution" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Institutions</SelectItem>
                  {institutions.map((inst) => (<SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {completedSessions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/50">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No session history yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completedSessions
                  .filter((s: any) => !notesSearch || (s.student?.username || "").toLowerCase().includes(notesSearch.toLowerCase()))
                  .filter((s: any) => notesFilterInstitution === "all" || s.student?.institution_id === notesFilterInstitution)
                  .map((session: any) => (
                    <div key={session.id} className="p-4 rounded-xl bg-card border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm">{session.student?.username || "Student"}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(session.created_at), "MMM d, yyyy · h:mm a")}</p>
                      </div>
                      {session.escalation_note_encrypted && (
                        <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{session.escalation_note_encrypted}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {session.is_flagged && <span className="px-2 py-0.5 rounded-full text-[10px] bg-destructive/10 text-destructive">Flagged</span>}
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-eternia-success/10 text-eternia-success">Completed</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* =================== PROFILE TAB =================== */}
        {activeTab === "profile" && (
          <div className="space-y-4 max-w-md">
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-eternia flex items-center justify-center shrink-0">
                  <User className="w-8 h-8 text-background" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{profile?.username}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{profile?.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">CRR Verification</p>
                  {profile?.is_verified ? (
                    <span className="text-sm font-medium text-eternia-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Verified</span>
                  ) : (
                    <span className="text-sm font-medium text-eternia-warning flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pending</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Training</p>
                  <p className={cn("text-sm font-medium", isTrainingComplete ? "text-eternia-success" : "text-eternia-warning")}>
                    {isTrainingComplete ? "Complete" : isInterviewPending ? "Interview Pending" : `${completedModules.length}/7`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Sessions</p>
                  <p className="text-sm font-medium">{completedSessions.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Joined</p>
                  <p className="text-sm font-medium">{profile?.created_at ? format(new Date(profile.created_at), "MMM d, yyyy") : "—"}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start gap-2 h-11 text-sm text-destructive" onClick={signOut}>
              <LogOut className="w-4 h-4" />Logout
            </Button>
          </div>
        )}
      </div>

      {/* Escalation Dialog */}
      <Dialog open={escalationDialog.open} onOpenChange={(o) => setEscalationDialog({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Submit Escalation</DialogTitle>
            <DialogDescription>Describe why this session needs to be escalated to a SPOC or expert.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Describe the situation..." value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} className="min-h-[100px]" />
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

export default InternDashboardContent;

function ReferralCodeInput({ user, queryClient, refreshProfile }: { user: any; queryClient: any; refreshProfile: () => Promise<void> }) {
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
      <div className="p-4 rounded-xl bg-primary/5 border border-dashed border-primary/20 flex items-center justify-between gap-3">
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
    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
      <p className="text-xs font-medium flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 text-primary" />Enter Referral Code</p>
      <div className="flex gap-2">
        <Input
          placeholder="e.g. REF-ABC12345"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="h-8 text-xs font-mono flex-1"
        />
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
