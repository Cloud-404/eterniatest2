import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subHours } from "date-fns";
import { FileText, Loader2, Shield, ChevronDown, Copy, Check, Search, Filter, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACTION_COLORS: Record<string, string> = {
  escalation_request_created: "bg-destructive/10 text-destructive border-destructive/20",
  escalation_approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  escalation_rejected: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  escalation_resolved: "bg-primary/10 text-primary border-primary/20",
  escalation_submitted: "bg-destructive/10 text-destructive border-destructive/20",
  account_deleted: "bg-destructive/10 text-destructive border-destructive/20",
  account_deletion_requested: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  account_activated_via_temp_id: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  credit_grant: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  credit_grant_bulk: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  credit_grant_individual: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  role_assigned: "bg-primary/10 text-primary border-primary/20",
  spoc_qr_generated: "bg-primary/10 text-primary border-primary/20",
  admin_deleted_member: "bg-destructive/10 text-destructive border-destructive/20",
  ai_l3_escalation: "bg-destructive/10 text-destructive border-destructive/20",
  ai_risk_suggestion: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  l3_emergency_escalation: "bg-destructive/10 text-destructive border-destructive/20",
  bulk_temp_ids_created: "bg-primary/10 text-primary border-primary/20",
  bulk_members_created: "bg-primary/10 text-primary border-primary/20",
  member_created: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  session_refund: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  emergency_contact_accessed: "bg-destructive/10 text-destructive border-destructive/20",
  peer_session_flagged: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  indexnow_submit: "bg-muted text-muted-foreground border-border",
};

const ACTION_CATEGORIES: Record<string, string[]> = {
  Escalation: ["escalation_request_created", "escalation_approved", "escalation_rejected", "escalation_resolved", "escalation_submitted", "ai_l3_escalation", "l3_emergency_escalation"],
  Account: ["account_deleted", "account_deletion_requested", "account_activated_via_temp_id", "admin_deleted_member", "member_created", "bulk_members_created", "bulk_temp_ids_created"],
  Credits: ["credit_grant", "credit_grant_bulk", "credit_grant_individual", "session_refund"],
  Security: ["emergency_contact_accessed", "peer_session_flagged", "ai_risk_suggestion"],
  System: ["role_assigned", "spoc_qr_generated", "indexnow_submit"],
};

const DATE_FILTERS = [
  { label: "All Time", value: "all" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MetadataDisplay = ({ metadata, resolveName }: { metadata: Record<string, any> | null; resolveName: (id: string | null) => string }) => {
  if (!metadata || Object.keys(metadata).length === 0) return <span className="text-xs text-muted-foreground italic">No metadata</span>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {Object.entries(metadata).map(([key, value]) => {
        const strVal = typeof value === "object" ? JSON.stringify(value) : String(value);
        const resolved = typeof value === "string" && UUID_RE.test(value) ? resolveName(value) : null;
        return (
          <div key={key} className="flex flex-col gap-0.5 p-1.5 rounded bg-muted/30">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{key.replace(/_/g, " ")}</span>
            <span className="text-xs font-medium text-foreground break-all">
              {resolved ? <>{resolved} <span className="text-muted-foreground font-mono text-[10px]">({strVal.slice(0, 8)}…)</span></> : strVal}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const AuditLogViewer = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(50);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: profilesMap = new Map() } = useQuery({
    queryKey: ["audit-profiles-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username");
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach((p: any) => map.set(p.id, p.username));
      return map;
    },
  });

  const resolveName = (id: string | null): string => {
    if (!id) return "System";
    return profilesMap.get(id) || id.slice(0, 8) + "…";
  };

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const cutoff = dateFilter === "24h" ? subHours(now, 24) : dateFilter === "7d" ? subDays(now, 7) : subDays(now, 30);
      result = result.filter((l: any) => new Date(l.created_at) >= cutoff);
    }

    // Category filter
    if (categoryFilter !== "all") {
      const types = ACTION_CATEGORIES[categoryFilter] || [];
      result = result.filter((l: any) => types.includes(l.action_type));
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l: any) =>
        l.action_type.toLowerCase().includes(q) ||
        resolveName(l.actor_id).toLowerCase().includes(q) ||
        (l.target_table || "").toLowerCase().includes(q) ||
        resolveName(l.target_id).toLowerCase().includes(q)
      );
    }

    return result;
  }, [logs, search, categoryFilter, dateFilter]);

  const visibleLogs = filteredLogs.slice(0, visibleCount);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        Audit Logs ({filteredLogs.length})
      </h2>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, users, tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-card"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-card">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.keys(ACTION_CATEGORIES).map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-card">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FILTERS.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border/50">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No Logs Found</p>
          <p className="text-xs mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleLogs.map((log: any) => (
            <Collapsible key={log.id}>
              <div className="rounded-lg bg-card border border-border/50 overflow-hidden">
                <CollapsibleTrigger className="w-full p-2.5 text-left hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider shrink-0 border ${ACTION_COLORS[log.action_type] || "bg-muted text-muted-foreground border-border"}`}>
                        {log.action_type.replace(/_/g, " ")}
                      </span>
                      {log.target_table && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                          {log.target_table}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, h:mm:ss a")}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{resolveName(log.actor_id)}</span>
                    {log.target_id && (
                      <span className="text-muted-foreground font-mono text-[10px] truncate max-w-[180px]">
                        → {resolveName(log.target_id)}
                      </span>
                    )}
                    {log.ip_hash && (
                      <span className="text-muted-foreground text-[10px] ml-auto">
                        IP: {log.ip_hash.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-2.5 pb-2.5 pt-1 border-t border-border/30 space-y-2">
                    {/* Target ID */}
                    {log.target_id && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Target ID</span>
                        <span className="text-xs font-medium text-foreground">{resolveName(log.target_id)}</span>
                        <code className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{log.target_id}</code>
                        <CopyButton text={log.target_id} />
                      </div>
                    )}

                    {/* IP Hash */}
                    {log.ip_hash && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">IP Hash</span>
                        <code className="text-[10px] font-mono text-foreground bg-muted/50 px-1.5 py-0.5 rounded">{log.ip_hash}</code>
                        <CopyButton text={log.ip_hash} />
                      </div>
                    )}

                    {/* Actor ID */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Actor</span>
                      <span className="text-xs font-medium text-foreground">{resolveName(log.actor_id)}</span>
                      <code className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{log.actor_id}</code>
                      <CopyButton text={log.actor_id} />
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Timestamp</span>
                      <code className="text-[10px] font-mono text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                        {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss.SSS")}
                      </code>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Metadata</span>
                      <MetadataDisplay metadata={log.metadata} resolveName={resolveName} />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}

          {visibleCount < filteredLogs.length && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setVisibleCount((c) => c + 50)}
            >
              Load More ({filteredLogs.length - visibleCount} remaining)
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
