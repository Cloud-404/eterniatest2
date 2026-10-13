import { useState, useEffect, useRef, useCallback } from "react";

interface UseSilenceDetectionOptions {
  enabled: boolean;
  audioLevel: number; // Pass audioLevel from parent!
  warningThresholdSec?: number; // default 120 (2 min)
  autoEndThresholdSec?: number; // default 300 (5 min)
  onWarning?: () => void;
  onAutoEnd?: () => void;
}

export const useSilenceDetection = ({
  enabled,
  audioLevel,
  warningThresholdSec = 120,
  autoEndThresholdSec = 300,
  onWarning,
  onAutoEnd,
}: UseSilenceDetectionOptions) => {
  const [silenceDurationSec, setSilenceDurationSec] = useState(0);
  const [hasWarned, setHasWarned] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const resetSilence = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSilenceDurationSec(0);
    setHasWarned(false);
  }, []);

  // Update last activity when audioLevel is above threshold (representing active voice)
  useEffect(() => {
    if (!enabled) return;
    // Level > 0.015 indicates student is speaking / active audio
    if (audioLevel > 0.015) {
      lastActivityRef.current = Date.now();
    }
  }, [audioLevel, enabled]);

  // Tick silence duration every second
  useEffect(() => {
    if (!enabled) return;

    const ticker = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      setSilenceDurationSec(elapsed);

      if (elapsed >= warningThresholdSec && !hasWarned) {
        setHasWarned(true);
        onWarning?.();
      }

      if (elapsed >= autoEndThresholdSec) {
        onAutoEnd?.();
      }
    }, 1000);

    return () => clearInterval(ticker);
  }, [enabled, warningThresholdSec, autoEndThresholdSec, hasWarned, onWarning, onAutoEnd]);

  return { silenceDurationSec, resetSilence };
};
