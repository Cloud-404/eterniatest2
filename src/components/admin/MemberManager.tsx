import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserPlus, Loader2, Eye, EyeOff, AlertCircle, Users, Building2, ChevronDown, ChevronRight, Plus, Download, Key, CheckCircle, Clock, QrCode, ShieldCheck, Gift, Copy, Trash2 } from "lucide-react";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "intern", label: "Intern" },
  { value: "expert", label: "Expert" },
  { value: "spoc", label: "SPOC" },
  { value: "therapist", label: "Therapist" },
] as const;

export default function MemberManager() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("intern");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [expandedInstitution, setExpandedInstitution] = useState<string | null>(null);
  // Bulk temp ID creation state
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkInstitution, setBulkInstitution] = useState("");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkResults, setBulkResults] = useState<{ username: string; password: string }[] | null>(null);
  // Temp credentials view
  const [viewCredInstitution, setViewCredInstitution] = useState("");

  const { data: institutions = [] } = useQuery({
    queryKey: ["admin-institutions-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ["admin-all-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, role, institution_id, is_active, is_verified, training_status, student_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch temp credentials for selected institution
  const { data: tempCredentials = [], isLoading: tempCredsLoading } = useQuery({
    queryKey: ["admin-temp-credentials", viewCredInstitution],
    queryFn: async () => {
      if (!viewCredInstitution) return [];
      const { data, error } = await supabase
        .from("temp_credentials")
        .select("id, temp_username, status, assigned_at, activated_at, created_at")
        .eq("institution_id", viewCredInstitution)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!viewCredInstitution,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("add-member", {
        body: {
          username: username.trim(),
          password,
          role: selectedRole,
          institution_id: selectedRole === "spoc" && selectedInstitution && selectedInstitution !== "none" ? selectedInstitution : null,
        },
      });
      if (error) {
        let msg = "Failed to create member";
        try {
          const json = await (error as any).context?.json();
          if (json?.error) msg = json.error;
        } catch {
          if (error.message) msg = error.message;
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`"${data.username}" created as ${selectedRole}`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-members"] });
      setUsername("");
      setPassword("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Bulk create temp IDs mutation
  const bulkMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-bulk-temp-ids", {
        body: {
          institution_id: bulkInstitution,
          count: parseInt(bulkCount),
          prefix: bulkPrefix || undefined,
        },
      });
      if (error) throw new Error(error.message || "Failed to bulk create");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.created_count} temp IDs created`);
      queryClient.invalidateQueries({ queryKey: ["admin-temp-credentials"] });
      setBulkResults(data.members);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const downloadBulkCSV = () => {
    if (!bulkResults) return;
    const csv = "Temp_Username,Temp_Password\n" + bulkResults.map((m: any) => `${m.username},${m.password}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "temp-credentials.csv";
    a.click();
    toast.success("Credentials CSV downloaded");
  };

  const getRoleDesc = (role: string) => {
    const map: Record<string, string> = {
      student: "Institution-specific — Self-help tools, peer sessions, quests",
      intern: "Universal — Peer sessions, escalation flagging",
      expert: "Universal — Appointments, session notes",
      spoc: "Institution-specific — QR onboarding, credits, analytics",
      therapist: "Universal — BlackBox queue, escalation, session notes",
    };
    return map[role] || "";
  };

  // Group members by institution
  const institutionMap = new Map<string, string>();
  institutions.forEach((inst) => institutionMap.set(inst.id, inst.name));

  const grouped: Record<string, typeof allMembers> = {};
  allMembers.forEach((m) => {
    const key = m.institution_id || "independent";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === "independent") return 1;
    if (b === "independent") return -1;
    return (institutionMap.get(a) || "").localeCompare(institutionMap.get(b) || "");
  });

  // Temp credential stats
  const unusedCount = tempCredentials.filter(c => c.status === "unused").length;
  const assignedCount = tempCredentials.filter(c => c.status === "assigned").length;
  const activatedCount = tempCredentials.filter(c => c.status === "activated").length;

  return (
    <div className="space-y-4">
      {/* Add Staff Member Form */}
      <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          Add Staff Member
        </h3>
        <p className="text-xs text-muted-foreground">
          Create a new staff account. Students are onboarded via Bulk Temp IDs + SPOC QR.
        </p>

        <div className="grid grid-cols-1 gap-2.5">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Username *</label>
            <Input placeholder="e.g. dr_sharma" value={username} onChange={(e) => setUsername(e.target.value)} className="h-9" />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Login: <code className="bg-muted px-1 rounded">{username.toLowerCase().replace(/\s+/g, '_') || 'username'}</code>
            </p>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Password *</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Min 6 chars"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 pr-9"
              />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9"
                onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Role *</label>
            <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); if (v !== "spoc") setSelectedInstitution(""); }}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedRole === "spoc" && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Institution *
              </label>
              <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select institution" /></SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground capitalize">{selectedRole}:</span> {getRoleDesc(selectedRole)}
          </p>
        </div>

        <Button
          onClick={() => addMutation.mutate()}
          disabled={!username.trim() || !password || password.length < 6 || (selectedRole === "spoc" && !selectedInstitution) || addMutation.isPending}
          className="gap-1.5 h-8 text-xs w-full"
          size="sm"
        >
          {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Create Member
        </Button>
      </div>

      {/* Bulk Temp ID Creation */}
      <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          Bulk Temp ID Creation
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate temporary credential pools for student onboarding. SPOCs will use these to create QR codes for individual students.
        </p>

        {!showBulkDialog ? (
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowBulkDialog(true)}>
            <Plus className="w-3.5 h-3.5" />
            Create Temp IDs
          </Button>
        ) : bulkResults ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-primary">{bulkResults.length} temp IDs created!</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Download credentials CSV before closing. SPOCs can now use these for QR onboarding.</p>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {bulkResults.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 bg-muted/30 rounded">
                  <span className="font-mono">{m.username}</span>
                  <span className="font-mono text-muted-foreground">{m.password}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 h-8 text-xs flex-1" onClick={downloadBulkCSV}>
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setBulkResults(null); setShowBulkDialog(false); }}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Institution *</label>
              <Select value={bulkInstitution} onValueChange={setBulkInstitution}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select institution" /></SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Count (1-500)</label>
                <Input type="number" value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} className="h-9" min="1" max="500" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Prefix (optional)</label>
                <Input placeholder="e.g. mit" value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1.5 h-8 text-xs flex-1"
                onClick={() => bulkMutation.mutate()}
                disabled={!bulkInstitution || bulkMutation.isPending}
              >
                {bulkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                Create {bulkCount} Temp IDs
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowBulkDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Temp Credential Pool View */}
      <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" />
          Temp Credential Pool
        </h3>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Select Institution</label>
          <Select value={viewCredInstitution} onValueChange={setViewCredInstitution}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select institution" /></SelectTrigger>
            <SelectContent>
              {institutions.map((inst) => <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {viewCredInstitution && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold text-primary">{unusedCount}</p>
                <p className="text-[10px] text-muted-foreground">Unused</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold text-eternia-warning">{assignedCount}</p>
                <p className="text-[10px] text-muted-foreground">Assigned</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold text-eternia-success">{activatedCount}</p>
                <p className="text-[10px] text-muted-foreground">Activated</p>
              </div>
            </div>

            {tempCredsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : tempCredentials.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No temp credentials created yet for this institution.</p>
            ) : (
              <div className="max-h-[250px] overflow-y-auto space-y-1">
                {tempCredentials.slice(0, 100).map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-muted/30 rounded">
                    <span className="font-mono truncate">{cred.temp_username}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 ${
                      cred.status === "unused" ? "bg-primary/10 text-primary" :
                      cred.status === "assigned" ? "bg-eternia-warning/10 text-eternia-warning" :
                      "bg-eternia-success/10 text-eternia-success"
                    }`}>
                      {cred.status === "unused" && <Clock className="w-2.5 h-2.5" />}
                      {cred.status === "assigned" && <QrCode className="w-2.5 h-2.5" />}
                      {cred.status === "activated" && <CheckCircle className="w-2.5 h-2.5" />}
                      {cred.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Members grouped by institution */}
      <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Members by University
        </h3>

        {membersLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No members yet</p>
        ) : (
          <div className="space-y-2">
            {sortedGroups.map(([instId, members]) => {
              const instName = instId === "independent" ? "Independent (No Institution)" : institutionMap.get(instId) || "Unknown";
              const isExpanded = expandedInstitution === instId;

              return (
                <div key={instId} className="rounded-lg border border-border/50 overflow-hidden">
                  <button
                    onClick={() => setExpandedInstitution(isExpanded ? null : instId)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium">{instName}</span>
                      <span className="text-[10px] text-muted-foreground">({members.length})</span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-3 py-2 text-xs border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{m.username}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary capitalize">{m.role}</span>
                            {!m.is_active && <span className="px-1.5 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive">Inactive</span>}
                            {m.is_verified ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-eternia-success/10 text-eternia-success flex items-center gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5" />Verified
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-eternia-warning/10 text-eternia-warning flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {!m.is_verified && (
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2 gap-0.5 bg-eternia-success hover:bg-eternia-success/90"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const updateData: { is_verified: boolean; training_status?: string } = { is_verified: true };
                                  if (m.role === "intern" && m.training_status === "interview_pending") {
                                    updateData.training_status = "active";
                                  }
                                  const { error } = await supabase
                                    .from("profiles")
                                    .update(updateData)
                                    .eq("id", m.id);
                                  if (error) { toast.error("Failed to verify"); return; }
                                  toast.success(`${m.username} verified`);
                                  queryClient.invalidateQueries({ queryKey: ["admin-all-members"] });
                                }}
                              >
                                <ShieldCheck className="w-2.5 h-2.5" />Verify
                              </Button>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {m.student_id || "—"}
                            </span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete member "{m.username}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this user's account, PII, and auth credentials. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => {
                                      try {
                                        const { data, error } = await supabase.functions.invoke("admin-delete-member", {
                                          body: { target_user_id: m.id },
                                        });
                                        if (error) throw error;
                                        if (data?.error) throw new Error(data.error);
                                        toast.success(`"${m.username}" deleted`);
                                        queryClient.invalidateQueries({ queryKey: ["admin-all-members"] });
                                      } catch (err: any) {
                                        toast.error(err.message || "Failed to delete member");
                                      }
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "REF-";
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function ReferralCodesCard() {
  const queryClient = useQueryClient();

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["admin-referral-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intern_referral_codes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const code = generateCode();
      const { error } = await supabase.from("intern_referral_codes").insert({
        code,
        created_by: user.id,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      toast.success(`Referral code created: ${code}`);
      navigator.clipboard.writeText(code);
      queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Gift className="w-4 h-4 text-primary" />
        Referral Codes
      </h3>
      <p className="text-xs text-muted-foreground">
        Generate a code to let an intern skip training.
      </p>
      <Button
        size="sm"
        className="gap-1.5 h-8 text-xs w-full"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Generate Code
      </Button>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : codes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">No referral codes yet.</p>
      ) : (
        <div className="max-h-[250px] overflow-y-auto space-y-1">
          {codes.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{c.code}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${c.is_used ? "bg-eternia-success/10 text-eternia-success" : "bg-primary/10 text-primary"}`}>
                  {c.is_used ? "Used" : "Unused"}
                </span>
              </div>
              {!c.is_used && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
