import { useEffect, useCallback } from "react";
import { Award, Coins, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEccEarn } from "@/hooks/useEccEarn";

const TibetanBowl = () => {
  const { weeklyEarned, weeklyCap, canEarn, remainingThisWeek, earnFromActivity, isEarning } = useEccEarn();

  const handleComplete = useCallback(() => {
    if (!canEarn) return;
    earnFromActivity({ amount: 1, activity: "Tibetan Bowl breathing session" });
  }, [canEarn, earnFromActivity]);

  // Listen for postMessage from the iframe game
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "tibetan-bowl-complete") {
        handleComplete();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleComplete]);

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-24">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Tibetan Singing Bowl</h1>
            <p className="text-sm text-muted-foreground">4-7-8 breathing with singing bowls 🔔</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/30 border border-border">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">{weeklyEarned}/{weeklyCap} ECC this week</span>
            <Progress value={(weeklyEarned / weeklyCap) * 100} className="h-1 w-12 bg-muted" />
          </div>
        </div>

        <div className="w-full h-full min-h-[60vh] rounded-2xl overflow-hidden border border-border/50">
          <iframe
            src="/games/tibetan-bowl.html"
            title="Tibetan Singing Bowl – Sound Meditation"
            className="w-full h-full border-0"
            style={{ minHeight: "60vh" }}
            allow="autoplay"
          />
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={handleComplete}
            disabled={!canEarn || isEarning}
            className="gap-2"
          >
            {isEarning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            {canEarn ? `Claim 1 ECC (${remainingThisWeek} left this week)` : "Weekly cap reached"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TibetanBowl;
