import { useIsMobile } from "@/hooks/use-mobile";
import MobileInternDashboard from "@/components/mobile/MobileInternDashboard";
import InternDashboardContent from "@/components/intern/InternDashboardContent";

const InternDashboard = () => {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileInternDashboard />;
  return <InternDashboardContent />;
};

export default InternDashboard;
