import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const DeletionRequestsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["deletion-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("type", "deletion_request")
        .eq("is_read", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: async (notification: any) => {
      const targetUserId = notification.metadata?.requesting_user_id;
      if (!targetUserId) throw new Error("Missing user ID in request");

      // Call admin-delete-member edge function
      const { data, error } = await supabase.functions.invoke("admin-delete-member", {
        body: { target_user_id: targetUserId },
      });
      if (error) throw new Error(error.message || "Deletion failed");
      if (data?.error) throw new Error(data.error);

      // Mark all deletion_request notifications for this user as read
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("type", "deletion_request")
        .eq("is_read", false);
      if (updateError) console.error("Failed to mark notifications read:", updateError);
    },
    onSuccess: () => {
      toast.success("Account deleted and ID recycled successfully.");
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process deletion.");
      setProcessingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (notification: any) => {
      const targetUserId = notification.metadata?.requesting_user_id;

      // Mark notification as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);

      // Send rejection notification to user
      if (targetUserId) {
        await supabase.from("notifications").insert({
          user_id: targetUserId,
          type: "deletion_rejected",
          title: "Deletion Request Rejected",
          message: "Your account deletion request has been reviewed and rejected by an administrator. Please contact support for more information.",
        });
      }
    },
    onSuccess: () => {
      toast.success("Deletion request rejected.");
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject request.");
      setProcessingId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-destructive" />
        Deletion Requests
        {requests.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground">
            {requests.length}
          </span>
        )}
      </h3>

      {requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-border/50">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No pending deletion requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const meta = req.metadata as any;
            const isProcessing = processingId === req.id;
            return (
              <div key={req.id} className="p-4 rounded-xl bg-card border border-destructive/20 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium">{meta?.requesting_username || "Unknown User"}</p>
                    <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                      <span>ID: <strong className="font-mono">{meta?.student_id || "N/A"}</strong></span>
                      <span>Institution: <strong>{meta?.institution_name || "Independent"}</strong></span>
                      <span>{meta?.requested_at ? format(new Date(meta.requested_at), "MMM d, yyyy h:mm a") : "—"}</span>
                    </div>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1"
                    disabled={isProcessing}
                    onClick={() => {
                      setProcessingId(req.id);
                      approveMutation.mutate(req);
                    }}
                  >
                    {isProcessing && approveMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Approve & Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={isProcessing}
                    onClick={() => {
                      setProcessingId(req.id);
                      rejectMutation.mutate(req);
                    }}
                  >
                    {isProcessing && rejectMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeletionRequestsManager;
