import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import EmergencyAlertOverlay from "@/components/notifications/EmergencyAlertOverlay";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
  Home, Users, AlertTriangle, BarChart3, User,
  QrCode, Copy, Check, Shield, Activity, Calendar,
  MessageCircle, Coins, Bell, Eye, Loader2,
  CheckCircle, Clock, XCircle, FileText, Plus,
  Search, Filter, Download, LogOut, Lock, Settings,
  TrendingUp, Music, Gamepad2, Phone, RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import StudentIdVerificationSection from "./StudentIdVerificationSection";


type SPOCTab = "home" | "onboarding" | "flags" | "reports" | "profile";

const SPOCDashboardContent = () => {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as SPOCTab | null;
  const [activeTab, setActiveTab] = useState<SPOCTab>(tabFromUrl || "home");

  // Sync tab when URL params change
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  const [copiedQR, setCopiedQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [showNewEscalation, setShowNewEscalation] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [reportDateFilter, setReportDateFilter] = useState("30");
  const [searchQuery, setSearchQuery] = useState("");
  // Student creation state removed — students onboard via temp IDs + QR
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ username: string; password: string }[] | null>(null);

  const institutionId = profile?.institution_id;

  // ─── Queries ───
  const { data: institution } = useQuery({
    queryKey: ["spoc-institution", institutionId],
    queryFn: async () => {
      if (!institutionId) return null;
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, plan_type, credits_pool, is_active, institution_type, eternia_code_hash")
        .eq("id", institutionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!institutionId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["spoc-students", institutionId],
    queryFn: async () => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_active, is_verified, created_at, total_sessions, streak_days")
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!institutionId,
  });

  const { data: todaySessions = 0 } = useQuery({
    queryKey: ["spoc-today-sessions", institutionId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("slot_time", today.toISOString());
      return count || 0;
    },
    enabled: !!institutionId,
  });

  const { data: peerSessionCount = 0 } = useQuery({
    queryKey: ["spoc-peer-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("peer_sessions")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: expertSessionCount = 0 } = useQuery({
    queryKey: ["spoc-expert-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: escalations = [], isLoading: escalationsLoading } = useQuery({
    queryKey: ["spoc-escalations"],
    queryFn: async () => {
      // Use a simple select to avoid FK join failures masking data
      const { data, error } = await supabase
        .from("escalation_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Real-time escalation notifications
  const [newEscalationCount, setNewEscalationCount] = useState(0);
  useEffect(() => {
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`spoc-escalation-realtime-${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "escalation_requests" },
        (payload) => {
          const newEsc = payload.new as any;
          // Only notify if it's for this SPOC or their institution
          if (newEsc.spoc_id === user?.id || (newEsc.status === "critical")) {
            setNewEscalationCount((c) => c + 1);
            toast.warning(
              newEsc.status === "critical"
                ? "🚨 Critical escalation: A student may need immediate support"
                : "⚠️ A student in your institution may need support",
              { duration: 8000 }
            );
            queryClient.invalidateQueries({ queryKey: ["spoc-escalations"] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const studentIds = students.map((s) => s.id);

  const { data: flaggedEntries = [] } = useQuery({
    queryKey: ["spoc-flagged", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("blackbox_entries")
        .select("id, user_id, content_type, ai_flag_level, is_private, created_at")
        .gt("ai_flag_level", 0)
        .in("user_id", studentIds)
        .order("ai_flag_level", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: studentIds.length > 0,
  });

  const [reportLastUpdated, setReportLastUpdated] = useState<Date | null>(null);

  const { data: reportData } = useQuery({
    queryKey: ["spoc-reports", reportDateFilter, studentIds],
    queryFn: async () => {
      const since = subDays(new Date(), parseInt(reportDateFilter)).toISOString();
      if (studentIds.length === 0) {
        setReportLastUpdated(new Date());
        return { appointments: 0, peerSessions: 0, moodEntries: 0, questCompletions: 0 };
      }
      const [appointments, peerSessions, moodEntries, questCompletions] = await Promise.all([
        supabase.from("appointments").select("*", { count: "exact", head: true }).in("student_id", studentIds).gte("created_at", since),
        supabase.from("peer_sessions").select("*", { count: "exact", head: true }).in("student_id", studentIds).gte("created_at", since),
        supabase.from("mood_entries").select("*", { count: "exact", head: true }).in("user_id", studentIds).gte("created_at", since),
        supabase.from("quest_completions").select("*", { count: "exact", head: true }).in("user_id", studentIds).gte("completed_at", since),
      ]);
      setReportLastUpdated(new Date());
      return {
        appointments: appointments.count || 0,
        peerSessions: peerSessions.count || 0,
        moodEntries: moodEntries.count || 0,
        questCompletions: questCompletions.count || 0,
      };
    },
    enabled: studentIds.length > 0,
  });

  // Realtime refresh for reports
  useEffect(() => {
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`spoc-reports-realtime-${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["spoc-reports"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "peer_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["spoc-reports"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quest_completions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["spoc-reports"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mood_entries" }, () => {
        queryClient.invalidateQueries({ queryKey: ["spoc-reports"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: stabilityPoolBalance = 0 } = useQuery({
    queryKey: ["stability-pool", institutionId],
    queryFn: async () => {
      if (!institutionId) return 0;
      const { data, error } = await supabase.rpc("get_pool_balance", { _institution_id: institutionId });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!institutionId,
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["spoc-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, actor:profiles!audit_logs_actor_id_fkey(username)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // ─── Mutations ───
  const createEscalation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("escalation_requests").insert({
        spoc_id: user.id,
        justification_encrypted: escalationReason,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action_type: "escalation_request_created",
        target_table: "escalation_requests",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spoc-escalations"] });
      toast.success("Escalation submitted");
      setEscalationReason("");
      setShowNewEscalation(false);
    },
    onError: () => toast.error("Failed to submit escalation"),
  });

  // ─── Helpers ───
  const [grantAmount, setGrantAmount] = useState("10");
  const [isGranting, setIsGranting] = useState(false);

  // Query temp credential pool stats
  const { data: tempCredStats } = useQuery({
    queryKey: ["spoc-temp-creds-stats", institutionId],
    queryFn: async () => {
      if (!institutionId) return { unused: 0, assigned: 0, activated: 0 };
      const { data, error } = await supabase
        .from("temp_credentials")
        .select("status")
        .eq("institution_id", institutionId);
      if (error) throw error;
      const stats = { unused: 0, assigned: 0, activated: 0 };
      (data || []).forEach((c: any) => {
        if (c.status === "unused") stats.unused++;
        else if (c.status === "assigned") stats.assigned++;
        else if (c.status === "activated") stats.activated++;
      });
      return stats;
    },
    enabled: !!institutionId,
  });

  const downloadBulkCSV = () => {
    if (!bulkResults) return;
    const csv = "Username,Password\n" + bulkResults.map(m => `${m.username},${m.password}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "student-credentials.csv";
    a.click();
    toast.success("Credentials CSV downloaded");
  };

  // Dynamic QR code query
  const { data: qrData, isLoading: qrLoading, error: qrError, refetch: regenerateQR } = useQuery({
    queryKey: ["spoc-qr", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-spoc-qr");
      if (error) {
        // Parse the actual error message from the edge function response
        const msg = error.message || "Failed to generate QR";
        if (msg.includes("No temp IDs available") || msg.includes("non-2xx")) {
          throw new Error("No temp IDs available — ask your admin to generate more.");
        }
        throw new Error(msg);
      }
      if (data?.error) {
        if (data.error.includes("No temp IDs available") || data.error.includes("No temp ID")) {
          throw new Error("No temp IDs available — ask your admin to generate more.");
        }
        throw new Error(data.error);
      }
      return data as { qr_payload: string };
    },
    enabled: !!user && profile?.role === "spoc",
    staleTime: Infinity,
    retry: false,
  });

  const qrPayload = qrData?.qr_payload || "";

  const copyQRPayload = () => {
    if (!qrPayload) { toast.error("No QR code generated yet"); return; }
    navigator.clipboard.writeText(qrPayload);
    setCopiedQR(true);
    toast.success("QR payload copied!");
    setTimeout(() => setCopiedQR(false), 2000);
  };

  const downloadQR = useCallback(() => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 600;
    canvas.width = size;
    canvas.height = size;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "hsl(222, 47%, 6%)";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = "eternia-spoc-qr.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success("QR code downloaded!");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  const grantCreditsToStudents = async () => {
    if (!user || !institutionId) return;
    setIsGranting(true);
    try {
      const amount = parseInt(grantAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
      // Insert credit_transactions for all students
      const inserts = students.map((s) => ({
        user_id: s.id,
        delta: amount,
        type: "grant" as const,
        notes: `SPOC bulk grant`,
        institution_id: institutionId,
      }));
      // Batch insert (max 100 at a time)
      for (let i = 0; i < inserts.length; i += 100) {
        const batch = inserts.slice(i, i + 100);
        const { error } = await supabase.from("credit_transactions").insert(batch);
        if (error) throw error;
      }
      toast.success(`Granted ${amount} ECC to ${students.length} students`);
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsGranting(false);
  };


  const activeStudents = students.filter((s) => s.is_active).length;
  const filteredStudents = students.filter((s) =>
    s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-eternia-warning bg-eternia-warning/10", label: "Pending" },
    critical: { icon: AlertTriangle, color: "text-destructive bg-destructive/10 animate-pulse", label: "Critical" },
    approved: { icon: CheckCircle, color: "text-eternia-success bg-eternia-success/10", label: "Approved" },
    rejected: { icon: XCircle, color: "text-destructive bg-destructive/10", label: "Rejected" },
    resolved: { icon: Shield, color: "text-primary bg-primary/10", label: "Resolved" },
  };

  const tabs: { id: SPOCTab; label: string; icon: typeof Home }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "onboarding", label: "Onboarding", icon: Users },
    { id: "flags", label: "Flags", icon: AlertTriangle },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="space-y-5 pb-24">
      <EmergencyAlertOverlay onViewFlags={() => setActiveTab("flags")} />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display">SPOC Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {institution?.name || "Institution"} — Student wellbeing management
          </p>
        </div>
        
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ HOME TAB ═══════════════ */}
      {activeTab === "home" && (
        <div className="space-y-4">
          {/* Institution Overview */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-sm font-display">{institution?.name || "Your Institution"}</h2>
                <p className="text-xs text-muted-foreground">
                  {activeStudents} active students · {institution?.plan_type || "Basic"} plan
                </p>
                {institution?.eternia_code_hash && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Eternia Code:</span>
                    <code className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/50 text-foreground">
                      {institution.eternia_code_hash}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(institution.eternia_code_hash);
                        toast.success("Eternia code copied!");
                      }}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Active Students", value: activeStudents, icon: Users, iconBg: "bg-primary/10", iconColor: "text-primary" },
              { label: "Sessions Today", value: todaySessions, icon: Calendar, iconBg: "bg-eternia-success/10", iconColor: "text-eternia-success" },
              { label: "Peer Connect", value: peerSessionCount, icon: MessageCircle, iconBg: "bg-accent/10", iconColor: "text-accent" },
              { label: "Expert Sessions", value: expertSessionCount, icon: Phone, iconBg: "bg-eternia-warning/10", iconColor: "text-eternia-warning" },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-2xl bg-card border border-border/50 hover:border-border transition-colors">
                <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center mb-2.5`}>
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
                <p className="text-xl font-bold leading-none">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Alert Area */}
          {flaggedEntries.length > 0 && (
            <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-destructive" />
                  <p className="text-sm font-medium">{flaggedEntries.length} AI Flagged Entries</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs border-destructive/30 text-destructive"
                  onClick={() => setActiveTab("flags")}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Alerts
                </Button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-primary/30 transition-all group"
              onClick={() => setActiveTab("onboarding")}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <QrCode className="w-4 h-4 text-primary" />
              </div>
              <p className="font-medium text-sm">Generate QR</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Onboard students</p>
            </button>
            <button
              className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-primary/30 transition-all group"
              onClick={() => setActiveTab("reports")}
            >
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-4 h-4 text-accent" />
              </div>
              <p className="font-medium text-sm">View Reports</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Wellbeing analytics</p>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ STUDENT ONBOARDING TAB ═══════════════ */}
      {activeTab === "onboarding" && (
        <div className="space-y-4">
          {/* QR Code Section */}
          <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              QR Onboarding Code
            </h3>
            <p className="text-xs text-muted-foreground">
              Students scan this QR to verify your institution during onboarding.
            </p>
            <div className="flex flex-col items-center">
              <div
                ref={qrRef}
                className="relative p-5 rounded-2xl bg-background border-2 border-primary/15 shadow-lg shadow-primary/5"
              >
                {qrLoading ? (
                  <div className="w-[200px] h-[200px] flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                ) : qrPayload ? (
                  <QRCodeSVG
                    value={qrPayload}
                    size={200}
                    bgColor="transparent"
                    fgColor="hsl(243, 100%, 69%)"
                    level="H"
                    includeMargin={false}
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-2">
                    <QrCode className="w-12 h-12 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground text-center px-4">
                      {qrError?.message || "Failed to generate QR code"}
                    </p>
                    <Button size="sm" variant="outline" className="mt-1 text-xs h-7" onClick={() => regenerateQR()}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Try Again
                    </Button>
                  </div>
                )}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Institution verification · Regenerable anytime
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={copyQRPayload} disabled={!qrPayload}>
                {copiedQR ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={downloadQR} disabled={!qrPayload}>
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => regenerateQR()} disabled={qrLoading}>
                <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground italic">HMAC-signed · Institution verification · Audited</p>
          </div>

          {/* Temp Credential Pool Stats */}
          <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Temp ID Pool
            </h3>
            <p className="text-xs text-muted-foreground">
              Temp IDs are created by admin for bulk onboarding (separate from QR verification).
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold text-primary">{tempCredStats?.unused || 0}</p>
                <p className="text-[10px] text-muted-foreground">Available</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold text-eternia-warning">{tempCredStats?.assigned || 0}</p>
                <p className="text-[10px] text-muted-foreground">Assigned</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold text-eternia-success">{tempCredStats?.activated || 0}</p>
                <p className="text-[10px] text-muted-foreground">Activated</p>
              </div>
            </div>
            {(tempCredStats?.unused || 0) === 0 && (
              <div className="p-2.5 rounded-lg bg-eternia-warning/10 border border-eternia-warning/20">
                <p className="text-xs text-eternia-warning font-medium">No temp IDs available. Contact your admin to generate more.</p>
              </div>
            )}
          </div>


          <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              Grant Credits to Students
            </h3>
            <p className="text-xs text-muted-foreground">
              Bulk-allocate ECC to all enrolled students ({students.length} students).
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                className="w-24 h-9 text-sm"
                min="1"
                max="1000"
              />
              <span className="text-xs text-muted-foreground">ECC per student</span>
            </div>
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={grantCreditsToStudents}
              disabled={isGranting || students.length === 0}
            >
              {isGranting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
              Grant to All Students
            </Button>
          </div>

          {/* ── Student ID Verification Management ── */}
          <StudentIdVerificationSection institutionId={institutionId} institutionType={institution?.institution_type} />

          {/* Student List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Student IDs ({students.length})
              </h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-card text-sm"
              />
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-border/50">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No students found</p>
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{student.username}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Joined {format(new Date(student.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                        student.is_active
                          ? "bg-eternia-success/10 text-eternia-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {student.is_active ? "Allocated" : "Revoked"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ FLAGS & ESCALATION TAB ═══════════════ */}
      {activeTab === "flags" && (
        <div className="space-y-4">
          {/* Flagged Entries */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              AI Flagged Entries ({flaggedEntries.length})
            </h3>
            {flaggedEntries.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-border/50">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-eternia-success" />
                <p className="text-sm font-medium">All Clear</p>
                <p className="text-xs text-muted-foreground mt-1">No flagged entries</p>
              </div>
            ) : (
              flaggedEntries.map((entry: any) => (
                <div key={entry.id} className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        entry.ai_flag_level >= 3
                          ? "bg-destructive text-destructive-foreground"
                          : entry.ai_flag_level === 2
                          ? "bg-eternia-warning/20 text-eternia-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {entry.ai_flag_level >= 3 ? "🔴 Critical" : entry.ai_flag_level === 2 ? "🟡 Moderate" : "🟢 Low"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(entry.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Flagged by AI safety system — requires review</p>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] px-2">
                    <Eye className="w-3 h-3" />
                    Review
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Escalation Reports */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Escalation Reports ({escalations.length})
              </h3>
              <Button
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setShowNewEscalation(!showNewEscalation)}
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </Button>
            </div>

            {showNewEscalation && (
              <div className="p-3 rounded-xl bg-card border border-destructive/20 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-destructive" />
                  <p className="font-medium text-sm">New Escalation</p>
                </div>
                <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/10 text-xs text-muted-foreground">
                  <p className="font-medium text-destructive mb-0.5">⚠️ This initiates a formal identity reveal request.</p>
                  All requests are audited and logged.
                </div>
                <Textarea
                  placeholder="Reason for escalation..."
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => createEscalation.mutate()}
                    disabled={!escalationReason.trim() || createEscalation.isPending}
                    className="gap-1.5 h-8 text-xs"
                    variant="destructive"
                    size="sm"
                  >
                    {createEscalation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Submit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowNewEscalation(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {escalationsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : escalations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-border/50">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No escalations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {escalations.map((esc: any) => {
                  const config = statusConfig[esc.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <div key={esc.id} className={`p-3 rounded-xl border ${esc.escalation_level === 3 ? "bg-destructive/5 border-destructive/30" : "bg-card border-border/50"}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium flex items-center gap-1 ${config.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            esc.escalation_level === 3 ? "bg-destructive text-destructive-foreground"
                              : esc.escalation_level === 2 ? "bg-eternia-warning/20 text-eternia-warning"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            L{esc.escalation_level || 1}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(esc.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-destructive">⚠️ Reason for Escalation</p>
                        <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg line-clamp-3">
                          {esc.justification_encrypted}
                        </p>
                      </div>
                      {esc.trigger_snippet && (() => {
                        let parsed: any = null;
                        try { parsed = JSON.parse(esc.trigger_snippet); } catch {}
                        
                        // Always show structured session details if available
                        const hasSessionInfo = parsed && (parsed.student_eternia_id || parsed.student_username || parsed.session_id || parsed.session_type);
                        
                        return (
                          <div className="mt-2 space-y-2">
                            {/* Structured session details */}
                            {hasSessionInfo && (
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <p className="text-[10px] font-semibold text-primary mb-1.5">📋 Session Details</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {parsed.student_eternia_id && (
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Student ID</p>
                                      <p className="font-semibold font-mono">{parsed.student_eternia_id}</p>
                                    </div>
                                  )}
                                  {parsed.student_username && (
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Username</p>
                                      <p className="font-semibold">{parsed.student_username}</p>
                                    </div>
                                  )}
                                  {parsed.session_type && (
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Session Type</p>
                                      <p className="font-medium capitalize">{parsed.session_type}</p>
                                    </div>
                                  )}
                                  {parsed.session_id && (
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Session ID</p>
                                      <p className="font-mono text-[10px] truncate">{parsed.session_id}</p>
                                    </div>
                                  )}
                                  {parsed.escalated_by_role && (
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Escalated By</p>
                                      <p className="font-semibold capitalize">{parsed.escalated_by_role}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Transcript snippet (shown for all escalation types) */}
                            {parsed?.transcript_snippet && (
                              <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">±10s Transcript Snippet</p>
                                <p className="text-[11px] text-foreground italic">"{parsed.transcript_snippet}"</p>
                              </div>
                            )}
                            
                            {/* Emergency contact block */}
                            {parsed?.type === "emergency_contact" && (
                              <div className="p-3 rounded-lg bg-destructive/10 border-2 border-destructive/30 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-destructive shrink-0" />
                                  <p className="text-xs font-bold text-destructive">🚨 Emergency Contact</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-[10px] text-muted-foreground">Name</p>
                                    <p className="font-semibold">{parsed.name || "Not provided"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground">Phone</p>
                                    <p className="font-semibold font-mono">{parsed.phone || "Not provided"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground">Relation</p>
                                    <p className="font-medium">{parsed.relation || "Not specified"}</p>
                                  </div>
                                  {parsed.is_self && (
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Note</p>
                                      <p className="font-medium text-eternia-warning">Contact is student themselves</p>
                                    </div>
                                  )}
                                </div>
                                </div>
                            )}
                            
                            {/* AI L3 Detection structured block */}
                            {parsed?.type === "ai_l3_detection" && (
                              <div className="p-3 rounded-lg bg-destructive/10 border-2 border-destructive/30 space-y-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                                  <p className="text-xs font-bold text-destructive">🤖 AI L3 Detection</p>
                                </div>
                                {parsed.keywords?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {parsed.keywords.map((kw: string, i: number) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-destructive/20 text-destructive font-medium">{kw}</span>
                                    ))}
                                  </div>
                                )}
                                {parsed.risk_indicators?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {parsed.risk_indicators.map((ri: string, i: number) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 font-medium">{ri}</span>
                                    ))}
                                  </div>
                                )}
                                {parsed.reasoning && (
                                  <p className="text-[11px] text-foreground italic">"{parsed.reasoning}"</p>
                                )}
                                {parsed.transcript_snippet && (
                                  <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">±10s Transcript</p>
                                    <pre className="text-[11px] text-foreground whitespace-pre-wrap font-mono">{parsed.transcript_snippet}</pre>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Fallback: raw trigger snippet for non-JSON or non-emergency */}
                            {!parsed && (
                              <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                                <p className="text-[10px] font-medium text-destructive mb-0.5">Trigger Snippet</p>
                                <p className="text-[11px] text-muted-foreground italic">"{esc.trigger_snippet}"</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {esc.escalation_level === 3 && (!esc.trigger_snippet || (() => {
                        try {
                          const p = JSON.parse(esc.trigger_snippet);
                          return p?.type === "emergency_contact" && (!p.name || p.name === "Not provided") && (!p.phone || p.phone === "Not provided");
                        } catch { return true; }
                      })()) && (
                        <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 flex-wrap">
                          <Phone className="w-3.5 h-3.5 text-destructive shrink-0" />
                          <p className="text-[10px] font-medium text-destructive flex-1">L3 Critical — Emergency contact missing or incomplete</p>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 text-[10px] px-2 gap-1"
                            onClick={async () => {
                              try {
                                let studentId: string | null = null;
                                try {
                                  const parsed = JSON.parse(esc.trigger_snippet || "{}");
                                  studentId = parsed.session_id ? null : null;
                                } catch {}
                                // Re-fetch via the escalate-emergency function won't work without session
                                // Instead use get-emergency-contact if we can find the student
                                const snippet = esc.trigger_snippet ? JSON.parse(esc.trigger_snippet) : {};
                                if (!snippet.session_id) {
                                  toast.error("No session ID available to fetch contact");
                                  return;
                                }
                                const { data, error } = await supabase.functions.invoke("get-emergency-contact", {
                                  body: { student_id: snippet.student_id || snippet.student_username, session_id: snippet.session_id },
                                });
                                if (error || data?.error) {
                                  toast.error(data?.error || "Failed to fetch contact");
                                  return;
                                }
                                if (data?.contact) {
                                  // Update trigger_snippet with contact data
                                  const updated = { ...snippet, ...data.contact };
                                  await supabase.from("escalation_requests").update({
                                    trigger_snippet: JSON.stringify(updated),
                                  }).eq("id", esc.id);
                                  queryClient.invalidateQueries({ queryKey: ["spoc-escalations"] });
                                  toast.success("Emergency contact retrieved");
                                } else {
                                  toast.info("No emergency contact on file for this student");
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Failed to fetch contact");
                              }
                            }}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Fetch Contact
                          </Button>
                        </div>
                      )}
                      {esc.resolved_at && (
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Resolved {format(new Date(esc.resolved_at), "MMM d, h:mm a")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ REPORTS TAB ═══════════════ */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Wellbeing Reports
              <span className="flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-eternia-success animate-pulse" />
                <span className="text-[10px] font-normal text-muted-foreground">Live</span>
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {reportLastUpdated && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  Updated {format(reportLastUpdated, "h:mm a")}
                </span>
              )}
              <select
                value={reportDateFilter}
                onChange={(e) => setReportDateFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  const rows = [
                    ["Metric", "Value", "Period"],
                    ["Peer Connect Sessions", String(reportData?.peerSessions || 0), `Last ${reportDateFilter} days`],
                    ["Appointments", String(reportData?.appointments || 0), `Last ${reportDateFilter} days`],
                    ["Mood Check-ins", String(reportData?.moodEntries || 0), `Last ${reportDateFilter} days`],
                    ["Quests Completed", String(reportData?.questCompletions || 0), `Last ${reportDateFilter} days`],
                    ["ECC Stability Pool", String(stabilityPoolBalance), "Current"],
                    ["Critical Flags", String(flaggedEntries.filter((f: any) => f.ai_flag_level >= 3).length), "All time"],
                    ["Moderate Flags", String(flaggedEntries.filter((f: any) => f.ai_flag_level === 2).length), "All time"],
                    ["Low Flags", String(flaggedEntries.filter((f: any) => f.ai_flag_level === 1).length), "All time"],
                  ];
                  const csv = rows.map(r => r.join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `spoc-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
                  a.click();
                  toast.success("Report CSV downloaded");
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Report Cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Peer Connect Usage",
                value: reportData?.peerSessions || 0,
                icon: MessageCircle,
                iconBg: "bg-accent/10",
                iconColor: "text-accent",
                desc: "Total peer sessions",
              },
              {
                label: "Appointments",
                value: reportData?.appointments || 0,
                icon: Calendar,
                iconBg: "bg-primary/10",
                iconColor: "text-primary",
                desc: "Expert sessions booked",
              },
              {
                label: "Mood Check-ins",
                value: reportData?.moodEntries || 0,
                icon: Activity,
                iconBg: "bg-eternia-warning/10",
                iconColor: "text-eternia-warning",
                desc: "Student mood entries",
              },
              {
                label: "Quest Engagement",
                value: reportData?.questCompletions || 0,
                icon: Gamepad2,
                iconBg: "bg-eternia-success/10",
                iconColor: "text-eternia-success",
                desc: "Quests completed",
              },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-2xl bg-card border border-border/50">
                <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center mb-2.5`}>
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
                <p className="text-xl font-bold leading-none">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground">{stat.desc}</p>
              </div>
            ))}
          </div>

          {/* ECC Stability Pool */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" />
                ECC Stability Pool
              </h4>
              <span className="text-xs text-muted-foreground">Institution Reserve</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stabilityPoolBalance} <span className="text-sm font-normal text-muted-foreground">ECC</span></p>
            <p className="text-[10px] text-muted-foreground mt-1">Auto-contributed from institutional credit pool for emergency grants</p>
          </div>

          {/* Risk Overview */}
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-eternia-warning" />
              Risk Factor Summary
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/10 text-center">
                <p className="text-lg font-bold text-destructive">
                  {flaggedEntries.filter((f: any) => f.ai_flag_level >= 3).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Critical</p>
              </div>
              <div className="p-3 rounded-xl bg-eternia-warning/5 border border-eternia-warning/10 text-center">
                <p className="text-lg font-bold text-eternia-warning">
                  {flaggedEntries.filter((f: any) => f.ai_flag_level === 2).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Moderate</p>
              </div>
              <div className="p-3 rounded-xl bg-eternia-success/5 border border-eternia-success/10 text-center">
                <p className="text-lg font-bold text-eternia-success">
                  {flaggedEntries.filter((f: any) => f.ai_flag_level === 1).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Low</p>
              </div>
            </div>
          </div>

          {/* M.Phil Override Records */}
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              M.Phil Override Records
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Escalations where level was elevated (L2→L3) or sessions transferred to experts.
            </p>
            {escalations.filter((e: any) => e.escalation_level >= 3).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No override records found</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {escalations.filter((e: any) => e.escalation_level >= 3).map((esc: any) => (
                  <div key={esc.id} className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive text-destructive-foreground">
                        L{esc.escalation_level}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(esc.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{esc.justification_encrypted}</p>
                    {esc.trigger_snippet && (
                      <p className="text-[10px] text-destructive mt-1 italic">"{esc.trigger_snippet}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ PROFILE TAB ═══════════════ */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          {/* SPOC Profile Card */}
          <div className="p-5 rounded-2xl bg-card border border-border/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{profile?.username}</h3>
                <p className="text-xs text-muted-foreground capitalize">{profile?.role} · SPOC</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Institution</span>
                <span className="text-xs font-medium">{institution?.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Role</span>
                <span className="text-xs font-medium capitalize">{profile?.role}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Contact Email</span>
                <span className="text-xs font-medium">{profile?.username}@eternia.local</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Verification</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  profile?.is_verified
                    ? "bg-eternia-success/10 text-eternia-success"
                    : "bg-eternia-warning/10 text-eternia-warning"
                }`}>
                  {profile?.is_verified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2 h-11 text-sm">
              <Lock className="w-4 h-4" />
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-11 text-sm">
              <Settings className="w-4 h-4" />
              Notification Settings
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-11 text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>

          {/* Messaging / Audit Log */}
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Audit Log ({auditLogs.length})
            </h4>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-center py-6 text-xs text-muted-foreground">No audit logs</p>
              ) : (
                auditLogs.slice(0, 20).map((log: any) => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-muted text-muted-foreground">
                        {log.action_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs">
                      <span className="font-medium">{log.actor?.username || "System"}</span>
                      {log.target_table && <span className="text-muted-foreground"> → {log.target_table}</span>}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SPOCDashboardContent;
