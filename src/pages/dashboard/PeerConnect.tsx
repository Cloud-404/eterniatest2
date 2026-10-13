import { useIsMobile } from "@/hooks/use-mobile";
import MobilePeerConnect from "@/components/mobile/MobilePeerConnect";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageCircle, Search, Circle, Send, X, Shield, Users,
  Loader2, AlertCircle, Flag, ChevronUp, CheckCheck, Plus, Clock,
  CheckCircle2, XCircle, Award, Phone, PhoneOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EmojiPicker from "@/components/chat/EmojiPicker";
import VideoCallModal from "@/components/videosdk/VideoCallModal";

import { useAuth } from "@/contexts/AuthContext";
import { usePeerConnect } from "@/hooks/usePeerConnect";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const PENDING_EXPIRY_MS = 2 * 60 * 1000;

// Countdown timer component
const CountdownTimer = ({ createdAt }: { createdAt: string }) => {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      setRemaining(Math.max(0, Math.ceil((PENDING_EXPIRY_MS - elapsed) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <span className="font-mono text-sm tabular-nums">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
};

const PeerConnect = () => {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");
  const { user, profile, creditBalance } = useAuth();
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [callMode, setCallMode] = useState<"audio" | "video" | null>(null);
  const [dismissedCallRoomId, setDismissedCallRoomId] = useState<string | null>(null);

  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    interns, sessions, activeSession, messages: chatMessages, isLoading,
    activeSessionId, setActiveSessionId, requestSession, sendMessage, endSession,
    flagSession, isRequesting, isSending, isFlagging, internStatuses, lastMessages,
    hasMoreMessages, isLoadingMore, loadMoreMessages, hasOpenSession,
    pendingSessions, pendingRequest, acceptSession, declineSession,
    isAccepting, isDeclining, startCall, startCallAsync, isStartingCall,
    incomingCallSessionId, clearIncomingCall,
  } = usePeerConnect(urlSessionId);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const isIntern = profile?.role === "intern";

  // Auto-open new chat panel for students with no open sessions
  useEffect(() => {
    if (!isLoading && !isIntern && !hasOpenSession && sessions.length > 0) {
      setShowNewChat(true);
    }
  }, [isLoading, isIntern, hasOpenSession, sessions.length]);

  const filteredInterns = useMemo(() => {
    if (!debouncedSearch) return interns;
    const q = debouncedSearch.toLowerCase();
    return interns.filter(
      (i) => i.username.toLowerCase().includes(q) || (i.specialty || "").toLowerCase().includes(q)
    );
  }, [interns, debouncedSearch]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      // Pending sessions first
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      const aTime = lastMessages[a.id]?.created_at || a.created_at;
      const bTime = lastMessages[b.id]?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [sessions, lastMessages]);

  const fallbackIncomingSessionId = useMemo(() => {
    return sessions.find((s) => s.status === "active" && !!s.room_id)?.id || null;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!debouncedSearch) return sortedSessions;
    const q = debouncedSearch.toLowerCase();
    return sortedSessions.filter((s) => {
      const partnerName = isIntern
        ? (s as any)?.student?.username || "Student"
        : (s as any)?.intern?.username || "Intern";
      return partnerName.toLowerCase().includes(q);
    });
  }, [sortedSessions, debouncedSearch, isIntern]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    if (incomingCallSessionId && incomingCallSessionId !== activeSessionId) {
      setActiveSessionId(incomingCallSessionId);
    }
  }, [incomingCallSessionId, activeSessionId, setActiveSessionId]);

  useEffect(() => {
    if (!callMode && !incomingCallSessionId && fallbackIncomingSessionId && fallbackIncomingSessionId !== activeSessionId) {
      setActiveSessionId(fallbackIncomingSessionId);
    }
  }, [callMode, incomingCallSessionId, fallbackIncomingSessionId, activeSessionId, setActiveSessionId]);

  const handleSendMessage = useCallback(() => {
    if (!message.trim() || !activeSessionId) return;
    sendMessage({ sessionId: activeSessionId, content: message });
    setMessage("");
  }, [message, activeSessionId, sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  }, [handleSendMessage]);

  const handleStartSession = useCallback((internId: string) => {
    if (creditBalance < 18) {
      toast.error("Insufficient credits. 18 ECC required to connect with a peer.");
      return;
    }
    requestSession(internId);
    setShowNewChat(false);
  }, [creditBalance, requestSession]);

  const handleEndSession = useCallback(() => {
    if (activeSessionId) { endSession(activeSessionId); }
  }, [activeSessionId, endSession]);

  const statusColors: Record<string, string> = { online: "bg-eternia-success", busy: "bg-eternia-warning", offline: "bg-muted-foreground" };

  const getPartnerName = (session: any) => {
    return isIntern
      ? session?.student?.username || "Student"
      : session?.intern?.username || "Intern";
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d");
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: typeof chatMessages }[] = [];
    let currentDate = "";
    for (const msg of chatMessages) {
      const msgDate = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }, [chatMessages]);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  const getSessionStatusLabel = (session: any) => {
    if (session.status === "pending" && !(session as any)._pendingExpired) return "Waiting...";
    if (session.status === "active") return "Active";
    if (session.status === "completed") return "Ended";
    if (session.status === "flagged") return "Flagged";
    return session.status;
  };

  const trainingStatus = (profile as any)?.training_status || "not_started";
  const isTrainingComplete = trainingStatus === "active" || trainingStatus === "completed";

  if (isIntern && !isTrainingComplete) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-eternia-warning/10 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-eternia-warning" />
          </div>
          <h2 className="text-xl font-bold font-display mb-2">Training Required</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Complete all 7 training modules before you can access Peer Connect sessions.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (isMobile) return <MobilePeerConnect />;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)]">
        <div className="flex h-full border border-border rounded-2xl overflow-hidden bg-card">
          {/* Left Panel — Conversation List */}
          <div className="w-[340px] border-r border-border flex flex-col bg-card">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-lg font-bold font-display">Chats</h1>
                {!isIntern && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowNewChat(!showNewChat)}
                    title="New conversation"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-9 bg-muted/50 h-9 text-sm border-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Incoming Requests for Interns */}
            {isIntern && pendingSessions.length > 0 && (
              <div className="border-b border-border bg-primary/5">
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Incoming Requests ({pendingSessions.length})
                  </p>
                </div>
                {pendingSessions.map((session) => (
                  <div key={session.id} className="px-4 py-3 border-t border-border/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{(session as any)?.student?.username || "Student"}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires in <CountdownTimer createdAt={session.created_at} />
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => acceptSession(session.id)}
                        disabled={isAccepting}
                      >
                        {isAccepting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => declineSession(session.id)}
                        disabled={isDeclining}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Chat — Available Interns */}
            {showNewChat && !isIntern && (
              <div className="border-b border-border">
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Interns</p>
                </div>
                <ScrollArea className="max-h-[200px]">
                  {isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : filteredInterns.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No interns available</p>
                  ) : (
                    filteredInterns.map((intern) => {
                      const status = internStatuses[intern.id] || "offline";
                      const hasTrainingBadge = intern.training_status === "active" || intern.training_status === "completed";
                      return (
                        <button
                          key={intern.id}
                          onClick={() => status === "online" && handleStartSession(intern.id)}
                          disabled={status !== "online" || isRequesting || hasOpenSession}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                              <Users className="w-4 h-4 text-white" />
                            </div>
                            <Circle
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusColors[status]} rounded-full border-2 border-card`}
                              fill="currentColor"
                            />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{intern.username}</p>
                              {hasTrainingBadge && (
                                <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{intern.specialty || "General Support"}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {status === "online" ? "Available" : status === "busy" ? "Busy" : "Offline"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </ScrollArea>
                {creditBalance < 18 && (
                  <div className="px-4 py-2 border-t border-border">
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Need 18 ECC to start a session
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Conversation List */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  {!isIntern && (
                    <Button variant="link" className="text-xs mt-1" onClick={() => setShowNewChat(true)}>
                      Start a new chat
                    </Button>
                  )}
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const partnerName = getPartnerName(session);
                  const lastMsg = lastMessages[session.id];
                  const isSelected = activeSessionId === session.id;
                  const isActive = session.status === "active";
                  const isPending = session.status === "pending" && !(session as any)._pendingExpired;
                  const timeStr = lastMsg ? formatMessageTime(lastMsg.created_at) : formatMessageTime(session.created_at);

                  return (
                    <button
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors border-b border-border/30 ${
                        isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                          isIntern
                            ? "bg-gradient-to-br from-blue-500 to-cyan-500"
                            : "bg-gradient-to-br from-accent to-primary"
                        }`}>
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        {isActive && (
                          <Circle
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-eternia-success rounded-full border-2 border-card"
                            fill="currentColor"
                          />
                        )}
                        {isPending && (
                          <Clock
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-eternia-warning border-2 border-card rounded-full bg-card"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-semibold truncate">{partnerName}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{timeStr}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {lastMsg?.sender_id === user?.id && (
                            <CheckCheck className="w-3 h-3 text-primary shrink-0" />
                          )}
                          <p className="text-xs text-muted-foreground truncate">
                            {isPending
                              ? (isIntern ? "Incoming request" : "Waiting for intern...")
                              : lastMsg
                                ? lastMsg.content_encrypted.substring(0, 40) + (lastMsg.content_encrypted.length > 40 ? "..." : "")
                                : isActive ? "Session active" : session.status === "completed" ? "Session ended" : getSessionStatusLabel(session)
                            }
                          </p>
                        </div>
                      </div>
                      {session.is_flagged && (
                        <Flag className="w-3.5 h-3.5 text-destructive shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Right Panel — Chat Area */}
          <div className="flex-1 flex flex-col">
            {activeSessionId && activeSession ? (
              <>
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isIntern ? "bg-gradient-to-br from-blue-500 to-cyan-500" : "bg-gradient-to-br from-accent to-primary"
                    }`}>
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{getPartnerName(activeSession)}</h3>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Circle className={`w-2 h-2 ${
                          activeSession.status === "active" ? "text-eternia-success"
                          : activeSession.status === "pending" ? "text-eternia-warning"
                          : "text-muted-foreground"
                        }`} fill="currentColor" />
                        {getSessionStatusLabel(activeSession)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {activeSession.status === "active" && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-primary"
                        title="Start voice call"
                        disabled={isStartingCall}
                        onClick={async () => {
                          if (!activeSessionId) return;
                          if (activeSession.room_id) {
                            setCallMode("audio");
                          } else {
                            try {
                              await startCallAsync(activeSessionId);
                              setCallMode("audio");
                            } catch {
                              // error toast handled by mutation
                            }
                          }
                        }}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                    {activeSession.status === "active" && activeSession.room_id && !callMode && (
                      <Button
                        variant="outline" size="sm" className="h-8 text-xs gap-1 text-primary border-primary/30"
                        onClick={() => {
                          clearIncomingCall();
                          setCallMode("audio");
                        }}
                      >
                        <Phone className="w-3 h-3" /> Join Call
                      </Button>
                    )}
                    {isIntern && activeSession.status === "active" && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-eternia-warning"
                        title="Flag session" disabled={isFlagging || activeSession?.is_flagged}
                        onClick={() => flagSession({ sessionId: activeSessionId, reason: "Intern flagged during session" })}
                      >
                        <Flag className={`w-4 h-4 ${activeSession?.is_flagged ? "fill-current" : ""}`} />
                      </Button>
                    )}
                    {activeSession.status === "active" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleEndSession}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Pending state — student waiting for acceptance */}
                {activeSession.status === "pending" && !isIntern && !(activeSession as any)._pendingExpired && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background/50">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                      <Clock className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold font-display mb-1">Waiting for intern to accept...</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your request has been sent. The intern will accept shortly.
                    </p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Expires in </span>
                      <CountdownTimer createdAt={activeSession.created_at} />
                    </div>
                     <p className="text-xs text-muted-foreground mt-4">18 ECC will be refunded if the request expires</p>
                  </div>
                )}

                {/* Pending state — intern sees accept/decline */}
                {activeSession.status === "pending" && isIntern && !(activeSession as any)._pendingExpired && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background/50">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Users className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold font-display mb-1">New Chat Request</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>{(activeSession as any)?.student?.username || "A student"}</strong> wants to chat with you
                    </p>
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Expires in </span>
                      <CountdownTimer createdAt={activeSession.created_at} />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => acceptSession(activeSessionId)} disabled={isAccepting}>
                        {isAccepting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Accept Session
                      </Button>
                      <Button variant="outline" onClick={() => declineSession(activeSessionId)} disabled={isDeclining}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  </div>
                )}

                {/* Expired pending */}
                {(activeSession as any)._pendingExpired && (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background/50">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Clock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">Request Expired</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isIntern ? "This request has expired." : "The intern didn't respond in time. Your ECC will be refunded."}
                    </p>
                    {!isIntern && (
                      <Button onClick={() => { setActiveSessionId(null); setShowNewChat(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Try Another Intern
                      </Button>
                    )}
                  </div>
                )}

                {/* Incoming call banner */}
                {activeSession.status === "active" && activeSession.room_id && !callMode && activeSession.room_id !== dismissedCallRoomId && (
                  <div className="mx-4 mt-3 flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Incoming Call</p>
                      <p className="text-xs text-muted-foreground">Voice call in progress — tap Join to connect</p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        clearIncomingCall();
                        setCallMode("audio");
                      }}
                    >
                      Join
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-8 w-8 p-0"
                      onClick={() => {
                        clearIncomingCall();
                        setDismissedCallRoomId(activeSession.room_id);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Active chat messages */}
                {activeSession.status === "active" && (
                  <>
                    <div className="flex-1 overflow-y-auto px-4 py-3 bg-background/50">
                      {hasMoreMessages && (
                        <div className="text-center mb-3">
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={loadMoreMessages} disabled={isLoadingMore}>
                            {isLoadingMore ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ChevronUp className="w-3 h-3 mr-1" />}
                            Load earlier messages
                          </Button>
                        </div>
                      )}
                      {groupedMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <Shield className="w-8 h-8 mb-2 opacity-30" />
                          <p className="text-sm">Session started — say hello! 👋</p>
                          <p className="text-xs mt-1 opacity-60">All messages are anonymous</p>
                        </div>
                      ) : (
                        groupedMessages.map((group) => (
                          <div key={group.date}>
                            <div className="flex items-center justify-center my-4">
                              <span className="px-3 py-1 rounded-full bg-muted text-[10px] text-muted-foreground font-medium">
                                {getDateLabel(group.date)}
                              </span>
                            </div>
                            {group.messages.map((msg) => {
                              const isMine = msg.sender_id === user?.id;
                              return (
                                <div key={msg.id} className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[65%] px-3 py-2 rounded-2xl ${
                                    isMine
                                      ? "bg-primary text-primary-foreground rounded-br-sm"
                                      : "bg-card border border-border rounded-bl-sm"
                                  }`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content_encrypted}</p>
                                    <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                      <span className="text-[10px]">{format(new Date(msg.created_at), "h:mm a")}</span>
                                      {isMine && <CheckCheck className="w-3 h-3" />}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Bar */}
                    <div className="px-4 py-3 border-t border-border bg-card">
                      <div className="flex items-end gap-2">
                        <EmojiPicker onSelect={(emoji) => setMessage((prev) => prev + emoji)} />
                        <Textarea
                          placeholder="Type a message..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="flex-1 bg-muted/50 text-sm border-none resize-none min-h-[40px] max-h-[120px]"
                          rows={1}
                        />
                        <Button
                          size="icon"
                          className="bg-primary text-primary-foreground h-10 w-10 rounded-full shrink-0"
                          onClick={handleSendMessage}
                          disabled={!message.trim() || isSending}
                        >
                          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Completed session */}
                {activeSession.status === "completed" && !(activeSession as any)._pendingExpired && (
                  <>
                    <div className="flex-1 overflow-y-auto px-4 py-3 bg-background/50">
                      {groupedMessages.map((group) => (
                        <div key={group.date}>
                          <div className="flex items-center justify-center my-4">
                            <span className="px-3 py-1 rounded-full bg-muted text-[10px] text-muted-foreground font-medium">
                              {getDateLabel(group.date)}
                            </span>
                          </div>
                          {group.messages.map((msg) => {
                            const isMine = msg.sender_id === user?.id;
                            return (
                              <div key={msg.id} className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[65%] px-3 py-2 rounded-2xl ${
                                  isMine
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-card border border-border rounded-bl-sm"
                                }`}>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content_encrypted}</p>
                                  <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                    <span className="text-[10px]">{format(new Date(msg.created_at), "h:mm a")}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="px-4 py-3 border-t border-border bg-muted/30 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">This session has ended</p>
                      {!isIntern && (
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowNewChat(true)}>
                          <Plus className="w-3 h-3 mr-1" /> Start New Chat
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background/30">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                  <MessageCircle className="w-10 h-10 text-primary/50" />
                </div>
                <h3 className="text-lg font-semibold font-display mb-1">Peer Connect</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {isIntern
                    ? "Select a student conversation from the left panel."
                    : "Select a conversation or start a new chat with an available intern."
                  }
                </p>
                {!isIntern && (
                  <Button className="mt-4" onClick={() => setShowNewChat(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Start New Chat
                  </Button>
                )}
                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" />
                   <span>End-to-end anonymous · 18 ECC per session</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Video/Audio Call Modal */}
        {callMode && activeSessionId && (
          <VideoCallModal
            isOpen={!!callMode}
            onClose={() => setCallMode(null)}
            participantName={profile?.username || "Anonymous"}
            participantId={profile?.id || user?.id}
            mode={callMode}
            existingRoomId={activeSession?.room_id || undefined}
            sessionId={activeSessionId}
            sessionType="peer"
            enableMonitoring={isIntern}
            onRiskDetected={isIntern ? (level, snippet) => {
              if (level >= 2 && activeSessionId) {
                flagSession({ sessionId: activeSessionId, reason: `AI auto-detected risk L${level}`, transcriptSnippet: snippet });
              }
            } : undefined}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default PeerConnect;
