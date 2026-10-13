import { useIsMobile } from "@/hooks/use-mobile";
import MobileAdminDashboard from "@/components/mobile/MobileAdminDashboard";

import { useState, useMemo, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Calendar, MessageCircle, AlertTriangle, TrendingUp, Coins, Key,
  Shield, Activity, Eye, CheckCircle, Clock, BarChart3, Search, Loader2,
  UserPlus, Settings, Music, Building2, FileText, QrCode, Crown, UserCheck,
  Stethoscope, GraduationCap, Phone, Zap, Filter, BookOpen, LogOut, ArrowLeft, Gamepad2,
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft,
} from "lucide-react";
import InstitutionManager from "@/components/admin/InstitutionManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import SPOCTools from "@/components/admin/SPOCTools";
import RoleManager from "@/components/admin/RoleManager";
import MemberManager, { ReferralCodesCard } from "@/components/admin/MemberManager";
import CreditGrantTool from "@/components/admin/CreditGrantTool";
import SoundManager from "@/components/admin/SoundManager";
import AuditLogViewer from "@/components/admin/AuditLogViewer";
import EscalationManager from "@/components/admin/EscalationManager";
import AccountDeletion from "@/components/admin/AccountDeletion";
import DeletionRequestsManager from "@/components/admin/DeletionRequestsManager";
import TrainingModuleManager from "@/components/admin/TrainingModuleManager";
import InstitutionDetailView from "@/components/admin/InstitutionDetailView";
import NotificationBell from "@/components/notifications/NotificationBell";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import QuestCardManager from "@/components/admin/QuestCardManager";
import EmergencyAlertOverlay from "@/components/notifications/EmergencyAlertOverlay";
import OverviewDashboard from "@/components/admin/OverviewDashboard";
import PasswordResetManager from "@/components/admin/PasswordResetManager";
import SessionsLogViewer from "@/components/admin/SessionsLogViewer";
import InquiryTicketManager from "@/components/admin/InquiryTicketManager";

type TabId = "overview" | "members" | "sessions" | "spoc" | "roles" | "sounds" | "audit" | "escalations" | "training" | "institution-detail" | "analytics" | "tools" | "password-resets" | "inquiries";
type RoleFilter = "all" | "spoc" | "expert" | "intern" | "therapist";
type SessionFilter = "all" | "appointment" | "peer" | "blackbox";

interface SidebarGroup {
  label: string;
  items: { id: TabId; label: string; icon: any }[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Analytics",
    items: [
      { id: "overview", label: "Overview", icon: BarChart3 },
      { id: "analytics", label: "Site Analytics", icon: Eye },
    ],
  },
  {
    label: "People",
    items: [
      { id: "members", label: "Members", icon: Users },
      { id: "roles", label: "Roles & Credits", icon: UserPlus },
    ],
  },
  {
    label: "Activity",
    items: [{ id: "sessions", label: "Sessions", icon: Calendar }],
  },
  {
    label: "Institutions",
    items: [
      { id: "spoc", label: "SPOC / Institutions", icon: Building2 },
      { id: "inquiries", label: "Inquiries", icon: Phone },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "training", label: "Training", icon: BookOpen },
      { id: "sounds", label: "Sounds", icon: Music },
      { id: "tools", label: "Quest Cards", icon: Gamepad2 },
    ],
  },
  {
    label: "Safety",
    items: [
      { id: "escalations", label: "Escalations", icon: AlertTriangle },
      { id: "password-resets", label: "Password Resets", icon: Key },
      { id: "audit", label: "Audit Logs", icon: FileText },
    ],
  },
];

const AdminDashboard = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, members, stats, appointments, peerSessions, flaggedEntries, blackboxSessions, institutions, isLoading } = useAdmin();
  // Members filtering
  const filteredMembers = useMemo(() => {
    let filtered = members;
    if (roleFilter !== "all") {
      if (roleFilter === "therapist") {
        filtered = filtered.filter((m) => m.role === "expert" && m.specialty);
      } else {
        filtered = filtered.filter((m) => m.role === roleFilter);
      }
    }
    if (searchQuery) {
      filtered = filtered.filter((m) => m.username.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [members, roleFilter, searchQuery]);

  // Unified session feed
  const unifiedSessions = useMemo(() => {
    const items: { id: string; type: "appointment" | "peer" | "blackbox"; description: string; date: string; status: string; flagged?: boolean; rescheduled?: boolean; rescheduleReason?: string; rescheduledFrom?: string; expertName?: string; studentName?: string }[] = [];

    if (sessionFilter === "all" || sessionFilter === "appointment") {
      appointments.forEach((apt: any) => {
        items.push({
          id: apt.id, type: "appointment",
          description: `${apt.expert?.username || "Expert"} → ${apt.student?.username || "Student"}`,
          date: apt.slot_time, status: apt.status,
          rescheduled: !!apt.reschedule_reason,
          rescheduleReason: apt.reschedule_reason,
          rescheduledFrom: apt.rescheduled_from,
          expertName: apt.expert?.username,
          studentName: apt.student?.username,
        });
      });
    }
    if (sessionFilter === "all" || sessionFilter === "peer") {
      peerSessions.forEach((s: any) => {
        items.push({ id: s.id, type: "peer", description: `${s.student?.username || "Student"} ↔ ${s.intern?.username || "Pending"}`, date: s.created_at, status: s.status, flagged: s.is_flagged });
      });
    }
    if (sessionFilter === "all" || sessionFilter === "blackbox") {
      blackboxSessions.forEach((bs: any) => {
        items.push({ id: bs.id, type: "blackbox", description: `BlackBox${bs.therapist?.username ? ` → ${bs.therapist.username}` : ""}`, date: bs.created_at, status: bs.status, flagged: bs.flag_level > 0 });
      });
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments, peerSessions, blackboxSessions, sessionFilter]);

  const [showMobileWarning, setShowMobileWarning] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("admin_mobile_warning_dismissed");
    }
    return true;
  });

  if (isMobile) return (
    <>
      <AlertDialog open={showMobileWarning && isMobile} onOpenChange={setShowMobileWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Best Viewed on Desktop</AlertDialogTitle>
            <AlertDialogDescription>
              The Admin Dashboard is optimized for larger screens. For the best experience with all analytics, tables, and management tools, please open this on a desktop or laptop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              localStorage.setItem("admin_mobile_warning_dismissed", "true");
              setShowMobileWarning(false);
            }}>
              Got it, continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MobileAdminDashboard />
    </>
  );

  if (!isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center justify-center h-64">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
      </div>
    </div>
  );

  const roleCounts = {
    admin: members.filter(m => m.role === "admin").length,
    spoc: members.filter(m => m.role === "spoc").length,
    expert: members.filter(m => m.role === "expert").length,
    intern: members.filter(m => m.role === "intern").length,
    student: members.filter(m => m.role === "student").length,
  };

  const roleFilterButtons: { id: RoleFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "spoc", label: "SPOC" }, { id: "expert", label: "Expert" }, { id: "intern", label: "Intern" }, { id: "therapist", label: "Therapist" },
  ];

  const sessionFilterButtons: { id: SessionFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "appointment", label: "Appointments" }, { id: "peer", label: "Peer" }, { id: "blackbox", label: "BlackBox" },
  ];

  const getSessionTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      appointment: "bg-primary/10 text-primary",
      peer: "bg-accent/10 text-accent",
      blackbox: "bg-destructive/10 text-destructive",
    };
    return map[type] || "bg-muted text-muted-foreground";
  };

  const activeLabel = SIDEBAR_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label || "Overview";

  return (
    <div className="min-h-screen bg-background flex">
      <EmergencyAlertOverlay onViewFlags={() => setActiveTab("escalations")} />
      {/* ─── SIDEBAR ─── */}
      <aside className={cn(
        "h-screen sticky top-0 flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 shrink-0",
        sidebarCollapsed ? "w-[60px]" : "w-[220px]"
      )}>
        {/* Logo / Title */}
        <div className="p-3 border-b border-border/30 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-primary" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold font-display truncate">Admin</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile?.username}</p>
            </div>
          )}
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && (
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all",
                        sidebarCollapsed ? "justify-center p-2.5" : "px-2.5 py-2",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      {isActive && item.id === "escalations" && flaggedEntries.length > 0 && (
                        <span className={cn(
                          "ml-auto bg-destructive text-destructive-foreground rounded-full text-[9px] font-bold",
                          sidebarCollapsed ? "absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center" : "px-1.5 py-0.5"
                        )}>
                          {flaggedEntries.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-border/30 p-2 space-y-0.5">
          <button
            onClick={() => navigate("/dashboard")}
            title={sidebarCollapsed ? "Back to App" : undefined}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all",
              sidebarCollapsed ? "justify-center p-2.5" : "px-2.5 py-2"
            )}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Back to App</span>}
          </button>
          <button
            onClick={() => signOut()}
            title={sidebarCollapsed ? "Logout" : undefined}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all",
              sidebarCollapsed ? "justify-center p-2.5" : "px-2.5 py-2"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all",
              sidebarCollapsed ? "justify-center p-2.5" : "px-2.5 py-2"
            )}
          >
            {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-5">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold font-display">{activeLabel}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSuperAdmin ? "Super Admin" : "SPOC"} · {members.length} members · {stats.totalSessions} sessions
              </p>
            </div>
            <NotificationBell />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* ─── OVERVIEW ─── */}
              {activeTab === "overview" && (
                <OverviewDashboard
                  stats={stats}
                  members={members}
                  flaggedEntries={flaggedEntries}
                  unifiedSessions={unifiedSessions}
                  onNavigateTab={(tab) => setActiveTab(tab as TabId)}
                />
              )}

              {/* ─── MEMBERS ─── */}
              {activeTab === "members" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {roleFilterButtons.map((rf) => (
                      <button key={rf.id} onClick={() => setRoleFilter(rf.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${roleFilter === rf.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                        {rf.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search members..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 bg-card text-sm" /></div>
                    <Button size="sm" variant="outline" className="gap-1 h-9 text-xs" onClick={() => setActiveTab("roles")}><UserPlus className="w-3.5 h-3.5" />Add</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{filteredMembers.length} members{roleFilter !== "all" ? ` (${roleFilter})` : ""}</p>
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border/50"><Users className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No results</p></div>
                  ) : (
                    <div className="space-y-2">{filteredMembers.map((member) => (
                      <div key={member.id} className="p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.username}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${member.role === "admin" ? "bg-destructive/10 text-destructive" : member.role === "spoc" ? "bg-primary/10 text-primary" : member.role === "expert" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{member.role}</span>
                            <span className="text-[10px] text-muted-foreground">{member.total_sessions} sessions</span>
                            {member.institution_id && <span className="text-[10px] text-muted-foreground/60">• institution linked</span>}
                          </div>
                        </div>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${member.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      </div>
                    ))}</div>
                  )}
                </div>
              )}

              {/* ─── SESSIONS ─── */}
              {activeTab === "sessions" && (
                <div className="max-w-5xl">
                  <SessionsLogViewer
                    appointments={appointments}
                    peerSessions={peerSessions}
                    blackboxSessions={blackboxSessions}
                  />
                </div>
              )}

              {/* ─── SPOC ─── */}
              {activeTab === "spoc" && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                  <div className="min-w-0">
                    <InstitutionManager onSelectInstitution={(inst) => {
                      setSelectedInstitution(inst);
                      setActiveTab("institution-detail");
                    }} />
                  </div>
                  <div><RoleManager /></div>
                </div>
              )}

              {activeTab === "institution-detail" && selectedInstitution && (
                <InstitutionDetailView institution={selectedInstitution} onBack={() => setActiveTab("spoc")} />
              )}

              {/* ─── ROLES ─── */}
              {activeTab === "roles" && (
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
                  <MemberManager />
                  <div className="space-y-4">
                    <RoleManager />
                    <CreditGrantTool />
                    <ReferralCodesCard />
                  </div>
                </div>
              )}

              {/* ─── SOUNDS ─── */}
              {activeTab === "sounds" && <div className="max-w-2xl"><SoundManager /></div>}

              {/* ─── ESCALATIONS ─── */}
              {activeTab === "escalations" && <div className="max-w-3xl"><EscalationManager /></div>}

              {/* ─── AUDIT LOGS ─── */}
              {activeTab === "audit" && (
                <div className="max-w-4xl space-y-4">
                  <DeletionRequestsManager />
                  <AuditLogViewer />
                  <AccountDeletion />
                </div>
              )}

              {/* ─── TRAINING ─── */}
              {activeTab === "training" && <div className="max-w-3xl"><TrainingModuleManager /></div>}

              {/* ─── ANALYTICS ─── */}
              {activeTab === "analytics" && <div className="max-w-5xl"><AnalyticsDashboard /></div>}

              {/* ─── TOOLS (Quest Cards) ─── */}
              {activeTab === "tools" && <div className="max-w-4xl"><QuestCardManager /></div>}

              {/* ─── PASSWORD RESETS ─── */}
              {activeTab === "password-resets" && <div className="max-w-3xl"><PasswordResetManager /></div>}

              {/* ─── INQUIRIES ─── */}
              {activeTab === "inquiries" && <div className="max-w-4xl"><InquiryTicketManager /></div>}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
