import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useMoodTracker } from "@/hooks/useMoodTracker";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const moods = [
  { value: 1, emoji: "😢", label: "Awful",   surface: "surface-pink"     },
  { value: 2, emoji: "😕", label: "Bad",     surface: "surface-peach"    },
  { value: 3, emoji: "😐", label: "Okay",    surface: "surface-butter"   },
  { value: 4, emoji: "🙂", label: "Good",    surface: "surface-mint"     },
  { value: 5, emoji: "😁", label: "Great",   surface: "surface-sky"      },
];

const MoodTracker = () => {
  const { entries, isLoading, todayEntry, logMood, isLogging, last7Days } = useMoodTracker();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    if (!selectedMood) return;
    logMood(
      { mood: selectedMood, note: note.trim() },
      { onSuccess: () => { setSelectedMood(null); setNote(""); } }
    );
  };

  // Frequency map for bubble chart + bar chart over last 7 days
  const moodCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    last7Days.forEach((e) => { counts[e.mood] = (counts[e.mood] || 0) + 1; });
    return counts;
  }, [last7Days]);

  const maxCount = Math.max(1, ...Object.values(moodCounts));

  // Bubble layout — sized circles arranged in a soft cluster
  const bubbles = moods.map((m, i) => {
    const count = moodCounts[m.value] || 0;
    const size = 48 + count * 22;
    const positions = [
      { top: "10%", left: "15%" },
      { top: "55%", left: "8%" },
      { top: "20%", left: "55%" },
      { top: "60%", left: "55%" },
      { top: "5%",  left: "75%" },
    ];
    return { ...m, count, size, pos: positions[i] };
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/dashboard/self-help" className="w-10 h-10 rounded-full bg-card border border-border/50 flex items-center justify-center hover:border-primary/30 transition-all shadow-soft">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-semibold">Mood Tracker</h1>
            <p className="text-sm text-muted-foreground">Track your emotional patterns</p>
          </div>
        </div>

        {/* Today's check-in */}
        {todayEntry ? (
          <div className="card-soft p-6 text-center surface-cream">
            <p className="text-5xl mb-2">{moods.find((m) => m.value === todayEntry.mood)?.emoji}</p>
            <p className="text-base font-display font-semibold">Today you feel: {moods.find((m) => m.value === todayEntry.mood)?.label}</p>
            {todayEntry.note && <p className="text-sm text-muted-foreground mt-1 italic">"{todayEntry.note}"</p>}
            <p className="text-[11px] text-muted-foreground/70 mt-3">Come back tomorrow for another check-in</p>
          </div>
        ) : (
          <div className="card-soft p-5 space-y-4">
            <p className="text-sm font-display font-semibold text-center">How are you feeling right now?</p>
            <div className="flex justify-center gap-2.5">
              {moods.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedMood(m.value)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${
                    selectedMood === m.value ? "scale-110" : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <span className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${m.surface} ${selectedMood === m.value ? "ring-2 ring-accent shadow-soft-lg" : "shadow-soft"}`}>
                    {m.emoji}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Add a note (optional)…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-2xl resize-none border-border/60"
            />
            <Button onClick={handleSubmit} disabled={!selectedMood || isLogging} className="w-full rounded-full">
              {isLogging ? "Saving…" : "Log Mood"}
            </Button>
          </div>
        )}

        {/* 7 Days Mood Reflection — bubble cluster */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">7 Days Mood Reflection</h2>
            <span className="pill">{last7Days.length} entries</span>
          </div>
          <div className="card-soft p-5 surface-cream">
            {isLoading ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : last7Days.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Log your mood to see your reflection bubble.</p>
            ) : (
              <div className="relative h-64 w-full">
                {bubbles.map((b) => (
                  <div
                    key={b.value}
                    className={`absolute rounded-full ${b.surface} flex flex-col items-center justify-center shadow-soft transition-all`}
                    style={{
                      width: b.size,
                      height: b.size,
                      top: b.pos.top,
                      left: b.pos.left,
                      opacity: b.count === 0 ? 0.4 : 1,
                    }}
                  >
                    <span className="text-2xl">{b.emoji}</span>
                    {b.count > 0 && (
                      <span className="text-[10px] font-semibold text-foreground/70 mt-0.5">×{b.count}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Take charge / Help with AI */}
        <div className="rounded-3xl p-5 shadow-soft-lg text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(var(--eternia-teal)), hsl(var(--eternia-lavender)))" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-display font-semibold leading-tight">Take charge of your mind</h3>
              <p className="text-sm text-primary-foreground/85 mt-1">Get gentle, personalised guidance based on your week.</p>
            </div>
            <Sparkles className="w-6 h-6 shrink-0" />
          </div>
          <Link to="/dashboard/blackbox" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-card text-foreground text-sm font-semibold shadow-soft active:scale-95 transition">
            Help with AI →
          </Link>
        </div>

        {/* Your Statistic — bar chart */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-display font-semibold">Your Statistic</h2>
            <span className="pill">Last 7 days</span>
          </div>
          <div className="card-soft p-5">
            <div className="flex items-end justify-between gap-3 h-44">
              {moods.map((m) => {
                const count = moodCounts[m.value] || 0;
                const heightPct = (count / maxCount) * 100;
                return (
                  <div key={m.value} className="flex-1 flex flex-col items-center gap-2">
                    <div className="flex-1 w-full flex items-end justify-center">
                      <div
                        className={`w-full rounded-t-2xl ${m.surface} transition-all shadow-soft relative`}
                        style={{ height: `${Math.max(heightPct, 6)}%` }}
                      >
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl">{m.emoji}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* History list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</p>
          {entries.slice(0, 14).map((entry) => {
            const m = moods.find((mo) => mo.value === entry.mood);
            return (
              <div key={entry.id} className="rounded-2xl bg-card border border-border/40 p-3 flex items-center gap-3 shadow-soft">
                <span className={`w-10 h-10 rounded-full ${m?.surface} flex items-center justify-center text-lg`}>{m?.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{m?.label}</p>
                  {entry.note && <p className="text-xs text-muted-foreground truncate">{entry.note}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {new Date(entry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MoodTracker;
