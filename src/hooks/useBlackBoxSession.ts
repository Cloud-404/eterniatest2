import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getVideoSDKToken } from "@/lib/videosdk";
import { toast } from "sonner";
import { spendCredits } from "./useSpendCredits";

export type BlackBoxSessionStatus = "queued" | "accepted" | "active" | "escalated" | "completed" | "cancelled";
export type CallState = "idle" | "waiting" | "ready" | "joining" | "joined" | "failed";

export interface BlackBoxSession {
  id: string;
  student_id: string;
  therapist_id: string | null;
  status: BlackBoxSessionStatus;
  room_id: string | null;
  flag_level: number;
  escalation_reason: string | null;
  escalation_history: any[];
  session_notes_encrypted: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  student_joined_at: string | null;
  therapist_joined_at: string | null;
  last_join_error: string | null;
  refunded: boolean;
}

const SESSION_COLUMNS = "id, student_id, therapist_id, status, room_id, flag_level, escalation_reason, escalation_history, session_notes_encrypted, started_at, ended_at, created_at, student_joined_at, therapist_joined_at, last_join_error";

export const useBlackBoxSession = () => {
  const { user, refreshCredits } = useAuth();
  const [activeSession, setActiveSession] = useState<BlackBoxSession | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const tokenRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionCostRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => {
    const prevId = sessionIdRef.current;
    sessionIdRef.current = activeSession?.id || null;
    if (prevId && prevId !== activeSession?.id) {
      setToken(null);
      tokenRef.current = null;
      setCallState("idle");
    }
  }, [activeSession?.id]);

  // Derive callState from session status
  useEffect(() => {
    if (!activeSession) { setCallState("idle"); return; }
    const { status, room_id } = activeSession;

    // "escalated" is NOT terminal — student stays connected during L3 handoff (PRD §18)
    if (["completed", "cancelled"].includes(status)) {
      setCallState("idle");
      setToken(null);
      tokenRef.current = null;
      return;
    }
    if (status === "queued") { setCallState("waiting"); return; }
    if ((status === "accepted" || status === "active") && room_id) {
      if (!tokenRef.current) {
        setCallState("ready");
      }
      return;
    }
  }, [activeSession?.status, activeSession?.room_id, token]);

  // Fetch token for the current session
  const fetchToken = useCallback(async () => {
    if (!activeSession?.room_id) return;
    setCallState("joining");
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[BlackBox] Fetching token attempt ${attempt}/${MAX_RETRIES}`);
        const t = await getVideoSDKToken();
        setToken(t);
        return;
      } catch (error: any) {
        console.error(`[BlackBox] Token fetch attempt ${attempt} failed:`, error);
        if (attempt === MAX_RETRIES) {
          const msg = error.message || "Failed to connect to session";
          setCallState("failed");
          if (activeSession?.id) {
            await supabase.from("blackbox_sessions")
              .update({ last_join_error: msg } as any)
              .eq("id", activeSession.id);
          }
          toast.error(msg);
        } else {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  }, [activeSession?.id, activeSession?.room_id]);

  const onCallJoined = useCallback(async () => {
    setCallState("joined");
    if (activeSession?.id) {
      // Deduct ECC on actual join (not on request)
      const cost = sessionCostRef.current;
      if (cost > 0) {
        try {
          const spendResult = await spendCredits(cost, "BlackBox Talk Now session", activeSession.id);
          if (!spendResult.success) {
            toast.error(`Insufficient credits (${cost} ECC required)`);
            // Still allow join but warn — session is already in progress
          } else {
            refreshCredits();
          }
        } catch (err: any) {
          console.error("[BlackBox] Credit deduction on join failed:", err);
          toast.error("Credit deduction failed — session continues");
        }
      }
      await supabase.from("blackbox_sessions")
        .update({ student_joined_at: new Date().toISOString(), last_join_error: null } as any)
        .eq("id", activeSession.id);
    }
  }, [activeSession?.id, refreshCredits]);

  const onCallError = useCallback(async (errorMsg: string) => {
    setCallState("failed");
    if (activeSession?.id) {
      await supabase.from("blackbox_sessions")
        .update({ last_join_error: errorMsg } as any)
        .eq("id", activeSession.id);
    }
  }, [activeSession?.id]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!activeSession?.id) return;
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`blackbox-session-${activeSession.id}-${suffix}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "blackbox_sessions",
        filter: `id=eq.${activeSession.id}`,
      }, (payload) => {
        console.log("[BlackBox] Realtime update:", payload.new?.status, "room:", payload.new?.room_id);
        setActiveSession(payload.new as unknown as BlackBoxSession);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession?.id]);

  // Auto-connect when therapist is ready
  useEffect(() => {
    if (callState === "ready" && activeSession?.room_id && !tokenRef.current) {
      fetchToken();
    }
  }, [callState, activeSession?.room_id, fetchToken]);

  // Joining timeout recovery (30s)
  useEffect(() => {
    if (callState !== "joining") return;
    const timeout = setTimeout(async () => {
      setCallState((prev) => {
        if (prev === "joining") {
          console.warn("[BlackBox] Joining timed out after 30s");
          return "failed";
        }
        return prev;
      });
      if (activeSession?.id) {
        await supabase.from("blackbox_sessions")
          .update({ last_join_error: "Connection timed out after 30s" } as any)
          .eq("id", activeSession.id);
      }
    }, 30000);
    return () => clearTimeout(timeout);
  }, [callState, activeSession?.id]);

  // Polling fallback while queued/accepted/active
  useEffect(() => {
    if (!activeSession?.id || !["queued", "accepted", "active"].includes(activeSession.status)) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("blackbox_sessions")
        .select(SESSION_COLUMNS)
        .eq("id", activeSession.id)
        .single();
      if (data && (data as any).status !== activeSession.status) {
        setActiveSession(data as unknown as BlackBoxSession);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status]);

  // Check for existing active session on mount
  useEffect(() => {
    if (!user) return;
    const checkExisting = async () => {
      const { data } = await supabase
        .from("blackbox_sessions")
        .select(SESSION_COLUMNS)
        .eq("student_id", user.id)
        .in("status", ["queued", "accepted", "active"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setActiveSession(data[0] as unknown as BlackBoxSession);
      }
    };
    checkExisting();
  }, [user]);

  const requestSession = useCallback(async () => {
    if (!user) return;
    setIsRequesting(true);
    try {
      // Check for existing open session
      const { data: existing } = await supabase
        .from("blackbox_sessions")
        .select(SESSION_COLUMNS)
        .eq("student_id", user.id)
        .in("status", ["queued", "accepted", "active"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        setActiveSession(existing[0] as unknown as BlackBoxSession);
        toast.info("Reconnecting to your existing session…");
        return;
      }

      // Check daily limit (12/day)
      const { data: dailyCount } = await supabase.rpc("get_blackbox_daily_count", { _user_id: user.id });
      if ((dailyCount || 0) >= 12) {
        toast.error("Daily BlackBox limit reached (12 sessions/day)");
        return;
      }

      // Calculate tiered cost
      const { data: totalCount } = await supabase.rpc("get_blackbox_usage_count", { _user_id: user.id });
      const usageCount = totalCount || 0;
      const cost = usageCount === 0 ? 0 : usageCount < 4 ? 3 : 6;

      // ECC is deducted on join (onCallJoined), not here
      // But check balance upfront to prevent queueing if insufficient
      if (cost > 0) {
        const { data: balance } = await supabase.rpc("get_credit_balance", { _user_id: user.id });
        if ((balance || 0) < cost) {
          toast.error(`Insufficient credits for a BlackBox session (${cost} ECC required)`);
          return;
        }
      }

      sessionCostRef.current = cost;

      const { data, error } = await supabase
        .from("blackbox_sessions")
        .insert({ student_id: user.id, status: "queued" })
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data as unknown as BlackBoxSession);
      toast.success(cost === 0
        ? "You're in the queue (first session free!). A therapist will connect shortly."
        : `You're in the queue (${cost} ECC will be charged on join). A therapist will connect shortly.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to request session");
    } finally {
      setIsRequesting(false);
    }
  }, [user]);

  const cancelSession = useCallback(async () => {
    if (!activeSession || !user) return;
    // Only refund if student never joined (student_joined_at is null)
    const neverJoined = !activeSession.student_joined_at;

    await supabase
      .from("blackbox_sessions")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("id", activeSession.id);

    if (neverJoined) {
      // Look up any spend transaction to refund
      const { data: spendTx } = await supabase
        .from("credit_transactions")
        .select("id, delta")
        .eq("reference_id", activeSession.id)
        .eq("type", "spend")
        .maybeSingle();

      const refundAmount = spendTx ? Math.abs(spendTx.delta) : 0;

      if (refundAmount > 0) {
        const { data: existingRefund } = await supabase
          .from("credit_transactions")
          .select("id")
          .eq("reference_id", activeSession.id)
          .eq("type", "grant")
          .maybeSingle();

        if (!existingRefund) {
          await supabase.from("credit_transactions").insert({
            user_id: user.id,
            delta: refundAmount,
            type: "grant",
            notes: "BlackBox session cancelled — refund",
            reference_id: activeSession.id,
          });
        }
      }
      refreshCredits();
    }

    setActiveSession(null);
    setToken(null);
    setCallState("idle");
    toast.info(neverJoined ? "Session cancelled" : "Session cancelled — no refund (already joined)");
  }, [activeSession, user, refreshCredits]);

  const endSession = useCallback(async () => {
    if (!activeSession) return;
    await supabase
      .from("blackbox_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", activeSession.id);
    setActiveSession(null);
    setToken(null);
    setCallState("idle");
  }, [activeSession]);

  const retryConnection = useCallback(async () => {
    setToken(null);
    tokenRef.current = null;
    await fetchToken();
  }, [fetchToken]);

  return {
    activeSession,
    isRequesting,
    callState,
    token,
    requestSession,
    cancelSession,
    endSession,
    retryConnection,
    fetchToken,
    onCallJoined,
    onCallError,
  };
};
