import { useIsMobile } from "@/hooks/use-mobile";
import MobileExpertDashboard from "@/components/mobile/MobileExpertDashboard";
import ExpertDashboardContent from "@/components/expert/ExpertDashboardContent";

const ExpertDashboard = () => {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileExpertDashboard />;
  return <ExpertDashboardContent />;
};

export default ExpertDashboard;
