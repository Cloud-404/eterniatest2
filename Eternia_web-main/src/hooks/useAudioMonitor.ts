import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AISuggestion {
  risk_level: number;
  keywords: string[];
  risk_indicators: string[];
  emotional_signals: string[];
  reasoning: string;
  recommendation: string;
  snippet: string;
}

export interface AudioMonitorState {
  isListening: boolean;
  currentTranscript: string;
  riskLevel: number;
  lastTriggerSnippet: string | null;
  isProcessing: boolean;
  lastSuggestion: AISuggestion | null;
}

interface UseAudioMonitorOptions {
  sessionId: string;
  sessionType?: "blackbox" | "peer";
  enabled?: boolean;
  classifyIntervalMs?: number;
  bufferWindowMs?: number;
  onRiskDetected?: (level: number, snippet: string) => void;
}

export function useAudioMonitor({
  sessionId,
  sessionType = "blackbox",
  enabled = true,
  classifyIntervalMs = 10000,
  bufferWindowMs = 10000,
  onRiskDetected,
}: UseAudioMonitorOptions) {
  const [state, setState] = useState<AudioMonitorState>({
    isListening: false,
    currentTranscript: "",
    riskLevel: 0,
    lastTriggerSnippet: null,
    isProcessing: false,
    lastSuggestion: null,
  });

  const bufferRef = useRef<{ text: string; timestamp: number }[]>([]);
  const recognitionRef = useRef<any>(null);
  const classifyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);
  const classifyInFlightRef = useRef(false);

  // Keep refs in sync for latest values used in callbacks
  const sessionIdRef = useRef(sessionId);
  const sessionTypeRef = useRef(sessionType);
  const onRiskDetectedRef = useRef(onRiskDetected);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { sessionTypeRef.current = sessionType; }, [sessionType]);
  useEffect(() => { onRiskDetectedRef.current = onRiskDetected; }, [onRiskDetected]);

  const getBufferText = useCallback(() => {
    const cutoff = Date.now() - bufferWindowMs;
    return bufferRef.current
      .filter((chunk) => chunk.timestamp >= cutoff)
      .map((chunk) => chunk.text)
      .join(" ")
      .trim();
  }, [bufferWindowMs]);

  const trimBuffer = useCallback(() => {
    const cutoff = Date.now() - bufferWindowMs;
    bufferRef.current = bufferRef.current.filter((chunk) => chunk.timestamp >= cutoff);
  }, [bufferWindowMs]);

  const classifyBuffer = useCallback(async () => {
    if (!enabledRef.current) return;
    // In-flight guard: skip if a classify call is already running
    if (classifyInFlightRef.current) return;

    const transcript = getBufferText();
    if (!transcript || transcript.length < 10) return;

    classifyInFlightRef.current = true;
    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const { data, error } = await supabase.functions.invoke("ai-transcribe", {
        body: {
          transcript,
          session_id: sessionIdRef.current,
          timestamp_offset: Date.now(),
          session_type: sessionTypeRef.current,
        },
      });

      if (error) {
        console.error("[AudioMonitor] Classification error:", error);
        return;
      }

      const flagLevel = data?.flag_level || 0;
      const suggestion: AISuggestion | null = data?.suggestion || null;

      setState((prev) => ({
        ...prev,
        riskLevel: Math.max(prev.riskLevel, flagLevel),
        lastTriggerSnippet: flagLevel > 0 ? data?.trigger_snippet || null : prev.lastTriggerSnippet,
        lastSuggestion: suggestion && suggestion.risk_level > 0 ? suggestion : prev.lastSuggestion,
      }));

      if (flagLevel > 0 && onRiskDetectedRef.current) {
        onRiskDetectedRef.current(flagLevel, data?.trigger_snippet || transcript.slice(-200));
      }
    } catch (err) {
      console.error("[AudioMonitor] Classification failed:", err);
    } finally {
      // Always reset processing state and in-flight guard
      setState((prev) => ({ ...prev, isProcessing: false }));
      classifyInFlightRef.current = false;
    }
  }, [getBufferText]);

  const startListening = useCallback(() => {
    // Detect mobile devices (iOS/Android). Mobile OS handles microphone capture with single ownership.
    // Running both WebRTC call audio and Web Speech API concurrently causes mic conflicts (leading to delay)
    // and Chrome on Android repeatedly emits keyboard/voice chime/beep sounds on start/stop.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      console.warn("[AudioMonitor] Speech recognition disabled on mobile devices to prevent mic conflicts and beep sounds.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[AudioMonitor] Web Speech API not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        bufferRef.current.push({
          text: finalTranscript.trim(),
          timestamp: Date.now(),
        });
        trimBuffer();
      }

      setState((prev) => ({
        ...prev,
        currentTranscript: interimTranscript || finalTranscript,
      }));
    };

    recognition.onerror = (event: any) => {
      console.error("[AudioMonitor] Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "aborted") {
        if (enabledRef.current) {
          setTimeout(() => {
            try { recognition.start(); } catch {}
          }, 1000);
        }
      }
    };

    recognition.onend = () => {
      if (enabledRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 500);
      } else {
        setState((prev) => ({ ...prev, isListening: false }));
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setState((prev) => ({ ...prev, isListening: true }));
    } catch (err) {
      console.error("[AudioMonitor] Failed to start recognition:", err);
    }
  }, [trimBuffer]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setState((prev) => ({ ...prev, isListening: false }));
  }, []);

  useEffect(() => {
    if (enabled) {
      startListening();
      classifyTimerRef.current = setInterval(classifyBuffer, classifyIntervalMs);
    } else {
      stopListening();
      if (classifyTimerRef.current) {
        clearInterval(classifyTimerRef.current);
        classifyTimerRef.current = null;
      }
    }

    return () => {
      stopListening();
      if (classifyTimerRef.current) {
        clearInterval(classifyTimerRef.current);
        classifyTimerRef.current = null;
      }
    };
  }, [enabled, startListening, stopListening, classifyBuffer, classifyIntervalMs]);

  const classifyNow = useCallback(() => {
    classifyBuffer();
  }, [classifyBuffer]);

  const resetRisk = useCallback(() => {
    setState((prev) => ({ ...prev, riskLevel: 0, lastTriggerSnippet: null, lastSuggestion: null }));
  }, []);

  const dismissSuggestion = useCallback(() => {
    setState((prev) => ({ ...prev, lastSuggestion: null }));
  }, []);

  const captureEscalationSnippet = useCallback((windowMs: number = 10000): string => {
    const now = Date.now();
    const from = now - windowMs;
    const snippet = bufferRef.current
      .filter((chunk) => chunk.timestamp >= from)
      .map((chunk) => chunk.text)
      .join(" ")
      .trim();

    return snippet;
  }, []);

  /**
   * Captures ±10s around escalation: 10s before (from buffer) + waits 10s after,
   * then returns combined transcript with [ESCALATION TRIGGERED] marker.
   */
  const captureEscalationSnippetAsync = useCallback(
    (beforeMs: number = 10000, afterMs: number = 10000): Promise<string> => {
      const snippetBefore = captureEscalationSnippet(beforeMs);

      return new Promise((resolve) => {
        setTimeout(() => {
          const snippetAfter = captureEscalationSnippet(afterMs);
          const combined = [
            snippetBefore,
            "\n[ESCALATION TRIGGERED]\n",
            snippetAfter,
          ]
            .filter(Boolean)
            .join("")
            .trim();
          resolve(combined || "(no audio captured)");
        }, afterMs);
      });
    },
    [captureEscalationSnippet]
  );

  return {
    ...state,
    startListening,
    stopListening,
    classifyNow,
    resetRisk,
    dismissSuggestion,
    captureEscalationSnippet,
    captureEscalationSnippetAsync,
  };
}
