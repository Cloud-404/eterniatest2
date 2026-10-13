import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";

const activeTools = [
  { name: "Quest Cards", emoji: "🏆", description: "Daily micro-challenges for wellbeing", surface: "surface-butter", path: "/dashboard/quest-cards" },
  { name: "Journaling", emoji: "📝", description: "Guided reflective writing prompts", surface: "surface-mint", path: "/dashboard/journaling" },
  { name: "Mood Tracker", emoji: "🎭", description: "Track your emotional patterns", surface: "surface-sky", path: "/dashboard/mood-tracker" },
  { name: "Gratitude", emoji: "🙏", description: "Daily gratitude practice", surface: "surface-pink", path: "/dashboard/gratitude" },
  { name: "Wreck the Buddy", emoji: "🥊", description: "Release stress through ragdoll bashing", surface: "surface-peach", path: "/dashboard/wreck-buddy" },
  { name: "Tibetan Bowl", emoji: "🔔", description: "Interactive sound meditation", surface: "surface-lavender", path: "/dashboard/tibetan-bowl" },
];

const SelfHelp = () => {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-24">
        <div>
          <p className="text-muted-foreground text-sm mb-1">✨ Daily wellbeing</p>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Self-Help Tools</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {activeTools.map((tool) => (
            <Link
              key={tool.name}
              to={tool.path}
              className={`relative overflow-hidden rounded-3xl ${tool.surface} p-5 shadow-soft active:scale-[0.97] transition-all hover:-translate-y-1`}
            >
              <div className="w-14 h-14 rounded-2xl bg-card/70 flex items-center justify-center text-3xl mb-3">
                {tool.emoji}
              </div>
              <h3 className="text-base font-display font-semibold mb-0.5">{tool.name}</h3>
              <p className="text-xs text-foreground/65 leading-snug">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SelfHelp;
