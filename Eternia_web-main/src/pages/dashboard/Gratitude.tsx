import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useGratitude } from "@/hooks/useGratitude";
import { ArrowLeft, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const Gratitude = () => {
  const { entries, isLoading, todayEntry, addEntry, isAdding } = useGratitude();
  const [e1, setE1] = useState("");
  const [e2, setE2] = useState("");
  const [e3, setE3] = useState("");

  const handleSubmit = () => {
    if (!e1.trim() || !e2.trim() || !e3.trim()) return;
    addEntry(
      { entry_1: e1.trim(), entry_2: e2.trim(), entry_3: e3.trim() },
      { onSuccess: () => { setE1(""); setE2(""); setE3(""); } }
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5 pb-24">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/self-help" className="w-9 h-9 rounded-xl bg-card border border-border/50 flex items-center justify-center hover:border-primary/30 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-display">Gratitude</h1>
            <p className="text-sm text-muted-foreground">Daily gratitude practice</p>
          </div>
        </div>

        {todayEntry ? (
          <div className="rounded-2xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              <p className="text-sm font-semibold">Today's Gratitude</p>
            </div>
            {[todayEntry.entry_1, todayEntry.entry_2, todayEntry.entry_3].map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-primary font-bold text-sm mt-0.5">{i + 1}.</span>
                <p className="text-sm text-foreground/90">{e}</p>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground/60 mt-2">Come back tomorrow 🌅</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border/40 p-5 space-y-4">
            <p className="text-sm font-semibold text-center">What are 3 things you're grateful for today?</p>
            {[
              { value: e1, set: setE1, placeholder: "1. I'm grateful for..." },
              { value: e2, set: setE2, placeholder: "2. I'm grateful for..." },
              { value: e3, set: setE3, placeholder: "3. I'm grateful for..." },
            ].map((field, i) => (
              <Input
                key={i}
                placeholder={field.placeholder}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className="rounded-xl"
              />
            ))}
            <Button
              onClick={handleSubmit}
              disabled={!e1.trim() || !e2.trim() || !e3.trim() || isAdding}
              className="w-full rounded-xl"
            >
              {isAdding ? "Saving..." : "Save Gratitude 🙏"}
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Entries</p>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No gratitude entries yet 🙏</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-card border border-border/40 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground/60">
                  {new Date(entry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                {[entry.entry_1, entry.entry_2, entry.entry_3].map((e, i) => (
                  <p key={i} className="text-xs text-foreground/80">
                    <span className="text-primary font-medium">{i + 1}.</span> {e}
                  </p>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Gratitude;
