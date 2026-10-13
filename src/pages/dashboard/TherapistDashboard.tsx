import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TherapistDashboardContent from "@/components/therapist/TherapistDashboardContent";

const TherapistDashboard = () => {
  const isMobile = useIsMobile();

  return (
    <DashboardLayout>
      <TherapistDashboardContent isMobile={isMobile} />
    </DashboardLayout>
  );
};

export default TherapistDashboard;
