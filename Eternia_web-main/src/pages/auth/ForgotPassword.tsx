import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, User, Key, Lock, Eye, EyeOff, Loader2, CheckCircle, Shield, Send, Search, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import EterniaLogo from "@/components/EterniaLogo";
import { motion } from "framer-motion";

type FlowMode = "self" | "admin";

/* ─── Self‑Recovery Sub‑Component ─── */
const SelfRecovery = ({ navigate }: { navigate: ReturnType<typeof useNavigate> }) => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchHints = async () => {
    const trimmed = username.trim();
    if (!trimmed) { toast.error("Please enter your username"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-recovery-hints", {
        body: { username: trimmed },
      });
      if (error) throw new Error(data?.error || "Failed to fetch hints");
      if (data?.error) throw new Error(data.error);
      setHints(data.hints);
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "Username not found or no recovery credentials set up");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndProceed = () => {
    if (answers.some((a) => !a.trim())) { toast.error("Please answer all security questions"); return; }
    setStep(3);
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setIsLoading(true);
    try {
      const fragmentPairs = hints.map((hint, i) => ({ hint, answer: answers[i] }));
      const { data, error } = await supabase.functions.invoke("recover-password", {
        body: { username: username.trim(), fragment_pairs: fragmentPairs, new_password: newPassword },
      });
      if (error) throw new Error(data?.error || "Failed to reset password");
      if (data?.error) throw new Error(data.error);
      toast.success("Password reset successfully! Please sign in.");
      navigate("/login");
    } catch (e: any) {
      toast.error(e.message || "Recovery credentials do not match");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{s}</div>
            {s < 3 && <div className={`flex-1 h-1 rounded transition-colors ${step > s ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Username */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text" placeholder="Enter your username" value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-11 h-12 rounded-xl bg-card/50 border-border/40 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleFetchHints()}
                disabled={isLoading}
              />
            </div>
          </div>
          <Button onClick={handleFetchHints} disabled={isLoading || !username.trim()} className="w-full h-12 rounded-xl text-sm font-semibold gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
          </Button>
        </div>
      )}

      {/* Step 2: Security Questions */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Answer Your Security Questions</span>
            </div>
            {hints.map((hint, i) => (
              <div key={i} className="space-y-1">
                <label className="text-xs text-muted-foreground">{hint}</label>
                <Input placeholder="Your answer" value={answers[i]}
                  onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }}
                  className="h-10 rounded-xl bg-card/50 border-border/40 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl text-sm">Back</Button>
            <Button onClick={handleVerifyAndProceed} disabled={answers.some((a) => !a.trim())} className="flex-1 h-12 rounded-xl text-sm font-semibold gap-2">
              Verify <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: New Password */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-11 pr-11 h-12 rounded-xl bg-card/50 border-border/40 text-sm"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type={showPassword ? "text" : "password"} placeholder="Confirm your password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-11 h-12 rounded-xl bg-card/50 border-border/40 text-sm"
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-xl text-sm">Back</Button>
            <Button onClick={handleResetPassword} disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword} className="flex-1 h-12 rounded-xl text-sm font-semibold gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" />Reset Password</>}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

/* ─── Admin Reset Request Sub‑Component ─── */
const AdminResetRequest = () => {
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Check status state
  const [checkId, setCheckId] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ status: string; temp_password?: string; admin_note?: string } | null>(null);

  const handleSubmit = async () => {
    const trimmed = username.trim();
    if (!trimmed) { toast.error("Please enter your username"); return; }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("password_reset_requests" as any)
        .insert({ username: trimmed, reason: reason.trim() || null } as any)
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      setSubmittedId((data as any)?.id);
      toast.success("Reset request submitted successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckStatus = async () => {
    const trimmed = checkId.trim();
    if (!trimmed) { toast.error("Please enter a request ID"); return; }
    setIsChecking(true);
    setCheckResult(null);
    try {
      const { data, error } = await supabase
        .from("password_reset_requests" as any)
        .select("status, temp_password, admin_note")
        .eq("id", trimmed)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) { toast.error("Request not found"); setIsChecking(false); return; }
      setCheckResult(data as any);
    } catch (e: any) {
      toast.error(e.message || "Failed to check status");
    } finally {
      setIsChecking(false);
    }
  };

  if (submittedId) {
    return (
      <div className="space-y-4">
        <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-semibold text-sm mb-1">Request Submitted</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Your password reset request has been sent to an admin for review. Save this request ID to check the status later.
          </p>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Request ID</p>
            <code className="text-sm font-mono font-bold break-all">{submittedId}</code>
          </div>
        </div>
        <Button variant="outline" onClick={() => { setSubmittedId(null); setUsername(""); setReason(""); }} className="w-full h-12 rounded-xl text-sm">
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Submit request */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground">
            If you don't have recovery credentials set up, you can request an admin to reset your password. An admin will review and approve your request.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">Username</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="text" placeholder="Enter your username" value={username}
              onChange={(e) => setUsername(e.target.value)} disabled={isSubmitting}
              className="pl-11 h-12 rounded-xl bg-card/50 border-border/40 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">Reason (Optional)</label>
          <Textarea placeholder="Why do you need a password reset?" value={reason}
            onChange={(e) => setReason(e.target.value)} disabled={isSubmitting}
            className="min-h-[80px] rounded-xl bg-card/50 border-border/40 text-sm resize-none"
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting || !username.trim()} className="w-full h-12 rounded-xl text-sm font-semibold gap-2">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />Submit Request</>}
        </Button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or check existing request</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Check status */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">Check Request Status</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="text" placeholder="Enter your request ID" value={checkId}
              onChange={(e) => setCheckId(e.target.value)} disabled={isChecking}
              className="pl-11 h-12 rounded-xl bg-card/50 border-border/40 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCheckStatus()}
            />
          </div>
        </div>
        <Button variant="outline" onClick={handleCheckStatus} disabled={isChecking || !checkId.trim()} className="w-full h-12 rounded-xl text-sm gap-2">
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" />Check Status</>}
        </Button>

        {checkResult && (
          <div className={`p-4 rounded-xl border ${
            checkResult.status === "approved" ? "bg-emerald-500/5 border-emerald-500/20" :
            checkResult.status === "rejected" ? "bg-destructive/5 border-destructive/20" :
            "bg-amber-500/5 border-amber-500/20"
          }`}>
            {checkResult.status === "pending" && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-semibold text-sm">Pending Review</p>
                  <p className="text-xs text-muted-foreground">An admin will review your request soon.</p>
                </div>
              </div>
            )}
            {checkResult.status === "approved" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <p className="font-semibold text-sm">Approved!</p>
                </div>
                {checkResult.temp_password && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Your Temporary Password</p>
                    <code className="text-lg font-mono font-bold tracking-wider break-all">{checkResult.temp_password}</code>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Please log in and change your password immediately.</p>
              </div>
            )}
            {checkResult.status === "rejected" && (
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Request Rejected</p>
                  {checkResult.admin_note && (
                    <p className="text-xs text-muted-foreground mt-1">Reason: {checkResult.admin_note}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">You may submit a new request or try self-recovery.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main ForgotPassword Page ─── */
const ForgotPassword = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<FlowMode>("self");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-eternia-teal/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-eternia-lavender/10 rounded-full blur-[80px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[440px] relative z-10"
      >
        <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>

        <div className="flex items-center mb-6">
          <EterniaLogo size={44} />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-display mb-1.5">Reset Password</h1>
          <p className="text-muted-foreground text-sm">
            {mode === "self" ? "Use your recovery credentials to reset your password" : "Request an admin to reset your password"}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-xl bg-muted/50 border border-border/40 p-1 mb-6">
          <button
            onClick={() => setMode("self")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              mode === "self" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Key className="w-3.5 h-3.5" /> Self Recovery
          </button>
          <button
            onClick={() => setMode("admin")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              mode === "admin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Request Admin Reset
          </button>
        </div>

        {mode === "self" ? <SelfRecovery navigate={navigate} /> : <AdminResetRequest />}

        {/* Trust footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-muted-foreground/50">
          <div className="flex items-center gap-1"><Shield className="w-3 h-3" /><span>Encrypted</span></div>
          <span>•</span><span>Anonymous</span><span>•</span><span>DPDP</span>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
