import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, Download, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SNOOZE_KEY = "eternia_pwa_update_snoozed_at";
const SNOOZE_DURATION = 60 * 60 * 1000; // 1 hour
const DISMISSED_IDS_KEY = "eternia_pwa_dismissed_updates";

export function PWAUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const checkSnooze = useCallback(() => {
    const snoozedAt = localStorage.getItem(SNOOZE_KEY);
    if (snoozedAt && Date.now() - Number(snoozedAt) < SNOOZE_DURATION) {
      return true;
    }
    localStorage.removeItem(SNOOZE_KEY);
    return false;
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        setRegistration(reg);

        // Check if there's already a waiting worker
        if (reg.waiting && navigator.serviceWorker.controller) {
          if (!checkSnooze()) setShowUpdate(true);
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              if (!checkSnooze()) {
                setShowUpdate(true);
                setSnoozed(false);
              }
            }
          });
        });

        // Check for updates every 5 minutes
        const interval = setInterval(() => {
          reg.update();
          // Also re-check snooze expiry
          if (snoozed && !checkSnooze()) {
            setSnoozed(false);
            if (reg.waiting) setShowUpdate(true);
          }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
      } catch {
        // SW not supported or not registered
      }
    };

    checkForUpdates();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [checkSnooze, snoozed]);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  const handleSnooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    setSnoozed(true);
    setShowUpdate(false);
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-[60] sm:left-auto sm:right-4 sm:max-w-sm"
        >
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-5 h-5 text-primary" />
                </motion.div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold font-display">New Version Available</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bug fixes and improvements are ready to install.
                </p>
              </div>
              <button
                onClick={handleSnooze}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 text-xs gap-1.5"
                onClick={handleSnooze}
              >
                Later
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 text-xs gap-1.5"
                onClick={handleUpdate}
              >
                <Download className="w-3.5 h-3.5" />
                Update Now
              </Button>
            </div>

            {/* Fallback hint */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                If the update doesn't apply, close all Eternia tabs and reopen, or uninstall and reinstall the app.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Returns true if a PWA update is waiting. Use to show a dot indicator elsewhere. */
export function usePWAUpdateAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg.waiting) setAvailable(true);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setAvailable(true);
            }
          });
        });
      } catch {}
    };
    check();
  }, []);

  return available;
}
