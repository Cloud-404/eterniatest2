import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SPOCDashboardContent from "@/components/spoc/SPOCDashboardContent";
import { useAuth } from "@/contexts/AuthContext";
import { Shield } from "lucide-react";

const SPOCDashboard = () => {
  const { profile } = useAuth();
  const isSPOC = profile?.role === "spoc";

  if (!isSPOC) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <Shield className="w-12 h-12 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">SPOC access required.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <SPOCDashboardContent />
      </div>
    </DashboardLayout>
  );
};

export default SPOCDashboard;
