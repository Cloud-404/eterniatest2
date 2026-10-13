import DashboardLayout from "@/components/layout/DashboardLayout";
import { useQuests } from "@/hooks/useQuests";
import { Award, ArrowLeft, AlertCircle, Loader2, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useCallback } from "react";

const SUIT_ICONS = ["♠", "♥", "♦", "♣", "★", "♠"];
const CARD_COLORS = [
  "from-primary to-accent",
  "from-accent to-primary",
  "from-primary to-secondary",
  "from-secondary to-primary",
  "from-accent to-secondary",
  "from-secondary to-accent",
];

const QuestCards = () => {
  const { quests, completions, isLoading, error, completeQuest, isCompleting, completedToday, totalXpToday } = useQuests();
  const completedIds = completions.map((c) => c.quest_id);

  const dealtCards = useMemo(() => {
    if (quests.length === 0) return [];
    const today = new Date().toISOString().split("T")[0];
    const seed = today.split("").reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 1), 0);
    const hashId = (id: string) => {
      let h = seed;
      for (let i = 0; i < id.length; i++) {
        h = ((h << 5) - h + id.charCodeAt(i)) | 0;
      }
      return h;
    };
    return [...quests].sort((a, b) => hashId(a.id) - hashId(b.id)).slice(0, 6);
  }, [quests]);

  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const handleFlip = useCallback((questId: string) => {
    if (completedIds.includes(questId)) return;
    if (flippedId === questId) {
      setFlippedId(null);
      setAnswer("");
    } else {
      setFlippedId(questId);
      setAnswer("");
    }
  }, [completedIds, flippedId]);

  const handleSubmit = useCallback(() => {
    if (!flippedId || !answer.trim()) return;
    const quest = dealtCards.find(q => q.id === flippedId);
    if (quest) {
      completeQuest({ quest, answer: answer.trim() });
      setFlippedId(null);
      setAnswer("");
    }
  }, [flippedId, answer, dealtCards, completeQuest]);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/dashboard/self-help" className="w-9 h-9 rounded-xl bg-card border border-border/50 flex items-center justify-center hover:border-primary/30 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display">Quest Cards</h1>
            <p className="text-sm text-muted-foreground">Flip a card, answer the question, earn XP</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <div className="rounded-xl bg-card border border-border/50 p-3 text-center flex-1">
            <p className="text-lg font-bold">{completedToday}</p>
            <p className="text-[11px] text-muted-foreground">Answered</p>
          </div>
          <div className="rounded-xl bg-card border border-border/50 p-3 text-center flex-1">
            <p className="text-lg font-bold">{totalXpToday}</p>
            <p className="text-[11px] text-muted-foreground">XP Today</p>
          </div>
          <div className="rounded-xl bg-card border border-border/50 p-3 text-center flex-1">
            <p className="text-lg font-bold">{dealtCards.length}</p>
            <p className="text-[11px] text-muted-foreground">Cards Dealt</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Failed to load quests. Please refresh the page.</span>
          </div>
        )}

        {isLoading ? (
          <div className="card-table rounded-2xl p-6">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-xl bg-white/10" />
              ))}
            </div>
          </div>
        ) : dealtCards.length === 0 && !error ? (
          <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
            <Award className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No quests available right now. Check back later!</p>
          </div>
        ) : (
          <>
            {/* Card Table Surface */}
            <div className="card-table rounded-2xl p-5 sm:p-6 relative">
              {/* Felt texture label */}
              <div className="absolute top-3 left-4 text-[10px] uppercase tracking-[0.2em] text-white/20 font-semibold select-none">
                Quest Table
              </div>

              {/* Card Grid + Deck layout */}
              <div className="flex gap-4 sm:gap-5 items-start mt-4">
                {/* 6-card grid */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 flex-1">
                  {dealtCards.map((quest, idx) => {
                    const isCompleted = completedIds.includes(quest.id);
                    const isFlipped = flippedId === quest.id;

                    return (
                      <div
                        key={quest.id}
                        className="perspective-1000 card-deal-in"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <button
                          onClick={() => handleFlip(quest.id)}
                          disabled={isCompleted || isCompleting}
                          className={`w-full ${!isCompleted && !isFlipped ? "card-hover-lift" : ""}`}
                        >
                          <div
                            className={`relative w-full aspect-[3/4] transform-style-3d card-flip-transition ${
                              isFlipped || isCompleted ? "rotate-y-180" : ""
                            }`}
                          >
                            {/* ===== CARD BACK ===== */}
                            <div className={`absolute inset-0 backface-hidden rounded-xl overflow-hidden ${
                              isCompleted ? "opacity-40" : "cursor-pointer"
                            }`}>
                              {/* Gradient base */}
                              <div className={`absolute inset-0 bg-gradient-to-br ${CARD_COLORS[idx]} opacity-90`} />
                              {/* Diamond pattern overlay */}
                              <div className="absolute inset-0 card-back-pattern" />
                              {/* Inner ornate border */}
                              <div className="absolute inset-[5px] sm:inset-[6px] rounded-lg border border-white/20" />
                              <div className="absolute inset-[9px] sm:inset-[10px] rounded-md border border-white/10" />
                              {/* Center emblem */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                                  <span className="text-base sm:text-lg text-white/80 font-bold">Q</span>
                                </div>
                                <span className="text-[8px] sm:text-[9px] text-white/40 font-semibold tracking-widest uppercase">
                                  Quest
                                </span>
                              </div>
                              {/* Corner suits */}
                              <span className="absolute top-1.5 left-2 text-[10px] sm:text-xs text-white/30 font-bold">{SUIT_ICONS[idx]}</span>
                              <span className="absolute bottom-1.5 right-2 text-[10px] sm:text-xs text-white/30 font-bold rotate-180">{SUIT_ICONS[idx]}</span>
                              {/* Card shadow */}
                              <div className="absolute inset-0 rounded-xl shadow-lg shadow-black/30" />
                            </div>

                            {/* ===== CARD FRONT ===== */}
                            <div className={`absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden ${
                              isCompleted ? "card-completed-glow" : "shadow-lg shadow-black/20"
                            }`}>
                              {/* Parchment background */}
                              <div className={`absolute inset-0 ${isCompleted ? "bg-amber-50" : "card-front-parchment"}`} />
                              {/* Inner border */}
                              <div className={`absolute inset-[4px] sm:inset-[5px] rounded-lg border ${
                                isCompleted ? "border-amber-300/40" : "border-primary/20"
                              }`} />
                              {/* Corner ornaments */}
                              <span className="absolute top-1 left-2 text-[10px] text-primary/30 font-serif">{SUIT_ICONS[idx]}</span>
                              <span className="absolute bottom-1 right-2 text-[10px] text-primary/30 font-serif rotate-180">{SUIT_ICONS[idx]}</span>
                              {/* Content */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                                {isCompleted && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                                    <span className="text-[10px] text-white font-bold">✓</span>
                                  </div>
                                )}
                                <p className="text-[11px] sm:text-xs font-bold leading-tight mb-1 text-foreground/90">{quest.title}</p>
                                <p className="text-[9px] sm:text-[10px] text-foreground/50 leading-snug line-clamp-3">{quest.description}</p>
                                <div className="mt-2">
                                  <span className={`text-[10px] font-bold ${isCompleted ? "text-amber-600" : "text-primary"}`}>
                                    {isCompleted ? "Completed" : `+${quest.xp_reward} XP`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Deck Stack */}
                <div className="hidden sm:flex flex-col items-center gap-2 pt-2">
                  <div className="relative w-16 h-[88px]">
                    {[4, 3, 2, 1, 0].map((i) => (
                      <div
                        key={i}
                        className="absolute inset-0 rounded-lg overflow-hidden deck-shadow"
                        style={{
                          transform: `translateX(${i * 1.5}px) translateY(${i * 1.5}px)`,
                          zIndex: 5 - i,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent opacity-80" />
                        <div className="absolute inset-0 card-back-pattern" />
                        <div className="absolute inset-[3px] rounded border border-white/15" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/30 text-center leading-tight">
                    {quests.length - dealtCards.length}<br />remaining
                  </p>
                </div>
              </div>

              {/* Mobile deck indicator */}
              <div className="flex sm:hidden items-center justify-center gap-2 mt-4 text-white/30">
                <div className="relative w-8 h-11">
                  {[2, 1, 0].map((i) => (
                    <div
                      key={i}
                      className="absolute inset-0 rounded border border-white/15 bg-gradient-to-br from-primary/60 to-accent/60"
                      style={{ transform: `translateX(${i * 1.5}px) translateY(${i * 1.5}px)` }}
                    />
                  ))}
                </div>
                <p className="text-[10px]">
                  {quests.length - dealtCards.length} more · refreshes daily
                </p>
              </div>
            </div>

            {/* Answer Input */}
            {flippedId && !completedIds.includes(flippedId) && (
              <div className="rounded-2xl border border-primary/30 bg-card p-4 space-y-3 animate-in slide-in-from-bottom-4 duration-300 shadow-lg shadow-primary/5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Award className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <p className="text-sm font-semibold">
                    {dealtCards.find(q => q.id === flippedId)?.title}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground pl-9">
                  {dealtCards.find(q => q.id === flippedId)?.description}
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your answer..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    className="flex-1 bg-background"
                    autoFocus
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={!answer.trim() || isCompleting}
                    size="icon"
                    className="shrink-0"
                  >
                    {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default QuestCards;
