import { useMemo } from "react";
import {
  Users, AlertTriangle, Coins, Activity, Eye, Zap, Building2, Crown,
  Stethoscope, GraduationCap, Shield, UserPlus, Calendar, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { AdminStats, InstitutionMember } from "@/hooks/useAdmin";

const ROLE_COLORS: Record<string, string> = {
  student: "hsl(var(--primary))",
  intern: "hsl(45 93% 47%)",
  expert: "hsl(142 71% 45%)",
  spoc: "hsl(var(--accent))",
  admin: "hsl(var(--destructive))",
  therapist: "hsl(200 80% 50%)",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(45 93% 47%)",
  confirmed: "hsl(200 80% 50%)",
  completed: "hsl(142 71% 45%)",
  cancelled: "hsl(var(--destructive))",
};

interface OverviewDashboardProps {
  stats: AdminStats;
  members: InstitutionMember[];
  flaggedEntries: any[];
  unifiedSessions: any[];
  onNavigateTab: (tab: string) => void;
}

export default function OverviewDashboard({
  stats, members, flaggedEntries, unifiedSessions, onNavigateTab,
}: OverviewDashboardProps) {
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => { counts[m.role] = (counts[m.role] || 0) + 1; });
    return counts;
  }, [members]);

  const roleChartData = useMemo(() =>
    Object.entries(roleCounts)
      .filter(([, v]) => v > 0)
      .map(([role, count]) => ({ name: role, value: count, fill: ROLE_COLORS[role] || "hsl(var(--muted))" })),
    [roleCounts]
  );

  const sessionTypeData = useMemo(() => [
    { name: "Appointments", value: stats.appointmentCount, fill: "hsl(var(--primary))" },
    { name: "Peer", value: stats.peerCount, fill: "hsl(var(--accent))" },
    { name: "BlackBox", value: stats.blackboxCount, fill: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0), [stats]);

  const statusBarData = useMemo(() =>
    Object.entries(stats.appointmentsByStatus).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      fill: STATUS_COLORS[status] || "hsl(var(--muted))",
    })),
    [stats.appointmentsByStatus]
  );

  const recentSessions = useMemo(() => unifiedSessions.slice(0, 8), [unifiedSessions]);

  const getSessionTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      appointment: "bg-primary/10 text-primary",
      peer: "bg-accent/10 text-accent",
      blackbox: "bg-destructive/10 text-destructive",
    };
    return map[type] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* ─── ROW 1: Hero KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Total Members"
          value={members.length}
          icon={Users}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          subtitle={`${roleCounts.student || 0} students`}
          trend={stats.recentSignups > 0 ? `+${stats.recentSignups} this week` : undefined}
          trendUp={stats.recentSignups > 0}
        />
        <KpiCard
          label="Total Sessions"
          value={stats.totalSessions}
          icon={Activity}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          subtitle={`${stats.appointmentCount} apt · ${stats.peerCount} peer · ${stats.blackboxCount} bb`}
        />
        <KpiCard
          label="Credits Earned"
          value={stats.totalCreditsEarned.toLocaleString()}
          icon={Coins}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
          subtitle={`${stats.totalCreditsSpent.toLocaleString()} spent`}
        />
        <KpiCard
          label="Active Today"
          value={stats.activeToday}
          icon={Zap}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          subtitle={`${stats.institutionCount} institutions`}
        />
        <KpiCard
          label="Escalations"
          value={stats.pendingEscalations}
          icon={AlertTriangle}
          iconBg={stats.pendingEscalations > 0 ? "bg-destructive/15" : "bg-muted/30"}
          iconColor={stats.pendingEscalations > 0 ? "text-destructive" : "text-muted-foreground"}
          subtitle={`${flaggedEntries.length} flagged entries`}
          pulse={stats.pendingEscalations > 0}
        />
      </div>

      {/* ─── ROW 2: Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Role Distribution */}
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <h3 className="text-sm font-semibold mb-3">Role Distribution</h3>
          {roleChartData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-[140px] h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roleChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} strokeWidth={2} stroke="hsl(var(--card))">
                      {roleChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {roleChartData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                      <span className="capitalize text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No data</p>
          )}
        </div>

        {/* Session Type Breakdown */}
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <h3 className="text-sm font-semibold mb-3">Session Type Breakdown</h3>
          {sessionTypeData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-[140px] h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sessionTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} strokeWidth={2} stroke="hsl(var(--card))">
                      {sessionTypeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {sessionTypeData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No sessions yet</p>
          )}
        </div>
      </div>

      {/* ─── ROW 3: Status + Credits + Health ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Appointment Status */}
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <h3 className="text-sm font-semibold mb-3">Appointment Status</h3>
          {statusBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={statusBarData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                  {statusBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No appointments</p>
          )}
        </div>

        {/* Credit Flow */}
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <h3 className="text-sm font-semibold mb-3">Credit Economy</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-lg font-bold">{stats.totalCreditsEarned.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total Earned / Granted</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <TrendingDown className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-lg font-bold">{stats.totalCreditsSpent.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total Spent</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${stats.totalCreditsEarned > 0 ? Math.min(100, ((stats.totalCreditsEarned - stats.totalCreditsSpent) / stats.totalCreditsEarned) * 100) : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Net: {(stats.totalCreditsEarned - stats.totalCreditsSpent).toLocaleString()} ECC remaining
            </p>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <h3 className="text-sm font-semibold mb-3">System Health</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <HealthIndicator label="Institutions" value={stats.institutionCount} icon={Building2} />
            <HealthIndicator label="Flagged" value={flaggedEntries.length} icon={AlertTriangle} alert={flaggedEntries.length > 0} />
            <HealthIndicator label="Escalations" value={stats.pendingEscalations} icon={Shield} alert={stats.pendingEscalations > 0} />
            <HealthIndicator label="Signups (7d)" value={stats.recentSignups} icon={UserPlus} />
          </div>
        </div>
      </div>

      {/* ─── ROW 4: Flagged + Recent Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Flagged Entries */}
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Flagged Entries ({flaggedEntries.length})
            </h3>
            {flaggedEntries.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onNavigateTab("escalations")}>
                View All
              </Button>
            )}
          </div>
          {flaggedEntries.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
              <p className="text-xs text-muted-foreground">No flagged entries — all clear</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {flaggedEntries.slice(0, 6).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30 gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${entry.ai_flag_level >= 3 ? "bg-destructive text-destructive-foreground" : "bg-amber-500/20 text-amber-500"}`}>
                      L{entry.ai_flag_level}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 h-6 text-[10px] px-2" onClick={() => onNavigateTab("escalations")}>
                    <Eye className="w-3 h-3" />Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="rounded-2xl bg-card border border-border/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Recent Sessions</h3>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onNavigateTab("sessions")}>
              View All
            </Button>
          </div>
          {recentSessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No sessions yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {recentSessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/20 border border-border/30">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${getSessionTypeBadge(s.type)}`}>
                    {s.type === "appointment" ? "APT" : s.type === "peer" ? "PEER" : "BB"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{s.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(s.date), "MMM d")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 5: Quick Actions ─── */}
      <div className="rounded-2xl bg-card border border-border/50 p-5">
        <h3 className="font-semibold text-sm mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Grant Credits", icon: Coins, tab: "roles", iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
            { label: "Add Member", icon: UserPlus, tab: "roles", iconBg: "bg-primary/10", iconColor: "text-primary" },
            { label: "View Sessions", icon: Calendar, tab: "sessions", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500" },
            { label: "Institutions", icon: Building2, tab: "spoc", iconBg: "bg-accent/10", iconColor: "text-accent" },
          ].map((a) => (
            <button key={a.label} className="p-4 rounded-xl bg-muted/20 border border-border/50 text-left hover:border-primary/30 hover:bg-muted/30 transition-all group" onClick={() => onNavigateTab(a.tab)}>
              <div className={`w-9 h-9 rounded-lg ${a.iconBg} flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform`}>
                <a.icon className={`w-4 h-4 ${a.iconColor}`} />
              </div>
              <p className="font-medium text-sm">{a.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, trend, trendUp, pulse }: {
  label: string; value: string | number; icon: any; iconBg: string; iconColor: string;
  subtitle?: string; trend?: string; trendUp?: boolean; pulse?: boolean;
}) {
  return (
    <div className="p-4 rounded-2xl bg-card border border-border/50 hover:border-border transition-colors relative overflow-hidden">
      {pulse && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-destructive animate-pulse" />}
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-2.5`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      {trend && (
        <p className={`text-[10px] mt-1 font-medium ${trendUp ? "text-emerald-500" : "text-destructive"}`}>
          {trend}
        </p>
      )}
    </div>
  );
}

function HealthIndicator({ label, value, icon: Icon, alert }: {
  label: string; value: number; icon: any; alert?: boolean;
}) {
  return (
    <div className={`p-3 rounded-xl border ${alert ? "bg-destructive/5 border-destructive/20" : "bg-muted/10 border-border/30"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold ${alert ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
