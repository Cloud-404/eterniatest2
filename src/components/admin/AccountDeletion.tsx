import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Loader2, CheckCircle } from "lucide-react";

const AccountDeletion = () => {
  const { user } = useAuth();
  const [requested, setRequested] = useState(false);

  const requestDeletionMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("request-account-deletion");
      if (error) throw new Error(error.message || "Failed to send request");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setRequested(true);
      toast.success("Deletion request sent to administrators.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to send request."),
  });

  return (
    <div className="p-3 rounded-xl bg-card border border-destructive/20 space-y-3">
      <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
        <Trash2 className="w-4 h-4" />
        Delete Account (DPDP)
      </h3>
      <p className="text-xs text-muted-foreground">
        Under DPDP Act 2023, you can request deletion of your personal data. An administrator will review and process your request.
      </p>
      <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
        <li>Emergency contacts & student ID removed</li>
        <li>BlackBox entries permanently deleted</li>
        <li>Recovery credentials destroyed</li>
        <li>Profile deactivated & anonymized</li>
        <li>Eternia ID recycled back to institution pool</li>
      </ul>

      {requested ? (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your deletion request has been sent to the administrators. They will review and process it.
          </p>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive h-8 text-xs gap-1.5"
          onClick={() => requestDeletionMutation.mutate()}
          disabled={requestDeletionMutation.isPending}
        >
          {requestDeletionMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Request Account Deletion
        </Button>
      )}
    </div>
  );
};

export default AccountDeletion;
