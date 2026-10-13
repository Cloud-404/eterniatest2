import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Users, Calendar, CheckCircle, XCircle, Loader2, Clock, Shield,
} from "lucide-react";
import { format } from "date-fns";

export default function ExpertManager() {
  const queryClient = useQueryClient();

  const { data: experts = [], isLoading } = useQuery({
    queryKey: ["admin-experts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, specialty, is_active, is_verified, total_sessions, institution_id")
        .eq("role", "expert")
        .order("username");
      if (error) throw error;
      return data;
    },
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["admin-expert-availability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expert_availability")
        .select("*, expert:profiles!expert_availability_expert_id_fkey(username)")
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: !is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-experts"] }); toast.success("Updated"); },
    onError: () => toast.error("Failed"),
  });

  const toggleVerified = useMutation({
    mutationFn: async ({ id, is_verified }: { id: string; is_verified: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_verified: !is_verified }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-experts"] }); toast.success("Updated"); },
    onError: () => toast.error("Failed"),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Expert List */}
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          Experts ({experts.length})
        </h3>
        {experts.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-xs">
            No experts yet. Use the Roles tab to assign expert roles.
          </p>
        ) : (
          <div className="space-y-2">
            {experts.map((expert) => (
              <div key={expert.id} className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{expert.username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {expert.specialty || "General"} · {expert.total_sessions} sessions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1 text-[10px] h-7 px-2 ${expert.is_verified ? "text-primary border-primary/30" : ""}`}
                    onClick={() => toggleVerified.mutate({ id: expert.id, is_verified: expert.is_verified })}
                  >
                    <Shield className="w-3 h-3" />
                    {expert.is_verified ? "Verified" : "Unverified"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1 text-[10px] h-7 px-2 ${expert.is_active ? "text-emerald-500 border-emerald-500/30" : "text-destructive border-destructive/30"}`}
                    onClick={() => toggleActive.mutate({ id: expert.id, is_active: expert.is_active })}
                  >
                    {expert.is_active ? <><CheckCircle className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          Upcoming Availability
        </h3>
        {availability.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-xs">No upcoming slots.</p>
        ) : (
          <div className="space-y-1.5">
            {availability.map((slot: any) => (
              <div key={slot.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{slot.expert?.username || "Expert"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(slot.start_time), "MMM d, h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}
                    </p>
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                  slot.is_booked ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
                }`}>
                  {slot.is_booked ? "Booked" : "Open"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
