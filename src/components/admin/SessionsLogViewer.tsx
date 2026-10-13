import { useState, useMemo } from "react";
import { format, differenceInSeconds, subDays, subHours } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calendar, ChevronDown, Copy, Check, Clock, AlertTriangle, Search,
  Video, MessageCircle, Mic, Activity, Users, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SessionsLogViewerProps {
  appointments: any[];
  peerSessions: any[];
  blackboxSessions: any[];
}

type SessionType = "all" | "appointment" | "peer" | "blackbox";
type StatusFilter = "all" | "active" | "completed" | "cancelled" | "pending" | "escalated" | "flagged";
type DateFilter = "all" | "24h" | "7d" | "30d";

interface UnifiedSession {
  id: string;
  type: "appointment" | "peer" | "blackbox";
  // participants
  studentName: string;
  staffName: string;
  staffRole: string;
  // timestamps
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  // status
  status: string;
  flagged: boolean;
  flagLevel: number;
  // details
  roomId: string | null;
  sessionMode: string;
  creditsCharged: number;
  escalationHistory: any[] | null;
  escalationReason: string | null;
  rescheduled: boolean;
  rescheduleReason: string | null;
  rescheduledFrom: string | null;
  silenceDuration: number | null;
  refunded: boolean;
  // raw
  raw: any;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success(`${label} copied`); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      title={`Copy ${label}`}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

const TYPE_COLORS: Record<string, string> = {
  appointment: "bg-primary/10 text-primary border-primary/20",
  peer: "bg-accent/10 text-accent border-accent/20",
  blackbox: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-500",
  active: "bg-blue-500/10 text-blue-500",
  accepted: "bg-blue-500/10 text-blue-500",
  pending: "bg-amber-500/10 text-amber-500",
  queued: "bg-amber-500/10 text-amber-500",
  cancelled: "bg-muted text-muted-foreground",
  ended: "bg-muted text-muted-foreground",
  escalated: "bg-destructive/10 text-destructive",
  flagged: "bg-destructive/10 text-destructive",
  confirmed: "bg-primary/10 text-primary",
};

const MODE_ICONS: Record<string, any> = {
  video: Video,
  voice: Mic,
  chat: MessageCircle,
};

export default function SessionsLogViewer({ appointments, peerSessions, blackboxSessions }: SessionsLogViewerProps) {
  const [typeFilter, setTypeFilter] = useState<SessionType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  // Build unified sessions
  const allSessions: UnifiedSession[] = useMemo(() => {
    const items: UnifiedSession[] = [];

    appointments.forEach((a: any) => {
      items.push({
        id: a.id, type: "appointment",
        studentName: a.student?.username || "Student",
        staffName: a.expert?.username || "Expert",
        staffRole: "expert",
        createdAt: a.created_at, startedAt: a.slot_time, endedAt: a.completed_at,
        status: a.status, flagged: false, flagLevel: 0,
        roomId: a.room_id, sessionMode: a.session_type || "video",
        creditsCharged: a.credits_charged || 0,
        escalationHistory: null, escalationReason: null,
        rescheduled: !!a.reschedule_reason,
        rescheduleReason: a.reschedule_reason,
        rescheduledFrom: a.rescheduled_from,
        silenceDuration: null, refunded: false, raw: a,
      });
    });

    peerSessions.forEach((p: any) => {
      items.push({
        id: p.id, type: "peer",
        studentName: p.student?.username || "Student",
        staffName: p.intern?.username || "Pending",
        staffRole: "intern",
        createdAt: p.created_at, startedAt: p.started_at, endedAt: p.ended_at,
        status: p.is_flagged ? "flagged" : p.status,
        flagged: p.is_flagged, flagLevel: p.is_flagged ? 1 : 0,
        roomId: p.room_id, sessionMode: "chat",
        creditsCharged: 0,
        escalationHistory: null, escalationReason: p.escalation_note_encrypted ? "Escalation note present" : null,
        rescheduled: false, rescheduleReason: null, rescheduledFrom: null,
        silenceDuration: null, refunded: false, raw: p,
      });
    });

    blackboxSessions.forEach((b: any) => {
      items.push({
        id: b.id, type: "blackbox",
        studentName: "Anonymous",
        staffName: b.therapist?.username || "Unassigned",
        staffRole: "therapist",
        createdAt: b.created_at, startedAt: b.started_at, endedAt: b.ended_at,
        status: b.status, flagged: b.flag_level > 0, flagLevel: b.flag_level,
        roomId: b.room_id, sessionMode: "voice",
        creditsCharged: 0,
        escalationHistory: b.escalation_history,
        escalationReason: b.escalation_reason,
        rescheduled: false, rescheduleReason: null, rescheduledFrom: null,
        silenceDuration: b.silence_duration_sec, refunded: b.refunded, raw: b,
      });
    });

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [appointments, peerSessions, blackboxSessions]);

  // Filter
  const filtered = useMemo(() => {
    let result = allSessions;

    if (typeFilter !== "all") result = result.filter(s => s.type === typeFilter);

    if (statusFilter !== "all") {
      result = result.filter(s => {
        if (statusFilter === "escalated") return s.status === "escalated" || s.flagLevel >= 3;
        if (statusFilter === "flagged") return s.flagged;
        if (statusFilter === "active") return s.status === "active" || s.status === "accepted";
        return s.status === statusFilter;
      });
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const cutoff = dateFilter === "24h" ? subHours(now, 24) : dateFilter === "7d" ? subDays(now, 7) : subDays(now, 30);
      result = result.filter(s => new Date(s.createdAt) >= cutoff);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        s.staffName.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.type.includes(q) ||
        s.status.includes(q)
      );
    }

    return result;
  }, [allSessions, typeFilter, statusFilter, dateFilter, search]);

  // Stats
  const statsData = useMemo(() => {
    const active = allSessions.filter(s => s.status === "active" || s.status === "accepted").length;
    const flagged = allSessions.filter(s => s.flagged).length;
    const withDuration = allSessions.filter(s => s.startedAt && s.endedAt);
    const avgDuration = withDuration.length > 0
      ? Math.round(withDuration.reduce((sum, s) => sum + differenceInSeconds(new Date(s.endedAt!), new Date(s.startedAt!)), 0) / withDuration.length)
      : 0;
    return { total: allSessions.length, active, flagged, avgDuration };
  }, [allSessions]);

  const visible = filtered.slice(0, visibleCount);

  const typeButtons: { id: SessionType; label: string }[] = [
    { id: "all", label: "All" }, { id: "appointment", label: "Appointments" }, { id: "peer", label: "Peer" }, { id: "blackbox", label: "BlackBox" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{statsData.total}</span>
          <span className="text-[10px] text-muted-foreground">total</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium">{statsData.active}</span>
          <span className="text-[10px] text-muted-foreground">active</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs font-medium">{statsData.flagged}</span>
          <span className="text-[10px] text-muted-foreground">flagged</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{statsData.avgDuration > 0 ? formatDuration(statsData.avgDuration) : "—"}</span>
          <span className="text-[10px] text-muted-foreground">avg</span>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {typeButtons.map(t => (
          <button key={t.id} onClick={() => setTypeFilter(t.id)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              typeFilter === t.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search sessions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-card text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px] h-9 text-xs bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-[130px] h-9 text-xs bg-card"><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} results</span>
      </div>

      {/* Session list */}
      {visible.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border/50">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No sessions found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[650px] overflow-y-auto">
          {visible.map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}

      {filtered.length > visibleCount && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setVisibleCount(c => c + 50)}>
            Load more ({filtered.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}

function SessionRow({ session: s }: { session: UnifiedSession }) {
  const ModeIcon = MODE_ICONS[s.sessionMode] || Video;
  const duration = s.startedAt && s.endedAt
    ? formatDuration(Math.max(0, differenceInSeconds(new Date(s.endedAt), new Date(s.startedAt))))
    : null;

  return (
    <Collapsible>
      <div className={cn(
        "rounded-xl border transition-all",
        s.flagged ? "bg-destructive/5 border-destructive/20" : s.rescheduled ? "bg-amber-500/5 border-amber-500/20" : "bg-card border-border/50"
      )}>
        <CollapsibleTrigger className="w-full">
          <div className="p-3 flex items-center gap-3">
            {/* Type icon */}
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", TYPE_COLORS[s.type])}>
              {s.type === "appointment" ? <Calendar className="w-4 h-4" /> : s.type === "peer" ? <Users className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {s.studentName} → {s.staffName}
                </p>
                {s.flagLevel >= 3 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-destructive/10 text-destructive font-bold">L{s.flagLevel}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{format(new Date(s.createdAt), "MMM d, yyyy · h:mm a")}</span>
                {duration && <span className="text-[10px] text-muted-foreground">· {duration}</span>}
                {s.refunded && <span className="text-[10px] text-amber-500 font-medium">· Refunded</span>}
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              <ModeIcon className="w-3.5 h-3.5 text-muted-foreground" />
              {s.rescheduled && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-500 font-medium">⟳</span>}
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] capitalize", TYPE_COLORS[s.type])}>{s.type}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] capitalize", STATUS_COLORS[s.status] || "bg-muted text-muted-foreground")}>{s.status}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-3">
              {/* IDs */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Session ID</span>
                  <code className="text-[10px] font-mono truncate">{s.id.slice(0, 12)}…</code>
                  <CopyButton text={s.id} label="Session ID" />
                </div>
                {s.roomId && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Room ID</span>
                    <code className="text-[10px] font-mono truncate">{s.roomId.slice(0, 12)}…</code>
                    <CopyButton text={s.roomId} label="Room ID" />
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="grid grid-cols-3 gap-x-4 text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px]">Created</span>
                  <p className="font-medium">{format(new Date(s.createdAt), "MMM d, h:mm a")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Started</span>
                  <p className="font-medium">{s.startedAt ? format(new Date(s.startedAt), "MMM d, h:mm a") : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Ended</span>
                  <p className="font-medium">{s.endedAt ? format(new Date(s.endedAt), "MMM d, h:mm a") : "—"}</p>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Mode</span>
                  <span className="capitalize">{s.sessionMode}</span>
                </div>
                {s.creditsCharged > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Credits</span>
                    <span className="font-medium">{s.creditsCharged} ECC</span>
                  </div>
                )}
                {s.flagLevel > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Flag Level</span>
                    <span className={cn("font-bold", s.flagLevel >= 3 ? "text-destructive" : s.flagLevel >= 2 ? "text-amber-500" : "text-muted-foreground")}>
                      L{s.flagLevel}
                    </span>
                  </div>
                )}
                {s.silenceDuration !== null && s.silenceDuration > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 shrink-0">Silence</span>
                    <span>{formatDuration(s.silenceDuration)}</span>
                  </div>
                )}
              </div>

              {/* Reschedule info */}
              {s.rescheduled && (
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs space-y-1">
                  <p className="font-medium text-amber-500 text-[10px] uppercase tracking-wider">Rescheduled</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-medium">{s.rescheduledFrom ? format(new Date(s.rescheduledFrom), "MMM d, h:mm a") : "—"}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{s.startedAt ? format(new Date(s.startedAt), "MMM d, h:mm a") : "—"}</span>
                  </div>
                  {s.rescheduleReason && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">Reason:</span>
                      <span>{s.rescheduleReason}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Escalation history */}
              {s.escalationHistory && Array.isArray(s.escalationHistory) && s.escalationHistory.length > 0 && (
                <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/10 text-xs space-y-1.5">
                  <p className="font-medium text-destructive text-[10px] uppercase tracking-wider">Escalation History</p>
                  {s.escalationHistory.map((e: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">{e.timestamp ? format(new Date(e.timestamp), "h:mm a") : `#${i + 1}`}:</span>
                      <span>{e.reason || e.snippet || JSON.stringify(e)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Escalation reason (simple) */}
              {s.escalationReason && !s.escalationHistory?.length && (
                <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/10 text-xs">
                  <p className="font-medium text-destructive text-[10px] uppercase tracking-wider mb-1">Escalation</p>
                  <p>{s.escalationReason}</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
