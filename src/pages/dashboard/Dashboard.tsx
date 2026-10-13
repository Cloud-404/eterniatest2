import { useIsMobile } from "@/hooks/use-mobile";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import { Link, Navigate } from "react-router-dom";
import {
  Calendar, MessageCircle, Box, Music, Sparkles, Coins,
  ArrowRight, Award, Heart, AlertCircle, Sunrise, Sun, Moon, BarChart3,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good Morning", emoji: "🌅" };
  if (hour < 17) return { text: "Good Afternoon", emoji: "☀️" };
  if (hour < 21) return { text: "Good Evening", emoji: "🌙" };
  return { text: "Good Night", emoji: "🌙" };
};

const motivationalQuotes = [
  "You're doing great. Every small step counts. 💪",
  "Your mental health matters. We're here for you. 🌱",
  "It takes courage to ask for help. You're brave. ✨",
  "One day at a time. You've got this. 🌟",
  "Healing isn't linear, and that's okay. 💚",
];

const Dashboard = () => {
  const isMobile = useIsMobile();
  const { profile, creditBalance: balance } = useAuth();

  const role = profile?.role as string | undefined;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "spoc") return <Navigate to="/dashboard/spoc" replace />;
  if (role === "expert") return <Navigate to="/dashboard/expert" replace />;
  if (role === "therapist") return <Navigate to="/dashboard/therapist" replace />;
  if (role === "intern") return <Navigate to="/dashboard/intern" replace />;

  if (isMobile) return <MobileDashboard />;

  const greeting = getGreeting();
  const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

  const connectPortals = [
    { icon: Calendar, title: "Expert Connect", description: "Book expert sessions", path: "/dashboard/appointments", surface: "surface-mint" },
    { icon: MessageCircle, title: "Peer Connect", description: "Talk to trained interns", path: "/dashboard/peer-connect", surface: "surface-pink" },
    { icon: Box, title: "BlackBox", description: "Express anonymously", path: "/dashboard/blackbox", surface: "surface-lavender" },
  ];

  const selfHelpTools = [
    { icon: Music, title: "Sound Therapy", description: "Meditate & relax", path: "/dashboard/sound-therapy", surface: "surface-sky" },
    { icon: Award, title: "Quest Cards", description: "Daily wellbeing quests", path: "/dashboard/quest-cards", surface: "surface-butter" },
    { icon: Sparkles, title: "Journaling", description: "Reflective writing", path: "/dashboard/journaling", surface: "surface-peach" },
  ];

  const quickTools = [
    { name: "Quest Cards", emoji: "🏆", path: "/dashboard/quest-cards", surface: "surface-butter" },
    { name: "Journaling", emoji: "📝", path: "/dashboard/journaling", surface: "surface-mint" },
    { name: "Mood", emoji: "🎭", path: "/dashboard/mood-tracker", surface: "surface-sky" },
    { name: "Gratitude", emoji: "🙏", path: "/dashboard/gratitude", surface: "surface-pink" },
    { name: "Wallet", emoji: "💎", path: "/dashboard/credits", surface: "surface-lavender" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="pt-1">
          <p className="text-muted-foreground text-sm mb-1">{greeting.emoji} {greeting.text}</p>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">{profile?.username || "friend"}</h1>
        </div>

        <div className="card-soft p-5 sm:p-6 surface-lavender border-0">
          <Heart className="w-5 h-5 text-foreground/70 mb-2" />
          <p className="text-base font-display text-foreground/90 leading-relaxed">{quote}</p>
        </div>

        {balance < 5 && (
          <Link to="/dashboard/credits" className="flex items-center gap-3 p-4 rounded-3xl surface-peach border-0 transition-all hover:-translate-y-0.5">
            <AlertCircle className="w-5 h-5 text-foreground/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Your care energy is low.</p>
              <p className="text-xs text-foreground/60">Refill gently — earn credits through self-help activities.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-foreground/70 shrink-0" />
          </Link>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { val: profile?.streak_days || 0, label: "Day Streak 🔥", surface: "surface-pink" },
            { val: balance, label: "Wallet 💎", surface: "surface-mint" },
            { val: profile?.total_sessions || 0, label: "Sessions 📊", surface: "surface-butter" },
          ].map((s) => (
            <div key={s.label} className={`rounded-3xl ${s.surface} p-4 text-center shadow-soft`}>
              <p className="text-2xl font-display font-semibold">{s.val}</p>
              <p className="text-[11px] text-foreground/70 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">Quick Tools</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {quickTools.map((tool) => (
              <Link key={tool.name} to={tool.path} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={`w-16 h-16 rounded-3xl ${tool.surface} flex items-center justify-center text-2xl shadow-soft transition-all hover:-translate-y-0.5`}>
                  {tool.emoji}
                </div>
                <span className="text-[11px] text-muted-foreground text-center leading-tight w-16 truncate">{tool.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">Connect</p>
          <div className="grid grid-cols-3 gap-3">
            {connectPortals.map((portal) => (
              <Link key={portal.path} to={portal.path} className={`group rounded-3xl ${portal.surface} p-5 shadow-soft transition-all hover:-translate-y-1`}>
                <div className="w-11 h-11 rounded-2xl bg-card/70 flex items-center justify-center mb-3">
                  <portal.icon className="w-5 h-5 text-foreground/80" />
                </div>
                <h3 className="text-[15px] font-display font-semibold mb-0.5">{portal.title}</h3>
                <p className="text-xs text-foreground/65 leading-snug">{portal.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">Self-Help Tools</p>
          <div className="grid grid-cols-3 gap-3">
            {selfHelpTools.map((portal) => (
              <Link key={portal.title} to={portal.path} className={`group rounded-3xl ${portal.surface} p-5 shadow-soft transition-all hover:-translate-y-1`}>
                <div className="w-11 h-11 rounded-2xl bg-card/70 flex items-center justify-center mb-3">
                  <portal.icon className="w-5 h-5 text-foreground/80" />
                </div>
                <h3 className="text-[15px] font-display font-semibold mb-0.5">{portal.title}</h3>
                <p className="text-xs text-foreground/65 leading-snug">{portal.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="card-soft p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground/80">💡 Tip:</span> Complete daily quests to earn XP and build your wellness streak. Every action counts!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
