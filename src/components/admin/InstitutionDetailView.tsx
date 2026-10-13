import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowLeft, Building2, Users, Coins, Shield, Calendar,
  AlertTriangle, MessageCircle, UserPlus, Activity, Loader2,
  Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

interface Institution {
  id: string;
  name: string;
  eternia_code_hash: string;
  credits_pool: number;
  is_active: boolean;
  plan_type: string;
  institution_type: string;
  created_at: string;
}

interface InstitutionDetailViewProps {
  institution: Institution;
  onBack: () => void;
  onBulkAllocate?: (inst: Institution) => void;
}

const InstitutionDetailView = ({ institution, onBack, onBulkAllocate }: InstitutionDetailViewProps) => {
  const [codeCopied, setCodeCopied] = useState(false);

  // Students & staff for this institution
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["inst-detail-members", institution.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, role, is_active, total_sessions, streak_days, created_at")
        .eq("institution_id", institution.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Appointments involving this institution's members
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);

  const { data: appointments = [] } = useQuery({
    queryKey: ["inst-detail-appointments", institution.id, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("id, slot_time, status, student_id, expert_id, session_type")
        .in("student_id", memberIds)
        .order("slot_time", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: memberIds.length > 0,
  });

  // Peer sessions
  const { data: peerSessions = [] } = useQuery({
    queryKey: ["inst-detail-peer", institution.id, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("peer_sessions")
        .select("id, status, is_flagged, created_at, student_id")
        .in("student_id", memberIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: memberIds.length > 0,
  });

  // Stability pool
  const { data: stabilityPool } = useQuery({
    queryKey: ["inst-detail-pool", institution.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ecc_stability_pool")
        .select("*")
        .eq("institution_id", institution.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Student ID verification stats
  const { data: idStats } = useQuery({
    queryKey: ["inst-detail-ids", institution.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_student_ids")
        .select("is_claimed")
        .eq("institution_id", institution.id);
      if (error) throw error;
      const total = data?.length || 0;
      const claimed = data?.filter(d => d.is_claimed).length || 0;
      return { total, claimed, unclaimed: total - claimed };
    },
  });

  // Escalations from this institution's SPOC
  const spoc = members.find((m) => m.role === "spoc");
  const { data: escalations = [] } = useQuery({
    queryKey: ["inst-detail-escalations", spoc?.id],
    queryFn: async () => {
      if (!spoc) return [];
      const { data, error } = await supabase
        .from("escalation_requests")
        .select("id, status, escalation_level, created_at")
        .eq("spoc_id", spoc.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!spoc,
  });

  const roleCounts = useMemo(() => ({
    student: members.filter((m) => m.role === "student").length,
    intern: members.filter((m) => m.role === "intern").length,
    expert: members.filter((m) => m.role === "expert").length,
    spoc: members.filter((m) => m.role === "spoc").length,
  }), [members]);

  const flaggedCount = peerSessions.filter((s) => s.is_flagged).length;
  const totalSessions = appointments.length + peerSessions.length;

  const copyCode = () => {
    if (!institution.eternia_code_hash) {
      toast.error("Code unavailable");
      return;
    }
    navigator.clipboard.writeText(institution.eternia_code_hash);
    setCodeCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold font-display truncate">{institution.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant={institution.is_active ? "default" : "secondary"} className="text-[10px]">
              {institution.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">{institution.plan_type}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{institution.institution_type || "university"}</Badge>
            <span className="text-[10px] text-muted-foreground">Created {format(new Date(institution.created_at), "MMM d, yyyy")}</span>
          </div>
        </div>
        {onBulkAllocate && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => onBulkAllocate(institution)}>
            <UserPlus className="w-3.5 h-3.5" />Bulk IDs
          </Button>
        )}
      </div>

      {/* Eternia Code */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Eternia Code</p>
          <code className="text-lg font-mono font-bold tracking-widest">{institution.eternia_code_hash || "Code unavailable"}</code>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={copyCode}>
          {codeCopied ? <Check className="w-3.5 h-3.5 text-eternia-success" /> : <Copy className="w-3.5 h-3.5" />}
          {codeCopied ? "Copied" : "Copy"}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Students", value: roleCounts.student, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Interns", value: roleCounts.intern, icon: Users, color: "text-eternia-warning", bg: "bg-eternia-warning/10" },
          { label: "Experts", value: roleCounts.expert, icon: Shield, color: "text-eternia-success", bg: "bg-eternia-success/10" },
          { label: "Credit Pool", value: institution.credits_pool, icon: Coins, color: "text-eternia-warning", bg: "bg-eternia-warning/10" },
          { label: "Sessions", value: totalSessions, icon: Activity, color: "text-primary", bg: "bg-primary/10" },
          { label: "Flagged", value: flaggedCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border/50">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold leading-none">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Student ID Verification Stats */}
      {idStats && idStats.total > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />Student ID Verification
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-lg font-bold">{idStats.total}</p>
              <p className="text-[10px] text-muted-foreground">IDs Uploaded</p>
            </div>
            <div>
              <p className="text-lg font-bold text-eternia-success">{idStats.claimed}</p>
              <p className="text-[10px] text-muted-foreground">Claimed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-eternia-warning">{idStats.unclaimed}</p>
              <p className="text-[10px] text-muted-foreground">Unclaimed</p>
            </div>
          </div>
          {idStats.total > 0 && (
            <div className="mt-2">
              <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-eternia-success transition-all"
                  style={{ width: `${(idStats.claimed / idStats.total) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {Math.round((idStats.claimed / idStats.total) * 100)}% verification rate
              </p>
            </div>
          )}
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SPOC Info */}
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />SPOC Assignment
          </h3>
          {spoc ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{spoc.username}</p>
                <p className="text-xs text-muted-foreground">{spoc.total_sessions} sessions · Joined {format(new Date(spoc.created_at), "MMM yyyy")}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No SPOC assigned</p>
          )}
        </div>

        {/* Stability Pool */}
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-eternia-warning" />Stability Pool
          </h3>
          {stabilityPool ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-lg font-bold">{stabilityPool.balance}</p>
                <p className="text-[10px] text-muted-foreground">Balance</p>
              </div>
              <div>
                <p className="text-lg font-bold">{stabilityPool.total_contributed}</p>
                <p className="text-[10px] text-muted-foreground">Contributed</p>
              </div>
              <div>
                <p className="text-lg font-bold">{stabilityPool.total_disbursed}</p>
                <p className="text-[10px] text-muted-foreground">Disbursed</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No pool data</p>
          )}
        </div>
      </div>

      {/* Members List */}
      <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />Members ({members.length})
          </h3>
        </div>
        {membersLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No members yet</p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border/30">
            {members.map((m) => (
              <div key={m.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.username}</p>
                  <p className="text-[10px] text-muted-foreground">{m.total_sessions} sessions · {m.streak_days}d streak</p>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${
                  m.role === "spoc" ? "bg-primary/10 text-primary"
                    : m.role === "expert" ? "bg-eternia-success/10 text-eternia-success"
                    : m.role === "intern" ? "bg-eternia-warning/10 text-eternia-warning"
                    : "bg-muted text-muted-foreground"
                }`}>{m.role}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${m.is_active ? "bg-eternia-success" : "bg-muted-foreground"}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Appointments */}
        <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />Appointments ({appointments.length})
            </h3>
          </div>
          {appointments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground"><p className="text-xs">No appointments</p></div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto divide-y divide-border/30">
              {appointments.slice(0, 20).map((apt) => (
                <div key={apt.id} className="px-4 py-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{format(new Date(apt.slot_time), "MMM d, h:mm a")}</p>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${
                    apt.status === "completed" ? "bg-eternia-success/10 text-eternia-success"
                      : apt.status === "cancelled" ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}>{apt.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Peer Sessions */}
        <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-eternia-lavender" />Peer Sessions ({peerSessions.length})
            </h3>
          </div>
          {peerSessions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground"><p className="text-xs">No peer sessions</p></div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto divide-y divide-border/30">
              {peerSessions.slice(0, 20).map((ps) => (
                <div key={ps.id} className="px-4 py-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{format(new Date(ps.created_at), "MMM d, h:mm a")}</p>
                  <div className="flex items-center gap-1.5">
                    {ps.is_flagged && <span className="px-1.5 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive">⚠</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${
                      ps.status === "completed" ? "bg-eternia-success/10 text-eternia-success"
                        : ps.status === "active" ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>{ps.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Escalations */}
      {escalations.length > 0 && (
        <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />Escalations ({escalations.length})
            </h3>
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-border/30">
            {escalations.map((esc) => (
              <div key={esc.id} className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    (esc.escalation_level || 1) >= 3 ? "bg-destructive/10 text-destructive"
                      : (esc.escalation_level || 1) >= 2 ? "bg-eternia-warning/10 text-eternia-warning"
                      : "bg-primary/10 text-primary"
                  }`}>L{esc.escalation_level || 1}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${
                    esc.status === "approved" ? "bg-eternia-success/10 text-eternia-success"
                      : esc.status === "rejected" ? "bg-destructive/10 text-destructive"
                      : "bg-eternia-warning/10 text-eternia-warning"
                  }`}>{esc.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{format(new Date(esc.created_at), "MMM d, h:mm a")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionDetailView;
