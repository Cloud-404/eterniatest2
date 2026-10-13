import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { spendCredits } from "./useSpendCredits";
import { createVideoSDKRoom } from "@/lib/videosdk";

export interface Intern {
  id: string;
  username: string;
  specialty: string | null;
  is_active: boolean;
  training_status?: string;
}

export interface PeerSession {
  id: string;
  student_id: string;
  intern_id: string | null;
  status: "pending" | "active" | "completed" | "flagged";
  is_flagged: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  room_id: string | null;
  intern?: Intern;
  student?: { id: string; username: string; specialty: string | null; role: string };
}

export interface PeerMessage {
  id: string;
  session_id: string;
  sender_id: string;
  content_encrypted: string;
  created_at: string;
}

export type InternStatus = "online" | "busy" | "offline";

const MESSAGE_PAGE_SIZE = 50;
const PENDING_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

export function usePeerConnect(initialSessionId?: string | null) {
  const { user, profile, refreshCredits } = useAuth();
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<PeerMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [incomingCallSessionId, setIncomingCallSessionId] = useState<string | null>(null);
  const isIntern = profile?.role === "intern";

  // Get available interns
  const { data: interns = [], isLoading: isLoadingInterns } = useQuery({
    queryKey: ["interns", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, specialty, is_active, training_status")
        .eq("role", "intern")
        .eq("is_active", true);
      if (error) throw error;
      return (data as Intern[]).filter((i) => i.id !== user?.id);
    },
    staleTime: 30_000,
  });

  // Get active peer sessions for busy status
  const { data: activeSessions = [] } = useQuery({
    queryKey: ["active-peer-sessions"],
    queryFn: async () => {
      const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("peer_sessions")
        .select("intern_id")
        .in("status", ["active", "pending"])
        .gte("created_at", TWO_HOURS_AGO);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
    staleTime: 10_000,
  });

  // Derive intern statuses
  const internStatuses = useMemo<Record<string, InternStatus>>(() => {
    const busyInternIds = new Set(activeSessions.map((s) => s.intern_id).filter(Boolean));
    const statuses: Record<string, InternStatus> = {};
    for (const intern of interns) {
      statuses[intern.id] = busyInternIds.has(intern.id) ? "busy" : "online";
    }
    return statuses;
  }, [interns, activeSessions]);

  // Get user's sessions
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ["peer-sessions", user?.id, isIntern],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase
        .from("peer_sessions")
        .select("id, student_id, intern_id, status, is_flagged, started_at, ended_at, created_at, room_id, escalation_note_encrypted, intern:profiles!peer_sessions_intern_id_fkey(id, username, specialty, is_active, training_status), student:profiles!peer_sessions_student_id_fkey(id, username, specialty, role)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (isIntern) {
        query = query.eq("intern_id", user.id);
      } else {
        query = query.eq("student_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const now = Date.now();
      return ((data || []) as unknown as PeerSession[]).map((s) => {
        // Auto-expire active/pending sessions older than 2 hours
        if (
          (s.status === "active" || s.status === "pending") &&
          now - new Date(s.created_at).getTime() > TWO_HOURS
        ) {
          return { ...s, status: "completed" as const, _expired: true };
        }
        // Auto-expire pending sessions older than 2 minutes
        if (
          s.status === "pending" &&
          now - new Date(s.created_at).getTime() > PENDING_EXPIRY_MS
        ) {
          return { ...s, status: "completed" as const, _pendingExpired: true };
        }
        return s;
      });
    },
    enabled: !!user,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  // Realtime subscription for session status changes
  useEffect(() => {
    if (!user) return;
    const filterCol = isIntern ? "intern_id" : "student_id";
    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`peer-session-status-${user.id}-${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "peer_sessions",
          filter: `${filterCol}=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["active-peer-sessions"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "peer_sessions",
          filter: `intern_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isIntern, queryClient]);

  // Realtime subscription for incoming call notifications
  useEffect(() => {
    if (!user) return;

    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`peer-call-notifications-${user.id}-${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            type?: string;
            metadata?: { session_id?: string } | null;
          };

          if (notification?.type !== "peer_call") return;

          const sessionId = notification.metadata?.session_id;
          if (!sessionId) return;

          setIncomingCallSessionId(sessionId);
          setActiveSessionId((prev) => (prev === sessionId ? prev : sessionId));
          queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["active-peer-sessions"] });
          toast.info("Incoming call — join to connect");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Last messages for conversation list
  const { data: lastMessages = {} } = useQuery({
    queryKey: ["peer-last-messages", sessions.map(s => s.id).join(",")],
    queryFn: async () => {
      if (sessions.length === 0) return {};
      const result: Record<string, PeerMessage> = {};
      const promises = sessions.map(async (session) => {
        const { data } = await supabase
          .from("peer_messages")
          .select("id, session_id, sender_id, content_encrypted, created_at")
          .eq("session_id", session.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          result[session.id] = data[0] as PeerMessage;
        }
      });
      await Promise.all(promises);
      return result;
    },
    enabled: sessions.length > 0,
    staleTime: 10_000,
  });

  // Active session selection
  const activeSession = useMemo(() => {
    if (activeSessionId) return sessions.find((s) => s.id === activeSessionId) || null;
    if (initialSessionId) return sessions.find((s) => s.id === initialSessionId) || null;
    return sessions.find((s) => s.status === "active" || s.status === "pending") || null;
  }, [sessions, activeSessionId, initialSessionId]);

  useEffect(() => {
    if (activeSession && !activeSessionId) setActiveSessionId(activeSession.id);
  }, [activeSession, activeSessionId]);

  // Pending sessions for intern (incoming requests)
  const pendingSessions = useMemo(() => {
    if (!isIntern) return [];
    return sessions.filter(
      (s) => s.status === "pending" && !(s as any)._pendingExpired && !(s as any)._expired
    );
  }, [sessions, isIntern]);

  // Student's pending session (waiting for accept)
  const pendingRequest = useMemo(() => {
    if (isIntern) return null;
    return sessions.find(
      (s) => s.status === "pending" && !(s as any)._pendingExpired && !(s as any)._expired
    ) || null;
  }, [sessions, isIntern]);

  // Fetch messages with pagination
  const fetchMessages = useCallback(async (sessionId: string, before?: string) => {
    let query = supabase
      .from("peer_messages")
      .select("id, session_id, sender_id, content_encrypted, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
    if (before) query = query.lt("created_at", before);
    const { data, error } = await query;
    if (error) { console.error("Error fetching messages:", error); return []; }
    return (data as PeerMessage[]).reverse();
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!activeSessionId || messages.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const oldest = messages[0];
      const older = await fetchMessages(activeSessionId, oldest.created_at);
      if (older.length < MESSAGE_PAGE_SIZE) setHasMoreMessages(false);
      if (older.length > 0) setMessages((prev) => [...older, ...prev]);
    } finally { setIsLoadingMore(false); }
  }, [activeSessionId, messages, isLoadingMore, fetchMessages]);

  // Fetch messages for active session + realtime
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); setHasMoreMessages(false); return; }
    const load = async () => {
      const msgs = await fetchMessages(activeSessionId);
      setMessages(msgs);
      setHasMoreMessages(msgs.length >= MESSAGE_PAGE_SIZE);
    };
    load();

    const suffix = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`peer-messages-${activeSessionId}-${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "peer_messages", filter: `session_id=eq.${activeSessionId}` },
        (payload) => {
          const newMsg = payload.new as PeerMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeSessionId, fetchMessages]);

  // Request session — creates as PENDING, notifies intern
  const requestSession = useMutation({
    mutationFn: async (internId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (isIntern) throw new Error("Interns cannot request peer sessions");

      const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      // Check existing fresh session
      const { data: existingSession } = await supabase
        .from("peer_sessions")
        .select("*")
        .eq("student_id", user.id)
        .in("status", ["pending", "active"])
        .gte("created_at", TWO_HOURS_AGO)
        .limit(1)
        .maybeSingle();

      if (existingSession) return existingSession;

      // Check intern availability
      const { data: existingInternSession } = await supabase
        .from("peer_sessions")
        .select("id")
        .eq("intern_id", internId)
        .in("status", ["pending", "active"])
        .gte("created_at", TWO_HOURS_AGO)
        .limit(1)
        .maybeSingle();

      if (existingInternSession) {
        throw new Error("This intern is currently busy. Please try another intern or wait.");
      }

      // ECC deducted on accept (not request) — but check balance upfront
      const { data: balance } = await supabase.rpc("get_credit_balance", { _user_id: user.id });
      if ((balance || 0) < 18) throw new Error("Insufficient credits (18 ECC required)");

      // Insert as PENDING (not active)
      const { data, error } = await supabase
        .from("peer_sessions")
        .insert({ student_id: user.id, intern_id: internId, status: "pending" })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("You or this intern already have an active session.");
        throw error;
      }

      // Notify the intern
      await supabase.from("notifications").insert({
        user_id: internId,
        title: "New Peer Connect Request",
        message: `A student wants to chat with you`,
        type: "peer_request",
        metadata: { session_id: data.id },
      });

      return data;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["active-peer-sessions"] });
      setActiveSessionId(session.id);
      toast.success("Request sent! Waiting for intern to accept...");
    },
    onError: (error) => { toast.error(error.message); },
  });

  // Accept session (intern side)
  const acceptSession = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Get session to find student and deduct credits
      const { data: session } = await supabase
        .from("peer_sessions")
        .select("student_id")
        .eq("id", sessionId)
        .single();

      if (!session) throw new Error("Session not found");

      // Deduct 18 ECC from student on session accept (join event)
      try {
        await spendCredits(18, "Peer Connect session", sessionId);
      } catch (err: any) {
        // If student has insufficient credits, still accept but warn
        console.error("[PeerConnect] Credit deduction on accept failed:", err);
      }

      const { error } = await supabase
        .from("peer_sessions")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("intern_id", user.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: session.student_id,
        title: "Session Accepted!",
        message: "An intern has accepted your chat request. Start chatting now!",
        type: "peer_accepted",
        metadata: { session_id: sessionId },
      });
    },
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["active-peer-sessions"] });
      setActiveSessionId(sessionId);
      toast.success("Session accepted — you can start chatting!");
    },
    onError: (error) => { toast.error(error.message); },
  });

  // Decline session (intern side) — refunds student
  const declineSession = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data: session } = await supabase
        .from("peer_sessions")
        .select("student_id")
        .eq("id", sessionId)
        .single();

      const { error } = await supabase
        .from("peer_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("intern_id", user.id);
      if (error) throw error;

      // No refund needed — ECC wasn't deducted at pending stage
      if (session) {
        await supabase.from("notifications").insert({
          user_id: session.student_id,
          title: "Session Declined",
          message: "The intern couldn't accept your request. No credits were charged. Try another intern!",
          type: "peer_declined",
          metadata: { session_id: sessionId },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["active-peer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
      toast.success("Session declined");
    },
    onError: (error) => { toast.error(error.message); },
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ sessionId, content }: { sessionId: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");
      const session = sessions.find((s) => s.id === sessionId);
      if (session && session.status !== "active") {
        throw new Error("This session has ended. You cannot send messages.");
      }
      const { data, error } = await supabase.from("peer_messages").insert({
        session_id: sessionId,
        sender_id: user.id,
        content_encrypted: content,
      }).select().single();
      if (error) throw error;
      return data as PeerMessage;
    },
    onSuccess: (data) => {
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    },
    onError: (error) => { toast.error(error.message || "Failed to send message"); },
  });

  // Flag/escalate session
  const flagSession = useMutation({
    mutationFn: async ({ sessionId, reason, transcriptSnippet }: { sessionId: string; reason?: string; transcriptSnippet?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error: flagErr } = await supabase
        .from("peer_sessions")
        .update({ is_flagged: true, escalation_note_encrypted: reason || "Intern flagged session" })
        .eq("id", sessionId);
      if (flagErr) throw flagErr;

      const { data: sessionFull } = await supabase
        .from("peer_sessions")
        .select("student_id, intern_id, student:profiles!peer_sessions_student_id_fkey(username), intern:profiles!peer_sessions_intern_id_fkey(username)")
        .eq("id", sessionId)
        .single();

      const studentUsername = (sessionFull as any)?.student?.username || "Unknown";
      const internUsername = (sessionFull as any)?.intern?.username || profile?.username || "Unknown";

      if (sessionFull) {
        const { data: studentProfile } = await supabase
          .from("profiles")
          .select("institution_id")
          .eq("id", sessionFull.student_id)
          .single();

        if (studentProfile?.institution_id) {
          const { data: spocs } = await supabase
            .from("profiles")
            .select("id")
            .eq("institution_id", studentProfile.institution_id)
            .eq("role", "spoc")
            .limit(1);

          if (spocs && spocs.length > 0) {
            const triggerSnippet = JSON.stringify({
              type: "peer_session_flag",
              student_username: studentUsername,
              intern_username: internUsername,
              reason: (reason || "Peer Connect session flagged by intern").substring(0, 500),
              ...(transcriptSnippet ? { transcript_snippet: transcriptSnippet.substring(0, 1000) } : {}),
            });
            await supabase.from("escalation_requests").insert({
              session_id: sessionId,
              spoc_id: spocs[0].id,
              justification_encrypted: reason || "Intern flagged peer session for review",
              escalation_level: 1,
              trigger_timestamp: new Date().toISOString(),
              trigger_snippet: triggerSnippet,
            });
          }
        }
      }

      // Audit log for peer session flagging
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action_type: "peer_session_flagged",
        target_table: "peer_sessions",
        target_id: sessionId,
        metadata: {
          reason: reason || "Intern flagged session",
          has_transcript: !!transcriptSnippet,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
      toast.success("Session flagged for review");
    },
    onError: () => { toast.error("Failed to flag session"); },
  });

  // End session — refund if session never became active (pending only)
  const endSession = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const session = sessions.find((s) => s.id === sessionId);

      const { error } = await supabase
        .from("peer_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;

      // No refund needed — ECC wasn't deducted at pending stage
      // If session was active, ECC already spent — no refund
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["active-peer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
      refreshCredits();
      setActiveSessionId(null);
      toast.success("Session ended");
    },
    onError: (error) => { toast.error(error.message); },
  });

  // Expire a pending session that timed out — refund student
  const expireSession = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const session = sessions.find((s) => s.id === sessionId);
      if (!session || session.status !== "pending") return;

      const { error } = await supabase
        .from("peer_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("status", "pending");
      if (error) throw error;

      // No refund needed — ECC wasn't deducted at pending stage
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["active-peer-sessions"] });
      toast.info("Session request expired");
    },
    onError: (error) => { toast.error(error.message); },
  });

  const hasOpenSession = useMemo(() =>
    sessions.some((s) => (s.status === "active" || s.status === "pending") && !(s as any)._expired && !(s as any)._pendingExpired),
    [sessions]
  );

  // Start a call — create room, save to session, notify other party
  const startCall = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const session = sessions.find((s) => s.id === sessionId);
      if (!session || session.status !== "active") throw new Error("Session is not active");

      // If room already exists, return it
      if (session.room_id) return { roomId: session.room_id };

      const { roomId } = await createVideoSDKRoom();

      // Idempotent: only set room_id if still null
      const { data: updated } = await supabase
        .from("peer_sessions")
        .update({ room_id: roomId })
        .eq("id", sessionId)
        .is("room_id", null)
        .select("room_id")
        .maybeSingle();

      // If another call already set room_id, use theirs
      if (!updated) {
        const { data: reread } = await supabase
          .from("peer_sessions")
          .select("room_id")
          .eq("id", sessionId)
          .single();
        if (reread?.room_id) return { roomId: reread.room_id };
      }

      const finalRoomId = updated?.room_id || roomId;

      // Insert system chat message so both sides see the call indication
      await supabase.from("peer_messages").insert({
        session_id: sessionId,
        sender_id: user.id,
        content_encrypted: "📞 Voice call started",
      });

      // Notify the other party
      const otherUserId = isIntern ? session.student_id : session.intern_id;
      if (otherUserId) {
        await supabase.from("notifications").insert({
          user_id: otherUserId,
          title: "Incoming Call",
          message: "Your peer wants to start a voice call",
          type: "peer_call",
          metadata: { session_id: sessionId, room_id: finalRoomId },
        });
      }

      return { roomId: finalRoomId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-sessions"] });
      toast.success("Call started!");
    },
    onError: (error) => { toast.error(error.message || "Failed to start call"); },
  });

  const clearIncomingCall = useCallback(() => {
    setIncomingCallSessionId(null);
  }, []);

  return {
    interns,
    sessions,
    activeSession,
    messages,
    internStatuses,
    lastMessages,
    hasMoreMessages,
    isLoadingMore,
    loadMoreMessages,
    hasOpenSession,
    pendingSessions,
    pendingRequest,
    incomingCallSessionId,
    clearIncomingCall,
    isLoading: isLoadingInterns || isLoadingSessions,
    activeSessionId,
    setActiveSessionId,
    requestSession: requestSession.mutate,
    sendMessage: sendMessage.mutate,
    endSession: endSession.mutate,
    expireSession: expireSession.mutate,
    flagSession: flagSession.mutate,
    acceptSession: acceptSession.mutate,
    declineSession: declineSession.mutate,
    startCall: startCall.mutate,
    startCallAsync: startCall.mutateAsync,
    isRequesting: requestSession.isPending,
    isSending: sendMessage.isPending,
    isFlagging: flagSession.isPending,
    isAccepting: acceptSession.isPending,
    isDeclining: declineSession.isPending,
    isStartingCall: startCall.isPending,
  };
}
