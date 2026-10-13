import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";

const activeTools = [
  { name: "Quest Cards", emoji: "🏆", description: "Daily micro-challenges", surface: "surface-butter", path: "/dashboard/quest-cards" },
  { name: "Journaling", emoji: "📝", description: "Reflective writing", surface: "surface-mint", path: "/dashboard/journaling" },
  { name: "Mood Tracker", emoji: "🎭", description: "Track your emotions", surface: "surface-sky", path: "/dashboard/mood-tracker" },
  { name: "Gratitude", emoji: "🙏", description: "Daily gratitude practice", surface: "surface-pink", path: "/dashboard/gratitude" },
  { name: "Wreck the Buddy", emoji: "🥊", description: "Release stress", surface: "surface-peach", path: "/dashboard/wreck-buddy" },
  { name: "Tibetan Bowl", emoji: "🔔", description: "Sound meditation", surface: "surface-lavender", path: "/dashboard/tibetan-bowl" },
];

const MobileSelfHelp = () => {
  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <div>
          <p className="text-muted-foreground text-sm mb-1">✨ Daily wellbeing</p>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Self-Help Tools</h1>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {activeTools.map((tool) => (
            <Link
              key={tool.name}
              to={tool.path}
              className={`relative overflow-hidden rounded-3xl ${tool.surface} p-4 shadow-soft active:scale-[0.97] transition-all`}
            >
              <div className="w-12 h-12 rounded-2xl bg-card/70 flex items-center justify-center text-2xl mb-3">
                {tool.emoji}
              </div>
              <h3 className="text-sm font-display font-semibold mb-0.5">{tool.name}</h3>
              <p className="text-xs text-foreground/65 leading-snug">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MobileSelfHelp;
