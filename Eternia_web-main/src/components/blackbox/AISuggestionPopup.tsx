import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, ShieldAlert, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AISuggestion } from "@/hooks/useAudioMonitor";

interface AISuggestionPopupProps {
  suggestion: AISuggestion;
  onDismiss: () => void;
  onEscalate: () => void;
  autoDismissSeconds?: number;
}

const riskConfig: Record<number, { label: string; color: string; border: string; recommendation: string }> = {
  1: {
    label: "L1 — Mild Risk",
    color: "bg-yellow-500/20 text-yellow-400",
    border: "border-yellow-500/40",
    recommendation: "Monitor closely — no immediate action required",
  },
  2: {
    label: "L2 — Moderate Risk",
    color: "bg-orange-500/20 text-orange-400",
    border: "border-orange-500/40",
    recommendation: "Consider escalation — review the conversation",
  },
  3: {
    label: "L3 — Critical Risk",
    color: "bg-destructive/20 text-destructive",
    border: "border-destructive/40",
    recommendation: "Immediate intervention recommended — escalate now",
  },
};

const AISuggestionPopup = ({
  suggestion,
  onDismiss,
  onEscalate,
  autoDismissSeconds = 30,
}: AISuggestionPopupProps) => {
  const [remaining, setRemaining] = useState(autoDismissSeconds);

  useEffect(() => {
    setRemaining(autoDismissSeconds);
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [suggestion, autoDismissSeconds, onDismiss]);

  const config = riskConfig[suggestion.risk_level] || riskConfig[1];
  const progressPercent = (remaining / autoDismissSeconds) * 100;

  return (
    <div
      className={`absolute bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-lg border ${config.border} bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300`}
    >
      {/* Auto-dismiss progress bar */}
      <Progress value={progressPercent} className="h-1 rounded-none" />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">AI Risk Suggestion</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {remaining}s
            </div>
            <button
              onClick={onDismiss}
              className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Risk Level Badge */}
        <Badge className={`${config.color} text-xs`}>
          <AlertTriangle className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>

        {/* Recommendation */}
        <p className={`text-xs font-medium leading-relaxed ${suggestion.risk_level >= 3 ? 'text-destructive' : suggestion.risk_level >= 2 ? 'text-orange-400' : 'text-yellow-400'}`}>
          ⚡ {suggestion.recommendation || config.recommendation}
        </p>

        {/* Reasoning */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {suggestion.reasoning}
        </p>

        {/* Keywords */}
        {suggestion.keywords.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Keywords
            </p>
            <div className="flex flex-wrap gap-1">
              {suggestion.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Emotional Signals */}
        {suggestion.emotional_signals.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Emotional Signals
            </p>
            <div className="flex flex-wrap gap-1">
              {suggestion.emotional_signals.map((sig, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-accent/50 text-accent-foreground"
                >
                  {sig}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Snippet Preview */}
        {suggestion.snippet && (
          <div className="bg-muted/50 rounded p-2 max-h-16 overflow-y-auto">
            <p className="text-[10px] text-muted-foreground italic leading-relaxed line-clamp-3">
              "…{suggestion.snippet.substring(0, 200)}…"
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1 text-xs h-8 gap-1"
            onClick={onEscalate}
          >
            <AlertTriangle className="w-3 h-3" />
            Escalate Now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AISuggestionPopup;
