import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "eternia_cookie_consent";

export type ConsentStatus = "accepted" | "rejected" | "pending";

export function getConsentStatus(): ConsentStatus {
  return (localStorage.getItem(STORAGE_KEY) as ConsentStatus) || "pending";
}

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const status = getConsentStatus();
    if (status === "pending") {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = async (choice: "accepted" | "rejected") => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);

    if (user) {
      await supabase
        .from("profiles")
        .update({ cookie_consent: choice } as any)
        .eq("id", user.id);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">We value your privacy</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use cookies to understand how you use Eternia and improve your experience. 
              Your data stays anonymous and is never shared. See our{" "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>
          </div>
          <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" size="sm" onClick={() => handleChoice("rejected")} className="text-xs">
            Reject
          </Button>
          <Button size="sm" onClick={() => handleChoice("accepted")} className="text-xs">
            Accept Cookies
          </Button>
        </div>
      </div>
    </div>
  );
};
