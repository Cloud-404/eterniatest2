import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { CookieConsent } from "@/components/CookieConsent";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Analytics } from "@vercel/analytics/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eagerly load landing + auth (first paint)
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";

// Lazy load everything else
const InstitutionCode = lazy(() => import("./pages/auth/InstitutionCode"));
const ContactInstitution = lazy(() => import("./pages/ContactInstitution"));
const QRScan = lazy(() => import("./pages/auth/QRScan"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Appointments = lazy(() => import("./pages/dashboard/Appointments"));
const PeerConnect = lazy(() => import("./pages/dashboard/PeerConnect"));
const BlackBox = lazy(() => import("./pages/dashboard/BlackBox"));
const SoundTherapy = lazy(() => import("./pages/dashboard/SoundTherapy"));
const SelfHelp = lazy(() => import("./pages/dashboard/SelfHelp"));
const QuestCards = lazy(() => import("./pages/dashboard/QuestCards"));
const Journaling = lazy(() => import("./pages/dashboard/Journaling"));
const MoodTrackerPage = lazy(() => import("./pages/dashboard/MoodTracker"));
const GratitudePage = lazy(() => import("./pages/dashboard/Gratitude"));
const WreckBuddy = lazy(() => import("./pages/dashboard/WreckBuddy"));
const TibetanBowl = lazy(() => import("./pages/dashboard/TibetanBowl"));
const Credits = lazy(() => import("./pages/dashboard/Credits"));
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const RecoverySetup = lazy(() => import("./pages/dashboard/RecoverySetup"));
const ExpertDashboard = lazy(() => import("./pages/dashboard/ExpertDashboard"));
const InternDashboard = lazy(() => import("./pages/dashboard/InternDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SPOCDashboard = lazy(() => import("./pages/dashboard/SPOCDashboard"));
const TherapistDashboard = lazy(() => import("./pages/dashboard/TherapistDashboard"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const DPDP = lazy(() => import("./pages/legal/DPDP"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min stale time — reduces refetching at scale
      gcTime: 1000 * 60 * 10, // 10 min garbage collection
      retry: 2,
      refetchOnWindowFocus: false, // Prevent thundering herd on tab focus
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

const AnalyticsTracker = () => {
  useAnalytics();
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAUpdatePrompt />
          <CookieConsent />
          <Analytics />
          <BrowserRouter>
            <AnalyticsTracker />
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/institution-code" element={<InstitutionCode />} />
              <Route path="/contact-institution" element={<ContactInstitution />} />
              <Route path="/qr-scan" element={<QRScan />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/dpdp" element={<DPDP />} />
              
              {/* Protected Dashboard Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
              <Route path="/dashboard/peer-connect" element={<ProtectedRoute><PeerConnect /></ProtectedRoute>} />
              <Route path="/dashboard/blackbox" element={<ProtectedRoute allowedRoles={["student", "therapist"]}><BlackBox /></ProtectedRoute>} />
              <Route path="/dashboard/sound-therapy" element={<ProtectedRoute><SoundTherapy /></ProtectedRoute>} />
              <Route path="/dashboard/self-help" element={<ProtectedRoute><SelfHelp /></ProtectedRoute>} />
              <Route path="/dashboard/quest-cards" element={<ProtectedRoute><QuestCards /></ProtectedRoute>} />
              <Route path="/dashboard/journaling" element={<ProtectedRoute><Journaling /></ProtectedRoute>} />
              <Route path="/dashboard/mood-tracker" element={<ProtectedRoute><MoodTrackerPage /></ProtectedRoute>} />
              <Route path="/dashboard/gratitude" element={<ProtectedRoute><GratitudePage /></ProtectedRoute>} />
              <Route path="/dashboard/wreck-buddy" element={<ProtectedRoute><WreckBuddy /></ProtectedRoute>} />
              <Route path="/dashboard/tibetan-bowl" element={<ProtectedRoute><TibetanBowl /></ProtectedRoute>} />
              <Route path="/dashboard/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
              <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/dashboard/recovery-setup" element={<ProtectedRoute><RecoverySetup /></ProtectedRoute>} />
              
              {/* Role-Based Dashboards */}
              <Route path="/dashboard/expert" element={<ProtectedRoute allowedRoles={["expert"]}><ExpertDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/intern" element={<ProtectedRoute allowedRoles={["intern"]}><InternDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/therapist" element={<ProtectedRoute allowedRoles={["intern", "therapist"]}><TherapistDashboard /></ProtectedRoute>} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/spoc" element={<ProtectedRoute allowedRoles={["spoc"]}><SPOCDashboard /></ProtectedRoute>} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
