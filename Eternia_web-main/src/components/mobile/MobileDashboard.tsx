import { memo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Calendar, MessageCircle, Box, Music,
  Award, Heart, BarChart3, Sparkles, Coins, AlertCircle, Send,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useMoodTracker } from "@/hooks/useMoodTracker";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/DashboardLayout";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
};

const moods = [
  { value: 1, emoji: "😢", label: "Awful" },
  { value: 2, emoji: "😕", label: "Bad" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😁", label: "Great" },
];

const DashboardSkeleton = () => (
  <DashboardLayout>
    <div className="space-y-5 pb-24">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full rounded-3xl" />
      <Skeleton className="h-20 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    </div>
  </DashboardLayout>
);

const MobileDashboard = () => {
  const { profile, isLoading } = useAuth();
  const { balance } = useCredits();
  const { todayEntry, logMood, isLogging } = useMoodTracker();
  const navigate = useNavigate();
  const [thought, setThought] = useState("");

  if (isLoading) return <DashboardSkeleton />;

  const role = profile?.role as string | undefined;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "spoc") return <Navigate to="/dashboard/spoc" replace />;
  if (role === "expert") return <Navigate to="/dashboard/expert" replace />;
  if (role === "therapist") return <Navigate to="/dashboard/therapist" replace />;
  if (role === "intern") return <Navigate to="/dashboard/intern" replace />;

  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  // 4 pastel activity tiles — exactly like the reference
  const tiles = [
    { title: "Meditation", desc: "Calm your mind", icon: Music, path: "/dashboard/sound-therapy", cls: "tile-pastel-mint" },
    { title: "Just need to talk", desc: "Peer support", icon: MessageCircle, path: "/dashboard/peer-connect", cls: "tile-pastel-pink" },
    { title: "Reduce anxiety", desc: "Daily quests", icon: Award, path: "/dashboard/quest-cards", cls: "tile-pastel-butter" },
    { title: "Handle stress", desc: "Express it out", icon: Box, path: "/dashboard/blackbox", cls: "tile-pastel-lavender" },
  ];

  const quickTools = [
    { name: "Mood", icon: BarChart3, path: "/dashboard/mood-tracker", surface: "surface-sky" },
    { name: "Journal", icon: Sparkles, path: "/dashboard/journaling", surface: "surface-mint" },
    { name: "Gratitude", icon: Heart, path: "/dashboard/gratitude", surface: "surface-pink" },
    { name: "Wallet", icon: Coins, path: "/dashboard/credits", surface: "surface-butter" },
  ];

  const connect = [
    { title: "Expert", icon: Calendar, path: "/dashboard/appointments", surface: "surface-sky" },
    { title: "Peer", icon: MessageCircle, path: "/dashboard/peer-connect", surface: "surface-pink" },
    { title: "BlackBox", icon: Box, path: "/dashboard/blackbox", surface: "surface-lavender" },
  ];

  const handleThoughtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = thought.trim();
    navigate("/dashboard/journaling", { state: { draft: t } });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-24">
        {/* Greeting + date pill */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="text-2xl font-display font-semibold tracking-tight">
              {profile?.username || "friend"} <span className="inline-block">👋</span>
            </h1>
          </div>
          <span className="pill mt-1">{today}</span>
        </div>

        {/* Hero question + thought input */}
        <div className="card-soft p-5 surface-cream">
          <h2 className="text-2xl font-display font-semibold leading-tight">
            How are you feeling today?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Take a breath. Share one thought.</p>

          <form onSubmit={handleThoughtSubmit} className="mt-4 flex items-center gap-2 bg-card rounded-full border border-border/60 px-4 py-2 shadow-soft">
            <input
              type="text"
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              placeholder="Your thought…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center active:scale-95 transition"
              aria-label="Save thought"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Daily mood log — 5 emoji row */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm font-display font-semibold">Daily mood log</p>
            <Link to="/dashboard/mood-tracker" className="text-xs text-primary font-medium">View all →</Link>
          </div>
          <div className="card-soft p-4">
            <div className="flex items-center justify-between gap-2">
              {moods.map((m) => {
                const isToday = todayEntry?.mood === m.value;
                return (
                  <button
                    key={m.value}
                    disabled={!!todayEntry || isLogging}
                    onClick={() => logMood({ mood: m.value })}
                    className={`flex flex-col items-center gap-1 transition-all ${
                      isToday ? "scale-110" : "opacity-80 hover:opacity-100"
                    } ${todayEntry && !isToday ? "opacity-30" : ""}`}
                  >
                    <span
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all ${
                        isToday
                          ? "bg-accent text-accent-foreground shadow-soft-lg"
                          : "bg-secondary"
                      }`}
                    >
                      {m.emoji}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                  </button>
                );
              })}
            </div>
            {todayEntry && (
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Logged today · come back tomorrow 🌱
              </p>
            )}
          </div>
        </div>

        {/* Low Balance Warning */}
        {balance < 5 && (
          <div className="flex items-center gap-3 p-4 rounded-3xl surface-peach">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Your care energy is low. Refill gently.</p>
          </div>
        )}

        {/* 2×2 pastel activity tiles */}
        <div>
          <p className="text-sm font-display font-semibold mb-3">For you today</p>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <Link key={t.title} to={t.path} className={`${t.cls} active:scale-[0.98]`}>
                <div className="w-10 h-10 rounded-2xl bg-card/70 flex items-center justify-center mb-3">
                  <t.icon className="w-5 h-5 text-foreground/80" />
                </div>
                <h3 className="text-base font-display font-semibold leading-tight">{t.title}</h3>
                <p className="text-[11px] text-foreground/60 mt-1">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats row — restyled as soft pills */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-soft p-4 text-center">
            <p className="text-xl font-display font-bold">{profile?.streak_days || 0}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Streak 🔥</p>
          </div>
          <div className="card-soft p-4 text-center">
            <p className="text-xl font-display font-bold">{balance}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Wallet 💎</p>
          </div>
          <div className="card-soft p-4 text-center">
            <p className="text-xl font-display font-bold">{profile?.total_sessions || 0}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Sessions 📊</p>
          </div>
        </div>

        {/* Quick tools row */}
        <div>
          <p className="text-sm font-display font-semibold mb-3">Quick tools</p>
          <div className="grid grid-cols-4 gap-3">
            {quickTools.map((tool) => (
              <Link key={tool.name} to={tool.path} className="flex flex-col items-center gap-1.5">
                <div className={`w-14 h-14 rounded-2xl ${tool.surface} flex items-center justify-center active:scale-95 transition shadow-soft`}>
                  <tool.icon className="w-5 h-5 text-foreground/80" />
                </div>
                <span className="text-[10px] text-muted-foreground text-center">{tool.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Connect */}
        <div>
          <p className="text-sm font-display font-semibold mb-3">Connect</p>
          <div className="grid grid-cols-3 gap-3">
            {connect.map((p) => (
              <Link key={p.path} to={p.path} className={`rounded-3xl ${p.surface} p-4 active:scale-[0.97] transition shadow-soft`}>
                <p.icon className="w-5 h-5 text-foreground/80 mb-2" />
                <h3 className="text-xs font-display font-semibold">{p.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default memo(MobileDashboard);
