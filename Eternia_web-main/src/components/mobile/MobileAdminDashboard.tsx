import { useState, useMemo, lazy, Suspense } from "react";
import {
  Users, Calendar, MessageCircle, AlertTriangle, Coins, Key,
  Shield, Activity, BarChart3, Search, Loader2,
  UserPlus, Settings, Building2, Crown, Stethoscope,
  GraduationCap, Zap, Eye, CheckCircle, Music, FileText, BookOpen, Copy, Check, Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

import RoleManager from "@/components/admin/RoleManager";
import MemberManager from "@/components/admin/MemberManager";
import CreditGrantTool from "@/components/admin/CreditGrantTool";
import SoundManager from "@/components/admin/SoundManager";
import EscalationManager from "@/components/admin/EscalationManager";
import AuditLogViewer from "@/components/admin/AuditLogViewer";
import AccountDeletion from "@/components/admin/AccountDeletion";
import DeletionRequestsManager from "@/components/admin/DeletionRequestsManager";
import InstitutionDetailView from "@/components/admin/InstitutionDetailView";
import TrainingModuleManager from "@/components/admin/TrainingModuleManager";
import NotificationBell from "@/components/notifications/NotificationBell";
const AnalyticsDashboard = lazy(() => import("@/components/admin/AnalyticsDashboard"));
import QuestCardManager from "@/components/admin/QuestCardManager";
import PasswordResetManager from "@/components/admin/PasswordResetManager";

type TabId = "overview" | "members" | "sessions" | "spoc" | "roles" | "sounds" | "escalations" | "audit" | "training" | "institution-detail" | "analytics" | "tools" | "password-resets";
type RoleFilter = "all" | "spoc" | "expert" | "intern" | "therapist";
type SessionFilter = "all" | "appointment" | "peer" | "blackbox";

const MobileAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { profile } = useAuth();
  const { isAdmin, members, stats, appointments, peerSessions, flaggedEntries, blackboxSessions, institutions, isLoading } = useAdmin();

  const filteredMembers = useMemo(() => {
    let filtered = members;
    if (roleFilter !== "all") {
      filtered = roleFilter === "therapist"
        ? filtered.filter((m) => m.role === "expert" && m.specialty)
        : filtered.filter((m) => m.role === roleFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter((m) => m.username.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [members, roleFilter, searchQuery]);

  const unifiedSessions = useMemo(() => {
    const items: { id: string; type: "appointment" | "peer" | "blackbox"; description: string; date: string; status: string; flagged?: boolean }[] = [];
    if (sessionFilter === "all" || sessionFilter === "appointment") {
      appointments.forEach((apt: any) => {
        items.push({ id: apt.id, type: "appointment", description: `${apt.expert?.username || "Expert"} → ${apt.student?.username || "Student"}`, date: apt.slot_time, status: apt.status });
      });
    }
    if (sessionFilter === "all" || sessionFilter === "peer") {
      peerSessions.forEach((s: any) => {
        items.push({ id: s.id, type: "peer", description: `${s.student?.username || "Student"} → ${s.intern?.username || "Pending"}`, date: s.created_at, status: s.status, flagged: s.is_flagged });
      });
    }
    if (sessionFilter === "all" || sessionFilter === "blackbox") {
      blackboxSessions.forEach((bs: any) => {
        items.push({ id: bs.id, type: "blackbox", description: `BlackBox${bs.therapist?.username ? ` → ${bs.therapist.username}` : ""}`, date: bs.created_at, status: bs.status, flagged: bs.flag_level > 0 });
      });
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, peerSessions, blackboxSessions, sessionFilter]);

  const roleCounts = useMemo(() => ({
    admin: members.filter((m) => m.role === "admin").length,
    spoc: members.filter((m) => m.role === "spoc").length,
    expert: members.filter((m) => m.role === "expert").length,
    intern: members.filter((m) => m.role === "intern").length,
    student: members.filter((m) => m.role === "student").length,
  }), [members]);

  const institutionData = useMemo(() => {
    return institutions.map((inst: any) => {
      const instMembers = members.filter(m => m.institution_id === inst.id);
      const spoc = instMembers.find(m => m.role === "spoc");
      const studentCount = instMembers.filter(m => m.role === "student").length;
      return { ...inst, spoc, studentCount, memberCount: instMembers.length };
    });
  }, [institutions, members]);

  if (!isAdmin) return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center h-64">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" /><h2 className="text-base font-semibold">Access Denied</h2>
      </div>
    </DashboardLayout>
  );

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "analytics", label: "Analytics", icon: Eye },
    { id: "members", label: "Members", icon: Users },
    { id: "sessions", label: "Sessions", icon: Calendar },
    { id: "spoc", label: "SPOC", icon: Building2 },
    { id: "roles", label: "Roles", icon: UserPlus },
    { id: "training", label: "Training", icon: BookOpen },
    { id: "sounds", label: "Sounds", icon: Music },
    { id: "tools", label: "Quest Cards", icon: Gamepad2 },
    { id: "password-resets", label: "Resets", icon: Key },
    { id: "escalations", label: "Escalations", icon: AlertTriangle },
    { id: "audit", label: "Audit", icon: FileText },
  ];

  const getTypeBadge = (type: string) => {
    const map: Record<string, string> = { appointment: "bg-primary/10 text-primary", peer: "bg-eternia-lavender/10 text-eternia-lavender", blackbox: "bg-eternia-warning/10 text-eternia-warning" };
    return map[type] || "bg-muted text-muted-foreground";
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold font-display">Admin Dashboard</h1>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="icon" className="h-9 w-9"><Settings className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="rounded-2xl p-5 border border-primary/20" style={{ background: "linear-gradient(135deg, hsl(var(--eternia-teal) / 0.15), hsl(var(--eternia-lavender) / 0.15))" }}>
          <h2 className="text-base font-bold font-display mb-1">Control Center</h2>
          <p className="text-xs text-muted-foreground">Full system overview</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-full text-sm font-medium ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
              <tab.icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
          <>
            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Super Admins", value: roleCounts.admin, icon: Shield, iconBg: "bg-destructive/10", iconColor: "text-destructive" },
                    { label: "SPOCs", value: roleCounts.spoc, icon: Shield, iconBg: "bg-primary/10", iconColor: "text-primary" },
                    { label: "Experts", value: roleCounts.expert, icon: CheckCircle, iconBg: "bg-eternia-success/10", iconColor: "text-eternia-success" },
                    { label: "Interns", value: roleCounts.intern, icon: Users, iconBg: "bg-eternia-warning/10", iconColor: "text-eternia-warning" },
                    { label: "Students", value: roleCounts.student, icon: Users, iconBg: "bg-eternia-lavender/10", iconColor: "text-eternia-lavender" },
                    { label: "Sessions", value: stats.totalSessions, icon: Activity, iconBg: "bg-primary/10", iconColor: "text-primary" },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-2xl bg-card border border-border/50">
                      <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center mb-3`}>
                        <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                      </div>
                      <p className="text-2xl font-bold leading-none">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {flaggedEntries.length > 0 && (
                  <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-destructive" />Flagged ({flaggedEntries.length})</h3>
                    {flaggedEntries.slice(0, 3).map((entry: any) => (
                      <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/30 mb-1.5 last:mb-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${entry.ai_flag_level >= 3 ? "bg-destructive text-destructive-foreground" : "bg-eternia-warning/20 text-eternia-warning"}`}>
                          {entry.ai_flag_level >= 3 ? "Critical" : "Moderate"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), "MMM d")}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Grant Credits", icon: Coins, tab: "roles" as TabId },
                    { label: "Add Member", icon: UserPlus, tab: "roles" as TabId },
                    { label: "View Sessions", icon: Calendar, tab: "sessions" as TabId },
                    { label: "Institutions", icon: Building2, tab: "spoc" as TabId },
                  ].map((a) => (
                    <button key={a.label} className="p-4 rounded-2xl bg-muted/30 border border-border text-left active:scale-[0.97]" onClick={() => setActiveTab(a.tab)}>
                      <a.icon className="w-5 h-5 text-primary mb-2" /><p className="font-medium text-sm">{a.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MEMBERS */}
            {activeTab === "members" && (
              <div className="space-y-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {(["all", "spoc", "expert", "intern", "therapist"] as RoleFilter[]).map((rf) => (
                    <button key={rf} onClick={() => setRoleFilter(rf)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${roleFilter === rf ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                      {rf}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 bg-card text-sm" /></div>
                </div>
                <p className="text-xs text-muted-foreground">{filteredMembers.length} members</p>
                {filteredMembers.map((m) => (
                  <div key={m.id} className="p-4 rounded-2xl bg-card border border-border/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.username}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-xs capitalize ${m.role === "admin" ? "bg-destructive/10 text-destructive" : m.role === "spoc" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{m.role}</span>
                        <span className="text-xs text-muted-foreground">{m.total_sessions}s · {m.streak_days}d</span>
                      </div>
                    </div>
                    <span className={`w-3 h-3 rounded-full shrink-0 ${m.is_active ? "bg-eternia-success" : "bg-muted-foreground"}`} />
                  </div>
                ))}
              </div>
            )}

            {/* SESSIONS */}
            {activeTab === "sessions" && (
              <div className="space-y-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {(["all", "appointment", "peer", "blackbox"] as SessionFilter[]).map((sf) => (
                    <button key={sf} onClick={() => setSessionFilter(sf)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${sessionFilter === sf ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                      {sf}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{unifiedSessions.length} sessions</p>
                {unifiedSessions.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground"><Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No sessions</p></div>
                ) : unifiedSessions.map((s) => (
                  <div key={s.id} className={`p-3 rounded-2xl border flex items-start justify-between gap-2 ${s.flagged ? "bg-destructive/5 border-destructive/20" : "bg-card border-border/50"}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(s.date), "MMM d, h:mm a")}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] capitalize ${getTypeBadge(s.type)}`}>{s.type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${s.flagged ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{s.flagged ? "⚠" : s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SPOC */}
            {activeTab === "spoc" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Institutions & SPOCs</h3>
                {institutionData.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground"><Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No institutions</p></div>
                ) : institutionData.map((inst: any) => (
                  <div key={inst.id} className="p-4 rounded-2xl bg-card border border-border/50 space-y-3 cursor-pointer active:scale-[0.98]" onClick={() => { setSelectedInstitution(inst); setActiveTab("institution-detail"); }}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{inst.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${inst.is_active ? "bg-eternia-success/10 text-eternia-success" : "bg-muted text-muted-foreground"}`}>{inst.is_active ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/30">
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">SPOC</p>
                      {inst.spoc ? (
                        <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-primary" /><span className="text-sm font-medium">{inst.spoc.username}</span></div>
                      ) : <p className="text-xs text-muted-foreground italic">Not assigned</p>}
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/30">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Eternia Code</p>
                        <code className="text-sm font-mono font-bold tracking-widest">{inst.eternia_code_hash || "Code unavailable"}</code>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!inst.eternia_code_hash) return;
                          navigator.clipboard.writeText(inst.eternia_code_hash);
                          setCopiedId(inst.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
                      >
                        {copiedId === inst.id ? <Check className="w-3.5 h-3.5 text-eternia-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-muted/20 text-center"><p className="text-lg font-bold">{inst.studentCount}</p><p className="text-[10px] text-muted-foreground">Students</p></div>
                      <div className="p-2 rounded-lg bg-muted/20 text-center"><p className="text-lg font-bold">{inst.memberCount}</p><p className="text-[10px] text-muted-foreground">Members</p></div>
                      <div className="p-2 rounded-lg bg-muted/20 text-center"><p className="text-lg font-bold">{inst.credits_pool}</p><p className="text-[10px] text-muted-foreground">Credits</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ROLES */}
            {activeTab === "roles" && (
              <div className="space-y-4">
                <MemberManager />
                <RoleManager />
                <CreditGrantTool />
              </div>
            )}

            {/* SOUNDS */}
            {activeTab === "sounds" && (
              <div><SoundManager /></div>
            )}

            {/* ESCALATIONS */}
            {activeTab === "escalations" && (
              <div><EscalationManager /></div>
            )}

            {/* AUDIT */}
            {activeTab === "audit" && (
              <div className="space-y-4">
                <DeletionRequestsManager />
                <AuditLogViewer />
                <AccountDeletion />
              </div>
            )}

            {/* TRAINING */}
            {activeTab === "training" && (
              <div><TrainingModuleManager /></div>
            )}

            {/* ANALYTICS */}
            {activeTab === "analytics" && (
              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                <AnalyticsDashboard />
              </Suspense>
            )}

            {/* TOOLS (Quest Cards) */}
            {activeTab === "tools" && (
              <div><QuestCardManager /></div>
            )}

            {/* PASSWORD RESETS */}
            {activeTab === "password-resets" && (
              <div><PasswordResetManager /></div>
            )}

            {/* INSTITUTION DETAIL */}
            {activeTab === "institution-detail" && selectedInstitution && (
              <InstitutionDetailView
                institution={selectedInstitution}
                onBack={() => setActiveTab("spoc")}
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MobileAdminDashboard;
