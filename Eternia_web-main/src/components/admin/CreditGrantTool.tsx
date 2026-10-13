import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Coins, Loader2, Search } from "lucide-react";

export default function CreditGrantTool() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("50");
  const [notes, setNotes] = useState("");

  const grantMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("grant-credits", {
        body: { username: username.trim(), amount: parseInt(amount), notes },
      });
      if (error) throw new Error(error.message || "Failed to grant credits");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.amount} ECC → ${data.username}`);
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setUsername("");
      setAmount("50");
      setNotes("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Coins className="w-4 h-4 text-primary" />
        Grant Credits
      </h3>
      <p className="text-xs text-muted-foreground">Grant ECC to a user by username.</p>

      <div className="grid grid-cols-1 gap-2.5">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Username *</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-9 pl-8" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Credits *</label>
            <Input type="number" placeholder="50" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" max="1000" className="h-9" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Note</label>
            <Input placeholder="Reason" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      <Button
        onClick={() => grantMutation.mutate()}
        disabled={!username.trim() || !amount || grantMutation.isPending}
        className="gap-1.5 h-8 text-xs w-full"
        size="sm"
      >
        {grantMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
        Grant
      </Button>
    </div>
  );
}
