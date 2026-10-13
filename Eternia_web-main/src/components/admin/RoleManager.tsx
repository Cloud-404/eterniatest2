import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Loader2, Shield, Search, X } from "lucide-react";

const ASSIGNABLE_ROLES = [
  { value: "spoc", label: "SPOC" },
  { value: "expert", label: "Expert" },
  { value: "intern", label: "Intern" },
  { value: "therapist", label: "Therapist" },
] as const;

interface SelectedProfile {
  id: string;
  username: string;
  role: string;
}

export default function RoleManager() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<SelectedProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("spoc");
  const [institutionId, setInstitutionId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: profiles = [], isLoading: isSearching } = useQuery({
    queryKey: ["admin-profiles-search", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, username, role")
        .order("username")
        .limit(20);
      if (searchTerm.trim()) {
        query = query.ilike("username", `%${searchTerm.trim()}%`);
      }
      const { data } = await query;
      return (data || []) as SelectedProfile[];
    },
    enabled: searchTerm.length > 0,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProfile) throw new Error("Select a user first.");
      const isExpertOrIntern = selectedRole === "expert" || selectedRole === "intern";
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          role: selectedRole as any,
          ...(isExpertOrIntern ? { is_verified: true, is_active: true } : { is_active: true }),
          ...(institutionId ? { institution_id: institutionId } : {}),
        })
        .eq("id", selectedProfile.id);
      if (updateErr) throw updateErr;
      const { error: roleErr } = await supabase.from("user_roles").insert({
        user_id: selectedProfile.id,
        role: selectedRole as any,
      });
      if (roleErr && !roleErr.message.includes("duplicate")) {
        console.warn("user_roles insert warning:", roleErr.message);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_logs").insert({
          actor_id: user.id,
          action_type: "role_assigned",
          target_table: "profiles",
          target_id: selectedProfile.id,
          metadata: { new_role: selectedRole, username: selectedProfile.username },
        });
      }
      return selectedProfile.username;
    },
    onSuccess: (assignedUser) => {
      toast.success(`${assignedUser} → ${selectedRole}`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setSelectedProfile(null);
      setSearchTerm("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        Assign Role
      </h3>
      <p className="text-xs text-muted-foreground">
        Search and select existing users to assign SPOC, Expert, Intern, or Therapist roles.
      </p>

      <div className="grid grid-cols-1 gap-2.5">
        {/* Searchable user picker */}
        <div ref={dropdownRef} className="relative">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">User</label>
          {selectedProfile ? (
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
              <span className="flex-1 truncate">
                {selectedProfile.username}
                <span className="ml-1.5 text-[10px] text-muted-foreground">({selectedProfile.role})</span>
              </span>
              <button onClick={() => { setSelectedProfile(null); setSearchTerm(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search username…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                onFocus={() => searchTerm && setIsOpen(true)}
                className="h-9 pl-8"
              />
            </div>
          )}
          {isOpen && !selectedProfile && searchTerm.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
              {isSearching ? (
                <div className="p-3 text-xs text-muted-foreground text-center">Searching…</div>
              ) : profiles.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  No users found. Use "Add Member" to create one first.
                </div>
              ) : (
                profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProfile(p); setIsOpen(false); setSearchTerm(p.username); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between"
                  >
                    <span className="truncate">{p.username}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{p.role}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Role</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Institution ID</label>
            <Input placeholder="UUID (optional)" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} className="h-9 font-mono text-[10px]" />
          </div>
        </div>
      </div>

      <Button
        onClick={() => assignMutation.mutate()}
        disabled={!selectedProfile || assignMutation.isPending}
        className="gap-1.5 h-8 text-xs w-full"
        size="sm"
      >
        {assignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
        Assign Role
      </Button>
    </div>
  );
}
