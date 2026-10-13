import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertTriangle, CheckCircle, XCircle, Clock,
  Shield, Eye, Loader2, Plus, FileText, Phone, User, Flag,
} from "lucide-react";

const EscalationManager = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [justification, setJustification] = useState("");
  const isAdmin = profile?.role === "admin";

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["escalation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalation_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Resolve SPOC usernames via separate lookup
      const spocIds = [...new Set(data.map((e: any) => e.spoc_id).filter(Boolean))];
      let spocMap: Record<string, string> = {};
      if (spocIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", spocIds);
        if (profiles) {
          spocMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.username]));
        }
      }

      return data.map((e: any) => ({ ...e, spoc_username: spocMap[e.spoc_id] || null }));
    },
  });

  const createEscalation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("escalation_requests").insert({
        spoc_id: user.id,
        justification_encrypted: justification,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action_type: "escalation_request_created",
        target_table: "escalation_requests",
        metadata: { justification_length: justification.length },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-requests"] });
      toast.success("Escalation submitted");
      setJustification("");
      setShowNewForm(false);
    },
    onError: () => toast.error("Failed to submit"),
  });

  const updateEscalation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("escalation_requests")
        .update({
          status,
          admin_id: user.id,
          resolved_at: status === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action_type: `escalation_${status}`,
        target_table: "escalation_requests",
        target_id: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-requests"] });
      toast.success("Escalation updated");
    },
  });

  const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-amber-500 bg-amber-500/10", label: "Pending" },
    approved: { icon: CheckCircle, color: "text-emerald-500 bg-emerald-500/10", label: "Approved" },
    rejected: { icon: XCircle, color: "text-destructive bg-destructive/10", label: "Rejected" },
    resolved: { icon: Shield, color: "text-primary bg-primary/10", label: "Resolved" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Escalations ({escalations.length})
        </h2>
        {!isAdmin && (
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowNewForm(!showNewForm)}>
            <Plus className="w-3.5 h-3.5" />
            New
          </Button>
        )}
      </div>

      {showNewForm && (
        <div className="p-3 rounded-xl bg-card border border-destructive/20 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-destructive" />
            <p className="font-medium text-sm">Escalation Request</p>
          </div>
          <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/10 text-xs text-muted-foreground">
            <p className="font-medium text-destructive mb-0.5">⚠️ Important</p>
            This initiates a formal identity reveal. All requests are audited.
          </div>
          <Textarea
            placeholder="Justification..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => createEscalation.mutate()}
              disabled={!justification.trim() || createEscalation.isPending}
              className="gap-1.5 h-8 text-xs"
              variant="destructive"
              size="sm"
            >
              {createEscalation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowNewForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : escalations.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border/50">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No Escalations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {escalations.map((esc: any) => {
            const config = statusConfig[esc.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            let parsed: any = null;
            try { parsed = JSON.parse(esc.trigger_snippet); } catch {}
            const isCritical = esc.escalation_level === 3 || esc.status === "critical";
            return (
              <div key={esc.id} className={`p-3 rounded-xl ${isCritical ? "bg-destructive/5 border-2 border-destructive/30" : "bg-card border border-border/50"}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium flex items-center gap-1 ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                    {esc.escalation_level && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        esc.escalation_level === 3 ? "bg-destructive text-destructive-foreground"
                          : esc.escalation_level === 2 ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        L{esc.escalation_level}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(esc.created_at), "MMM d, h:mm a")}
                  </span>
                </div>

                {/* Party Info */}
                <div className="flex items-center gap-3 mb-2 text-xs">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Filed by:</span>
                    <span className="font-medium">{esc.spoc_username || "SPOC"}</span>
                  </div>
                   {parsed?.student_username && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Student:</span>
                      <span className="font-medium">{parsed.student_username}</span>
                    </div>
                  )}
                  {parsed?.escalated_by_role && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Escalated by:</span>
                      <span className="font-medium capitalize">{parsed.escalated_by_role}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-2.5 bg-muted/30 p-2.5 rounded-lg line-clamp-3">
                  {esc.justification_encrypted}
                </p>

                {/* Parsed trigger_snippet: student details + emergency contact + transcript or peer session flag */}
                {parsed?.type === "peer_session_flag" && (
                  <div className="mt-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Flag className="w-3.5 h-3.5 text-destructive" />
                      <span className="font-medium">Peer Session Flagged</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Student</p>
                        <p className="font-semibold">{parsed.student_username}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Intern</p>
                        <p className="font-semibold">{parsed.intern_username}</p>
                      </div>
                    </div>
                    {parsed.reason && (
                      <p className="text-[11px] text-muted-foreground italic">"{parsed.reason}"</p>
                    )}
                  </div>
                )}
                {parsed?.type === "emergency_contact" && (
                  <div className="mt-2 p-3 rounded-lg bg-destructive/10 border-2 border-destructive/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-destructive shrink-0" />
                      <p className="text-xs font-bold text-destructive">🚨 Emergency Contact</p>
                      {parsed.escalated_by_role && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary capitalize">
                          {parsed.escalated_by_role}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {parsed.student_eternia_id && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Eternia ID</p>
                          <p className="font-semibold font-mono">{parsed.student_eternia_id}</p>
                        </div>
                      )}
                      {parsed.student_username && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Username</p>
                          <p className="font-semibold">{parsed.student_username}</p>
                        </div>
                      )}
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
                          <p className="font-medium text-yellow-400">Contact is student themselves</p>
                        </div>
                      )}
                    </div>
                    {parsed.transcript_snippet && (
                      <div className="mt-1 p-2 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">±10s Transcript Snippet</p>
                        <pre className="text-[11px] text-foreground whitespace-pre-wrap font-mono">{parsed.transcript_snippet}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* AI L3 Detection structured block */}
                {parsed?.type === "ai_l3_detection" && (
                  <div className="mt-2 p-3 rounded-lg bg-destructive/10 border-2 border-destructive/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      <p className="text-xs font-bold text-destructive">🤖 AI L3 Detection</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {parsed.student_eternia_id && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Eternia ID</p>
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
                    </div>
                    {parsed.keywords?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {parsed.keywords.map((kw: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-destructive/20 text-destructive font-medium">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {parsed.risk_indicators?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Risk Indicators</p>
                        <div className="flex flex-wrap gap-1">
                          {parsed.risk_indicators.map((ri: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 font-medium">{ri}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {parsed.reasoning && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">AI Reasoning</p>
                        <p className="text-[11px] text-foreground italic">"{parsed.reasoning}"</p>
                      </div>
                    )}
                    {parsed.transcript_snippet && (
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">±10s Transcript Snippet</p>
                        <pre className="text-[11px] text-foreground whitespace-pre-wrap font-mono">{parsed.transcript_snippet}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Non-JSON trigger snippet fallback */}
                {esc.trigger_snippet && !parsed?.type && (
                  <div className="mt-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                    <p className="text-[10px] font-medium text-destructive mb-0.5">Trigger Snippet</p>
                    <p className="text-[11px] text-muted-foreground italic">"{esc.trigger_snippet}"</p>
                  </div>
                )}

                {isAdmin && esc.status === "pending" && (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-border flex-wrap mt-2">
                    <Button size="sm" className="gap-1 h-7 text-[11px] px-2"
                      onClick={() => updateEscalation.mutate({ id: esc.id, status: "approved" })}>
                      <CheckCircle className="w-3 h-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px] px-2 text-destructive"
                      onClick={() => updateEscalation.mutate({ id: esc.id, status: "rejected" })}>
                      <XCircle className="w-3 h-3" /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-[11px] px-2"
                      onClick={() => updateEscalation.mutate({ id: esc.id, status: "resolved" })}>
                      <Eye className="w-3 h-3" /> Resolve
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
  );
};

export default EscalationManager;
