import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getConsentStatus } from "@/components/CookieConsent";

function getSessionHash(): string {
  let hash = sessionStorage.getItem("eternia_session_hash");
  if (!hash) {
    hash = crypto.randomUUID();
    sessionStorage.setItem("eternia_session_hash", hash);
  }
  return hash;
}

export function useAnalytics() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const lastPath = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (getConsentStatus() !== "accepted") return;
    // Exclude admin users from analytics to avoid polluting metrics
    if (profile?.role === "admin") return;
    if (location.pathname === lastPath.current) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastPath.current = location.pathname;

      const event = {
        user_id: user?.id || null,
        session_hash: getSessionHash(),
        event_type: "page_view",
        page_path: location.pathname,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
      };

      (supabase.from("analytics_events" as any) as any).insert(event).then();
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [location.pathname, user?.id, profile?.role]);
}
