import { useState } from "react";
import { AlertTriangle, PhoneOff, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TherapistSessionControlsProps {
  sessionId: string;
  silenceDurationSec: number;
  onSessionEnded: () => void;
  captureEscalationSnippet?: (windowMs?: number) => string;
}

const TherapistSessionControls = ({
  sessionId,
  silenceDurationSec,
  onSessionEnded,
  captureEscalationSnippet,
}: TherapistSessionControlsProps) => {
  const [isRefunding, setIsRefunding] = useState(false);
  const silenceMin = Math.floor(silenceDurationSec / 60);
  const showWarning = silenceDurationSec >= 120; // 2 min

  const handleEndAndRefund = async () => {
    setIsRefunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("refund-blackbox-session", {
        body: { session_id: sessionId, reason: "User unresponsive — therapist ended" },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Failed to refund session");
      } else {
        toast.success("Session ended and student refunded (30 ECC)");
        onSessionEnded();
      }
    } catch {
      toast.error("Failed to end session");
    }
    setIsRefunding(false);
  };

  if (!showWarning) return null;

  return (
    <div className="px-4 py-2 border-t border-border bg-card/50 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-xs text-muted-foreground">
          Student silent for {silenceMin}+ min
        </span>
        <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400 gap-1">
          <Clock className="w-3 h-3" />
          {silenceMin}m
        </Badge>
      </div>
      <Button
        size="sm"
        variant="destructive"
        className="text-xs gap-1.5 h-7"
        onClick={handleEndAndRefund}
        disabled={isRefunding}
      >
        {isRefunding ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : (
          <PhoneOff className="w-3 h-3" />
        )}
        End & Refund
      </Button>
    </div>
  );
};

export default TherapistSessionControls;
