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

const MobileCredits = () => {
  const [filter, setFilter] = useState("all");
  const { balance, transactions, isLoadingTransactions } = useCredits();
  const { user, profile } = useAuth();
  const { purchaseCredits, isPurchasing, purchasingCredits, PACKAGES } = usePurchaseCredits();
  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);

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

  if (profile?.role && profile.role !== "student") {
    return (
      <DashboardLayout>
        <div className="text-center py-16 pb-24">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-bold font-display mb-1">Student Only</h1>
          <p className="text-sm text-muted-foreground">Credits are for student accounts.</p>
        </div>
      </DashboardLayout>
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthly = transactions.filter((t) => new Date(t.created_at) >= startOfMonth);
  const earned = monthly.filter((t) => t.delta > 0).reduce((s, t) => s + t.delta, 0);
  const spent = monthly.filter((t) => t.delta < 0).reduce((s, t) => s + Math.abs(t.delta), 0);

  const getIcon = (type: string) => {
    switch (type) { case "earn": return Award; case "spend": return Calendar; case "grant": return Gift; case "purchase": return CreditCard; default: return Coins; }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <div>
          <h1 className="text-xl font-bold font-display">Wallet</h1>
          <p className="text-sm text-muted-foreground">Manage your ECC wallet</p>
        </div>

        {balance < 5 && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-eternia-warning/10 border border-eternia-warning/20">
            <AlertCircle className="w-5 h-5 text-eternia-warning shrink-0" />
            <p className="text-sm text-eternia-warning font-medium">Your care energy is low. Refill gently.</p>
          </div>
        )}

        {/* Balance Card — soft pastel hero */}
        <div className="p-6 rounded-3xl surface-lavender shadow-soft">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-foreground/60 text-xs mb-1">Available Balance</p>
              <h2 className="text-4xl font-display font-semibold flex items-center gap-2"><Coins className="w-8 h-8 text-foreground/70" />{balance} <span className="text-lg text-foreground/70">ECC</span></h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-foreground/10">
            <div><p className="text-foreground/60 text-xs">Earned</p><p className="font-semibold text-sm flex items-center gap-1"><TrendingUp className="w-3 h-3" />+{earned}</p></div>
            <div><p className="text-foreground/60 text-xs">Spent</p><p className="font-semibold text-sm">-{spent}</p></div>
            <div>
              <p className="text-foreground/60 text-xs">Cap</p>
              <p className="font-semibold text-sm">{weeklyEarned}/5</p>
              <Progress value={(weeklyEarned / 5) * 100} className="h-1 mt-1 bg-foreground/10" />
            </div>
          </div>
        </div>

        {/* Bundle Packs */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5 text-primary" />Buy Credits</h3>
          <div className="grid grid-cols-2 gap-2">
            {PACKAGES.map((pkg) => (
              <div key={pkg.credits} className={`relative p-3 rounded-2xl border ${pkg.popular ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
                {pkg.popular && <span className="absolute -top-2 right-2 text-[9px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">POPULAR</span>}
                <p className="font-semibold text-sm">{pkg.credits} ECC</p>
                <p className="text-xs text-muted-foreground mb-2">{pkg.price}</p>
                <Button
                  size="sm"
                  variant={pkg.popular ? "default" : "outline"}
                  className="w-full h-7 text-xs"
                  onClick={() => purchaseCredits(pkg.credits)}
                  disabled={isPurchasing}
                >
                  {isPurchasing && purchasingCredits === pkg.credits ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buy"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* How to Get Credits */}
        <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
          <h3 className="font-semibold text-sm">How to Earn</h3>
          <div>
             <h4 className="text-xs font-medium flex items-center gap-1.5 mb-1"><Award className="w-3.5 h-3.5 text-primary" />Earn (5 ECC/week)</h4>
            <p className="text-xs text-muted-foreground">Quest Cards, Wreck Buddy, Tibetan Bowl, Sound Therapy</p>
          </div>
          <div>
            <h4 className="text-xs font-medium flex items-center gap-1.5 mb-1"><Gift className="w-3.5 h-3.5 text-primary" />Institution Grants</h4>
            <p className="text-xs text-muted-foreground">Ask your SPOC for a credit grant</p>
          </div>
        </div>

        {/* History */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">History</h3>
            <div className="flex gap-1">
              {["all", "earn", "spend", "grant"].map((f) => (
                <Button key={f} variant={filter === f ? "default" : "ghost"} size="sm" onClick={() => setFilter(f)} className={`text-xs h-8 px-2.5 ${filter === f ? "bg-primary text-primary-foreground" : ""}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          {isLoadingTransactions ? <div className="flex items-center justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            : filtered.length === 0 ? <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-border"><Coins className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No transactions</p></div>
            : (
              <div className="space-y-2">
                {filtered.map((tx) => {
                  const Icon = getIcon(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.delta > 0 ? "bg-eternia-success/10 text-eternia-success" : "bg-destructive/10 text-destructive"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{tx.notes || tx.type}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, h:mm a")}</p>
                        </div>
                      </div>
                      <span className={`font-semibold text-sm shrink-0 flex items-center gap-1 ${tx.delta > 0 ? "text-eternia-success" : "text-destructive"}`}>
                        {tx.delta > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}{tx.delta > 0 ? "+" : ""}{tx.delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Info */}
        <div className="p-4 rounded-2xl bg-muted/30 border border-border">
          <h4 className="font-medium text-sm mb-1">Credit Costs</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
             <li>• Expert: 50 ECC • Peer: 18 ECC • Sounds/Self-Help: Free</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MobileCredits;
