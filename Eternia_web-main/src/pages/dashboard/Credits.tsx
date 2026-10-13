import { useIsMobile } from "@/hooks/use-mobile";
import MobileCredits from "@/components/mobile/MobileCredits";

import { useState } from "react";
import { Coins, ArrowUpRight, ArrowDownRight, Calendar, CreditCard, Gift, Award, TrendingUp, Loader2, AlertCircle, ShieldAlert, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { usePurchaseCredits } from "@/hooks/usePurchaseCredits";

const Credits = () => {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  const { balance, transactions, isLoadingTransactions } = useCredits();
  const { user, profile } = useAuth();
  const { purchaseCredits, isPurchasing, purchasingCredits, PACKAGES } = usePurchaseCredits();

  const { data: weeklyEarned = 0 } = useQuery({
    queryKey: ["weekly-earn-total", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.rpc("get_weekly_earn_total", { _user_id: user.id });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!user,
  });

  if (isMobile) return <MobileCredits />;

  // Only students can access credits
  if (profile?.role && profile.role !== "student") {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-16">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-display mb-2">Credits — Student Only</h1>
          <p className="text-muted-foreground">The ECC credit system is available for student accounts only.</p>
        </div>
      </DashboardLayout>
    );
  }

  const filteredTransactions = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);
  const getIcon = (type: string) => { switch (type) { case "earn": return Award; case "spend": return Calendar; case "grant": return Gift; case "purchase": return CreditCard; default: return Coins; } };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyTransactions = transactions.filter((t) => new Date(t.created_at) >= startOfMonth);
  const earnedThisMonth = monthlyTransactions.filter((t) => t.delta > 0).reduce((sum, t) => sum + t.delta, 0);
  const spentThisMonth = monthlyTransactions.filter((t) => t.delta < 0).reduce((sum, t) => sum + Math.abs(t.delta), 0);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div><h1 className="text-3xl font-bold font-display mb-1">Care Credits</h1><p className="text-sm text-muted-foreground">Manage your Eternia Care Credits (ECC)</p></div>

        {balance < 5 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-eternia-warning/10 border border-eternia-warning/20">
            <AlertCircle className="w-5 h-5 text-eternia-warning shrink-0" /><div><p className="font-medium text-sm text-eternia-warning">Your care energy is low</p><p className="text-xs text-muted-foreground">Earn credits through self-help activities</p></div>
          </div>
        )}

        <div className="p-6 rounded-2xl bg-gradient-eternia text-background">
          <div className="flex items-start justify-between mb-6">
            <div><p className="text-background/70 text-sm mb-1">Available Balance</p><h2 className="text-4xl font-bold font-display flex items-center gap-2"><Coins className="w-10 h-10" />{balance} <span className="text-2xl">ECC</span></h2></div>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-background/20">
            <div><p className="text-background/70 text-sm">Earned</p><p className="font-semibold text-lg flex items-center gap-1"><TrendingUp className="w-4 h-4" />+{earnedThisMonth}</p></div>
            <div><p className="text-background/70 text-sm">Spent</p><p className="font-semibold text-lg">-{spentThisMonth}</p></div>
            <div>
              <p className="text-background/70 text-sm">Weekly Cap</p>
              <p className="font-semibold text-lg">{weeklyEarned}/5</p>
              <Progress value={(weeklyEarned / 5) * 100} className="h-1.5 mt-1 bg-background/20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold font-display text-base">History</h3>
              <div className="flex gap-1">
                {["all", "earn", "spend", "grant", "purchase"].map((f) => (
                  <Button key={f} variant={filter === f ? "default" : "ghost"} size="sm" onClick={() => setFilter(f)} className={`text-xs h-7 px-2 ${filter === f ? "bg-primary text-primary-foreground" : ""}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</Button>
                ))}
              </div>
            </div>
            {isLoadingTransactions ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              : filteredTransactions.length === 0 ? <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border"><Coins className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No transactions</p></div>
              : <div className="space-y-2">{filteredTransactions.map((tx) => {
                const Icon = getIcon(tx.type);
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.delta > 0 ? "bg-eternia-success/10 text-eternia-success" : "bg-destructive/10 text-destructive"}`}><Icon className="w-5 h-5" /></div>
                      <div className="min-w-0"><p className="font-medium text-sm truncate">{tx.notes || tx.type}</p><p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, h:mm a")}</p></div>
                    </div>
                    <div className={`font-semibold text-sm flex items-center gap-0.5 shrink-0 ${tx.delta > 0 ? "text-eternia-success" : "text-destructive"}`}>{tx.delta > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{tx.delta > 0 ? "+" : ""}{tx.delta}</div>
                  </div>
                );
              })}</div>}
          </div>
          <div className="space-y-4">
            {/* Bundle Packs */}
            <h3 className="font-semibold font-display text-base flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-primary" />Buy Credits</h3>
            <div className="space-y-2">
              {PACKAGES.map((pkg) => (
                <div key={pkg.credits} className={`relative p-4 rounded-xl border transition-colors ${pkg.popular ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-primary/20"}`}>
                  {pkg.popular && <span className="absolute -top-2.5 right-3 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">POPULAR</span>}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{pkg.credits} ECC</p>
                      <p className="text-xs text-muted-foreground">{pkg.price}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={pkg.popular ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => purchaseCredits(pkg.credits)}
                      disabled={isPurchasing}
                    >
                      {isPurchasing && purchasingCredits === pkg.credits ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buy"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* How to earn */}
            <h3 className="font-semibold font-display text-base">How to Earn</h3>
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1.5 flex items-center gap-2"><Award className="w-4 h-4 text-primary" />Earn (5 ECC/week max)</h4>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">• Complete Quest Cards</li>
                  <li className="flex items-center gap-2">• Wreck the Buddy exercise</li>
                  <li className="flex items-center gap-2">• Tibetan Bowl breathing</li>
                  <li className="flex items-center gap-2">• Listen to Sound Therapy</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1.5 flex items-center gap-2"><Gift className="w-4 h-4 text-primary" />Institution Grants</h4>
                <p className="text-sm text-muted-foreground">Your SPOC can allocate bulk credits to all students at the start of each term.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Credits;
