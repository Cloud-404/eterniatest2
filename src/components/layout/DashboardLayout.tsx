import { useState, useMemo, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Calendar,
  MessageCircle,
  Box,
  Music,
  Sparkles,
  Coins,
  User,
  Users,
  LogOut,
  ChevronLeft,
  Shield,
  Headphones,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import EterniaLogo from "@/components/EterniaLogo";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const studentNavItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Calendar, label: "Expert Connect", path: "/dashboard/appointments" },
  { icon: MessageCircle, label: "Peer Connect", path: "/dashboard/peer-connect" },
  { icon: Box, label: "BlackBox", path: "/dashboard/blackbox" },
  { icon: Music, label: "Sounds", path: "/dashboard/sound-therapy" },
  { icon: Sparkles, label: "Self-Help", path: "/dashboard/self-help" },
  { icon: Coins, label: "Wallet", path: "/dashboard/credits" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const adminNavItems = [
  { icon: Shield, label: "Admin Panel", path: "/admin" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const spocNavItems = [
  { icon: Home, label: "Home", path: "/dashboard/spoc?tab=home" },
  { icon: Users, label: "Onboarding", path: "/dashboard/spoc?tab=onboarding" },
  { icon: AlertCircle, label: "Flags", path: "/dashboard/spoc?tab=flags" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const expertNavItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard/expert" },
  { icon: Calendar, label: "Appointments", path: "/dashboard/appointments" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const internNavItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard/intern" },
  { icon: MessageCircle, label: "Peer Connect", path: "/dashboard/peer-connect" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const therapistNavItems = [
  { icon: Headphones, label: "Queue", path: "/dashboard/therapist" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const studentBottomNavItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: MessageCircle, label: "Connect", path: "/dashboard/peer-connect" },
  { icon: Sparkles, label: "Tools", path: "/dashboard/self-help" },
  { icon: Music, label: "Sounds", path: "/dashboard/sound-therapy" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const adminBottomNavItems = [
  { icon: Shield, label: "Admin", path: "/admin" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const spocBottomNavItems = [
  { icon: Home, label: "Home", path: "/dashboard/spoc?tab=home" },
  { icon: AlertCircle, label: "Flags", path: "/dashboard/spoc?tab=flags" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const expertBottomNavItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard/expert" },
  { icon: Calendar, label: "Schedule", path: "/dashboard/appointments" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const internBottomNavItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard/intern" },
  { icon: MessageCircle, label: "Connect", path: "/dashboard/peer-connect" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const therapistBottomNavItems = [
  { icon: Headphones, label: "Queue", path: "/dashboard/therapist" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, creditBalance } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const role: string = profile?.role || "student";
  const isStudent = role === "student";
  const showLowBalance = isStudent && creditBalance < 5;

  // Hide low-balance banner on Credits page itself
  const isCreditsPage = location.pathname === "/dashboard/credits";

  const navItems = useMemo(() => {
    if (role === "admin") return adminNavItems;
    if (role === "spoc") return spocNavItems;
    if (role === "expert") return expertNavItems;
    if (role === "intern") return internNavItems;
    if (role === "therapist") return therapistNavItems;
    return studentNavItems;
  }, [role]);

  const bottomNavItems = useMemo(() => {
    if (role === "admin") return adminBottomNavItems;
    if (role === "spoc") return spocBottomNavItems;
    if (role === "expert") return expertBottomNavItems;
    if (role === "intern") return internBottomNavItems;
    if (role === "therapist") return therapistBottomNavItems;
    return studentBottomNavItems;
  }, [role]);

  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    // For paths with query params, match pathname + search
    if (path.includes("?")) {
      const [pathname, search] = path.split("?");
      return location.pathname === pathname && location.search === `?${search}`;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen min-h-dvh bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300 ${
          sidebarOpen ? "w-56" : "w-[66px]"
        } bg-sidebar border-r border-sidebar-border`}
      >
        <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center min-w-0">
            <EterniaLogo size={sidebarOpen ? 36 : 30} />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-sidebar-foreground hover:bg-sidebar-accent h-7 w-7 shrink-0"
            >
              <ChevronLeft className={`w-4 h-4 transition-transform ${!sidebarOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl transition-all text-sm ${
                  active
                    ? "surface-lavender text-foreground font-semibold shadow-soft"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-primary" : ""}`} />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`w-full justify-start gap-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive h-10 ${
              !sidebarOpen ? "justify-center px-0" : ""
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/30 flex items-center justify-between px-4 h-12">
        <Link to="/dashboard" className="flex items-center">
          <EterniaLogo size={28} />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4.5 h-4.5" />
          </Button>
        </div>
      </header>

      {/* Mobile Bottom Navigation — hidden on expert dashboard (it has its own tabs) */}
      <nav
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/30",
          location.pathname === "/dashboard/expert" && "hidden"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[44px] min-h-[44px] transition-colors active:opacity-70 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                  {active && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </div>
                <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-normal"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main
        className={`flex-1 min-h-screen min-h-dvh transition-all duration-300 ${
          sidebarOpen ? "lg:ml-56" : "lg:ml-[66px]"
        } pt-12 lg:pt-0 pb-20 lg:pb-0`}
      >
        <div className="px-4 pt-3 pb-2 sm:p-5 lg:p-8">
          {/* Global Low Balance Banner */}
          {showLowBalance && !isCreditsPage && (
            <Link
              to="/dashboard/credits"
              className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-eternia-warning/10 border border-eternia-warning/20 hover:bg-eternia-warning/15 transition-colors group"
            >
              <AlertCircle className="w-4 h-4 text-eternia-warning shrink-0" />
              <p className="text-sm text-eternia-warning font-medium flex-1">
                Your care energy is low. Refill gently.
              </p>
              <ArrowRight className="w-4 h-4 text-eternia-warning shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
          {children}
        </div>
      </main>
    </div>
  );
};

export default memo(DashboardLayout);
