import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("student" | "intern" | "expert" | "spoc" | "admin" | "therapist")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, profileError, refreshProfile, signOut } = useAuth();
  const location = useLocation();
  // Check if user has completed recovery setup (only for students)
  const { data: hasRecoverySetup, isLoading: isCheckingRecovery } = useQuery({
    queryKey: ["recovery-check", user?.id],
    queryFn: async () => {
      if (!user) return true;
      const { data, error } = await supabase
        .from("recovery_credentials")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return true; // Don't block on error
      return !!data;
    },
    enabled: !!user && profile?.role === "student",
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 15,
  });

  if (isLoading || (user && !profile && !profileError) || (profile?.role === "student" && isCheckingRecovery)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-eternia flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-background" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Profile failed to load — show recovery UI
  if (user && profileError && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold">Could not load your profile</h2>
          <p className="text-sm text-muted-foreground">
            There was a problem loading your account data. Please try again.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => refreshProfile()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect students to recovery setup if not completed
  if (
    profile?.role === "student" &&
    hasRecoverySetup === false &&
    location.pathname !== "/dashboard/recovery-setup"
  ) {
    return <Navigate to="/dashboard/recovery-setup" replace />;
  }

  return <>{children}</>;
}