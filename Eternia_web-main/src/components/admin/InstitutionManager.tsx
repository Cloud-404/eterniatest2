import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Building2, Plus, Copy, Check, Loader2, Coins,
  Users, Download, UserPlus, Calendar, Eye, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AvatarUpload from "@/components/profile/AvatarUpload";

function generateEterniaCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${year}${rand}`;
}

interface Institution {
  id: string;
  name: string;
  eternia_code_hash: string;
  credits_pool: number;
  is_active: boolean;
  plan_type: string;
  institution_type: string;
  created_at: string;
  logo_url?: string | null;
}

interface InstitutionManagerProps {
  onSelectInstitution?: (inst: Institution) => void;
}

interface BulkMember {
  user_id: string;
  username: string;
  password: string;
}

const PLAN_STYLES: Record<string, { gradient: string; badge: string; dot: string }> = {
  enterprise: {
    gradient: "from-amber-500/80 via-amber-400/60 to-amber-500/30",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    dot: "bg-amber-400",
  },
  premium: {
    gradient: "from-violet-500/80 via-violet-400/60 to-violet-500/30",
    badge: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    dot: "bg-violet-400",
  },
  basic: {
    gradient: "from-primary/80 via-primary/60 to-primary/30",
    badge: "bg-primary/15 text-primary border-primary/25",
    dot: "bg-primary",
  },
};

const InstitutionManager = ({ onSelectInstitution }: InstitutionManagerProps = {}) => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlan, setNewPlan] = useState("basic");
  const [newType, setNewType] = useState("university");
  const [newCredits, setNewCredits] = useState("5000");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkInstitution, setBulkInstitution] = useState<Institution | null>(null);
  const [bulkCount, setBulkCount] = useState("50");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkRole, setBulkRole] = useState("student");
  const [bulkResults, setBulkResults] = useState<BulkMember[] | null>(null);

  const { data: institutions = [], isLoading } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, eternia_code_hash, plan_type, credits_pool, is_active, institution_type, created_at, logo_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Institution[];
    },
  });

  const { data: studentCounts = {} } = useQuery({
    queryKey: ["admin-inst-student-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("institution_id")
        .eq("role", "student");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.institution_id) counts[p.institution_id] = (counts[p.institution_id] || 0) + 1;
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const code = generateEterniaCode(newName);
      const { error } = await supabase.from("institutions").insert({
        name: newName.trim(),
        eternia_code_hash: code,
        credits_pool: parseInt(newCredits) || 5000,
        plan_type: newPlan,
        institution_type: newType,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      toast.success(`Institution created! Code: ${code}`);
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      setNewName("");
      setNewCredits("5000");
      setShowForm(false);
    },
    onError: () => toast.error("Failed to create institution"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("institutions").update({ is_active: !is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      toast.success("Institution updated");
    },
  });

  const deleteInstitutionMutation = useMutation({
    mutationFn: async (institutionId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-institution", {
        body: { institution_id: institutionId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Institution deleted. ${data.users_deleted} users removed${data.errors > 0 ? ` (${data.errors} errors)` : ""}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-inst-student-counts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (err: any) => toast.error(`Failed to delete institution: ${err.message}`),
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      if (!bulkInstitution) throw new Error("No institution selected");
      const { data, error } = await supabase.functions.invoke("bulk-add-members", {
        body: {
          institution_id: bulkInstitution.id,
          count: parseInt(bulkCount),
          prefix: bulkPrefix.trim() || undefined,
          role: bulkRole,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.created_count} IDs created successfully${data.error_count > 0 ? ` (${data.error_count} errors)` : ""}`);
      setBulkResults(data.members);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-inst-student-counts"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openBulkDialog = (inst: Institution) => {
    setBulkInstitution(inst);
    setBulkPrefix(inst.name.replace(/[^a-zA-Z]/g, "").toLowerCase().slice(0, 4));
    setBulkCount("50");
    setBulkRole("student");
    setBulkResults(null);
    setBulkDialogOpen(true);
  };

  const downloadCSV = () => {
    if (!bulkResults || !bulkInstitution) return;
    const header = "Username,Password,Institution,Code\n";
    const rows = bulkResults.map((m) =>
      `${m.username},${m.password},${bulkInstitution.name},${bulkInstitution.eternia_code_hash}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bulkInstitution.name.replace(/\s+/g, "_")}_ids_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPlanStyle = (plan: string) => PLAN_STYLES[plan] || PLAN_STYLES.basic;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2.5 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            Institutions
            <span className="ml-1 text-sm font-normal text-muted-foreground">({institutions.length})</span>
          </h2>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 h-9 text-sm" size="sm">
          <Plus className="w-4 h-4" />Add Institution
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="p-5 rounded-2xl bg-card border border-primary/20 space-y-4 shadow-sm">
          <p className="font-semibold text-base text-foreground">New Institution</p>
          <Input placeholder="Institution Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-10" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="university">University</option>
                <option value="school">School</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Plan</label>
              <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Credits</label>
              <Input type="number" value={newCredits} onChange={(e) => setNewCredits(e.target.value)} className="h-10" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending} className="gap-2 h-9" size="sm">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Create
            </Button>
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : institutions.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/50 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">No institutions yet</p>
          <p className="text-sm text-muted-foreground mb-5">Create your first institution to start generating Eternia codes.</p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />Add Your First Institution
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {institutions.map((inst) => {
            const style = getPlanStyle(inst.plan_type);
            return (
              <div
                key={inst.id}
                className={`group relative rounded-xl bg-card border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md hover:border-border overflow-hidden ${!inst.is_active ? "opacity-50" : ""} ${onSelectInstitution ? "cursor-pointer" : ""}`}
                onClick={() => onSelectInstitution?.(inst)}
              >
                {/* Left gradient accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b ${style.gradient}`} />

                <div className="pl-5 pr-5 py-4 md:py-5 md:pl-6 md:pr-6 space-y-3">
                  {/* Row 1: Name + Plan + Stats */}
                  <div className="flex flex-wrap items-center gap-3 md:gap-4">
                    {/* Logo + Name */}
                    <div className="flex items-center gap-3 shrink-0">
                      <AvatarUpload
                        size="sm"
                        institutionId={inst.id}
                        institutionLogoUrl={inst.logo_url}
                        onLogoUpdated={(url) => {
                          queryClient.setQueryData(["admin-institutions"], (old: Institution[] | undefined) =>
                            old?.map((i) => i.id === inst.id ? { ...i, logo_url: url } : i)
                          );
                        }}
                      />
                      <div>
                        <h3 className="text-base font-bold text-foreground leading-tight">{inst.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3 h-3 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground capitalize">{inst.institution_type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Plan Badge */}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border shrink-0 w-fit ${style.badge}`}>
                      {inst.plan_type}
                    </span>

                    {/* Stats */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">{studentCounts[inst.id] || 0}</span>
                        <span className="text-xs text-muted-foreground">Students</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">{inst.credits_pool.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">Credits</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(inst.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Code + Actions + Toggle */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/30">
                    {/* Eternia Code */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30">
                      <code className="text-xs font-mono font-bold tracking-wider text-foreground">{inst.eternia_code_hash}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); copyCode(inst.eternia_code_hash, inst.id); }}
                      >
                        {copiedId === inst.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </Button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 px-3"
                        onClick={(e) => { e.stopPropagation(); openBulkDialog(inst); }}
                      >
                        <UserPlus className="w-3.5 h-3.5" />Bulk IDs
                      </Button>
                      {onSelectInstitution && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5 px-3"
                          onClick={(e) => { e.stopPropagation(); onSelectInstitution(inst); }}
                        >
                          <Eye className="w-3.5 h-3.5" />Details
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs gap-1.5 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-3.5 h-3.5" />Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{inst.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the institution and all associated data including:
                              <br />• <strong>{studentCounts[inst.id] || 0} linked users</strong> (auth accounts, profiles, PII)
                              <br />• All temp credentials, student IDs, and stability pool data
                              <br /><br />
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteInstitutionMutation.mutate(inst.id)}
                              disabled={deleteInstitutionMutation.isPending}
                            >
                              {deleteInstitutionMutation.isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-1" />Deleting...</>
                              ) : (
                                "Delete Institution"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="flex-1" />

                    {/* Toggle */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-muted-foreground font-medium">{inst.is_active ? "Active" : "Inactive"}</span>
                      <Switch
                        checked={inst.is_active}
                        onCheckedChange={() => toggleMutation.mutate({ id: inst.id, is_active: inst.is_active })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk ID Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Bulk ID Allocation — {bulkInstitution?.name}
            </DialogTitle>
          </DialogHeader>

          {!bulkResults ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate student/member IDs in bulk. Each ID gets an auto-generated username and password.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Number of IDs *</label>
                  <Input type="number" value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} className="h-9" min={1} max={500} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Max 500 per batch</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
                  <Select value={bulkRole} onValueChange={setBulkRole}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Username Prefix</label>
                <Input value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} className="h-9" placeholder="e.g. demo" />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Preview: <code className="bg-muted px-1 rounded">{bulkPrefix || "inst"}_0001@eternia.local</code>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Eternia Code:</span>{" "}
                  <code className="bg-muted px-1 rounded font-mono">{bulkInstitution?.eternia_code_hash}</code>
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => bulkMutation.mutate()}
                  disabled={!bulkCount || parseInt(bulkCount) < 1 || bulkMutation.isPending}
                  className="gap-1.5"
                >
                  {bulkMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                  ) : (
                    <><UserPlus className="w-4 h-4" />Generate {bulkCount} IDs</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm font-medium text-emerald-500">✓ {bulkResults.length} IDs created successfully</p>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Username</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.map((m, i) => (
                      <tr key={m.user_id} className="border-t border-border/50">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-mono">{m.username}</td>
                        <td className="p-2 font-mono">{m.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={downloadCSV} className="gap-1.5">
                  <Download className="w-4 h-4" />Download CSV
                </Button>
                <Button onClick={() => { setBulkResults(null); setBulkDialogOpen(false); }}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstitutionManager;
