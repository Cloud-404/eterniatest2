import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Key, Loader2, CheckCircle, XCircle, Clock, Copy, Check, Search, RefreshCw, Shield, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type ResetRequest = {
  id: string;
  username: string;
  reason: string | null;
  status: string;
  admin_note: string | null;
  temp_password: string | null;
  created_at: string;
  resolved_at: string | null;
};

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const PasswordResetManager = () => {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Direct reset state
  const [directUsername, setDirectUsername] = useState("");
  const [directLoading, setDirectLoading] = useState(false);

  const fetchRequests = async () => {
    setIsLoading(true);
    const query = supabase
      .from("password_reset_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to fetch reset requests");
    } else {
      setRequests((data as unknown as ResetRequest[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const handleDirectReset = async () => {
    const username = directUsername.trim().toLowerCase();
    if (!username) {
      toast.error("Please enter a username");
      return;
    }
    setDirectLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("approve-password-reset", {
        body: { action: "direct_reset", username },
      });
      if (error) throw new Error(data?.error || "Failed to reset password");
      if (data?.error) throw new Error(data.error);

      setTempPasswordDialog({ username, password: data.temp_password });
      toast.success(`Password reset for ${username} (${data.role})`);
      setDirectUsername("");
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to reset password");
    } finally {
      setDirectLoading(false);
    }
  };

  const handleApprove = async (id: string, username: string) => {
    setActionLoading(id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-password-reset", {
        body: { request_id: id, action: "approve" },
      });
      if (error) throw new Error(data?.error || "Failed to approve");
      if (data?.error) throw new Error(data.error);

      setTempPasswordDialog({ username, password: data.temp_password });
      toast.success("Password reset approved!");
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialogId) return;
    setActionLoading(rejectDialogId);
    try {
      const { data, error } = await supabase.functions.invoke("approve-password-reset", {
        body: { request_id: rejectDialogId, action: "reject", admin_note: rejectNote },
      });
      if (error) throw new Error(data?.error || "Failed to reject");
      if (data?.error) throw new Error(data.error);

      toast.success("Request rejected");
      setRejectDialogId(null);
      setRejectNote("");
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject request");
    } finally {
      setActionLoading(null);
    }
  };

  const copyPassword = () => {
    if (tempPasswordDialog?.password) {
      navigator.clipboard.writeText(tempPasswordDialog.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredRequests = requests.filter((r) =>
    !searchQuery || r.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-display">Password Reset Requests</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500">
              {pendingCount} pending
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Direct Reset Section */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 mb-3">
          <UserCog className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Direct Password Reset</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Expert · Intern · Therapist</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter staff username..."
            value={directUsername}
            onChange={(e) => setDirectUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !directLoading && handleDirectReset()}
            className="h-9 bg-card text-sm flex-1"
          />
          <Button
            size="sm"
            onClick={handleDirectReset}
            disabled={directLoading || !directUsername.trim()}
            className="gap-1.5 h-9"
          >
            {directLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            Reset Password
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Directly reset password for Expert, Intern, or Therapist accounts. A temporary password will be generated.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-card text-sm"
          />
        </div>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border/50">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No {filter !== "all" ? filter : ""} reset requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className={`p-4 rounded-xl border ${
                req.status === "pending"
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-card border-border/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{req.username}</p>
                    {getStatusBadge(req.status)}
                  </div>
                  {req.reason && (
                    <p className="text-xs text-muted-foreground mb-1.5 line-clamp-2">
                      Reason: {req.reason}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                  </p>
                  {req.admin_note && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Admin note: {req.admin_note}
                    </p>
                  )}
                </div>

                {req.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(req.id, req.username)}
                      disabled={actionLoading === req.id}
                      className="gap-1.5 h-8 text-xs"
                    >
                      {actionLoading === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRejectDialogId(req.id); setRejectNote(""); }}
                      disabled={actionLoading === req.id}
                      className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialogId} onOpenChange={() => setRejectDialogId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Reset Request</DialogTitle>
            <DialogDescription>Optionally provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!!actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog open={!!tempPasswordDialog} onOpenChange={() => { setTempPasswordDialog(null); setCopied(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Password Reset Successful
            </DialogTitle>
            <DialogDescription>
              Share this temporary password with <strong>{tempPasswordDialog?.username}</strong>. They should change it after logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Temporary Password</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-lg font-mono font-bold tracking-wider break-all">
                {tempPasswordDialog?.password}
              </code>
              <Button size="icon" variant="outline" onClick={copyPassword} className="shrink-0 h-9 w-9">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-destructive/80">⚠ This password will only be shown once. Make sure to copy it.</p>
          <DialogFooter>
            <Button onClick={() => { setTempPasswordDialog(null); setCopied(false); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PasswordResetManager;
