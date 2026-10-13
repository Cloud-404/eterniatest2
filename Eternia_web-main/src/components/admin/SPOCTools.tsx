import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Coins, Users, Copy, Check, Loader2,
  BarChart3, TrendingUp, Activity, UserPlus, RefreshCw,
  Download, QrCode,
} from "lucide-react";

const SPOCTools = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [creditAmount, setCreditAmount] = useState("50");
  const [copiedQR, setCopiedQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const { data: qrData, isLoading: qrLoading, error: qrError, refetch: regenerateQR } = useQuery({
    queryKey: ["spoc-qr", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-spoc-qr");
      if (error) {
        // Try to extract real error from response context
        try {
          const ctx = await (error as any).context?.json?.();
          if (ctx?.error) throw new Error(ctx.error);
        } catch (e) {
          if (e instanceof Error && e.message !== error.message) throw e;
        }
        throw new Error(error.message || "Failed to generate QR");
      }
      if (data?.error) throw new Error(data.error);
      return data as { qr_payload: string };
    },
    enabled: !!user && profile?.role === "spoc",
    staleTime: Infinity,
    retry: 2,
    retryDelay: 1000,
  });

  const qrPayload = qrData?.qr_payload || "";

  const { data: institutionStudents = [] } = useQuery({
    queryKey: ["institution-students", profile?.institution_id],
    queryFn: async () => {
      if (!profile?.institution_id) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_active")
        .eq("institution_id", profile.institution_id)
        .eq("role", "student");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.institution_id,
  });

  const { data: analytics } = useQuery({
    queryKey: ["spoc-analytics", profile?.institution_id],
    queryFn: async () => {
      if (!profile?.institution_id) return null;
      const { count: totalStudents } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("institution_id", profile.institution_id)
        .eq("role", "student");
      const { count: activeStudents } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("institution_id", profile.institution_id)
        .eq("role", "student")
        .eq("is_active", true);
      const { count: totalSessions } = await supabase
        .from("peer_sessions")
        .select("*", { count: "exact", head: true });
      const { count: flaggedCount } = await supabase
        .from("blackbox_entries")
        .select("*", { count: "exact", head: true })
        .gt("ai_flag_level", 1);
      return {
        totalStudents: totalStudents || 0,
        activeStudents: activeStudents || 0,
        totalSessions: totalSessions || 0,
        flaggedCount: flaggedCount || 0,
      };
    },
    enabled: !!profile?.institution_id,
  });

  const bulkGrantCredits = useMutation({
    mutationFn: async () => {
      if (!user || !profile?.institution_id) throw new Error("Not authorized");
      const amount = parseInt(creditAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
      const { data, error } = await supabase.functions.invoke("grant-credits", {
        body: {
          bulk: true,
          institution_id: profile.institution_id,
          amount,
          notes: "Institutional grant by SPOC",
        },
      });
      if (error) throw new Error(error.message || "Failed to grant credits");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(`Granted ${data.amount} ECC to ${data.count} students`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to grant credits"),
  });

  const copyQRCode = () => {
    if (!qrPayload) { toast.error("No QR code generated yet"); return; }
    navigator.clipboard.writeText(qrPayload);
    setCopiedQR(true);
    toast.success("SPOC QR payload copied!");
    setTimeout(() => setCopiedQR(false), 2000);
  };

  const downloadQR = useCallback(() => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 600;
    canvas.width = size;
    canvas.height = size;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "hsl(222, 47%, 6%)";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.download = "eternia-spoc-qr.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success("QR code downloaded!");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  const activeCount = institutionStudents.filter((s) => s.is_active).length;

  return (
    <div className="space-y-4">
      {/* Analytics */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Institution Analytics
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Students", value: analytics?.totalStudents || 0, icon: Users, color: "text-primary" },
            { label: "Active", value: analytics?.activeStudents || 0, icon: Activity, color: "text-emerald-500" },
            { label: "Sessions", value: analytics?.totalSessions || 0, icon: TrendingUp, color: "text-amber-500" },
            { label: "AI Flags", value: analytics?.flaggedCount || 0, icon: Activity, color: "text-destructive" },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-xl bg-card border border-border/50">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color} mb-1`} />
              <p className="text-lg font-bold leading-none">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 italic">
          All data is aggregated and anonymous.
        </p>
      </div>

      {/* QR Code — Large, branded */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <QrCode className="w-4 h-4 text-primary" />
            SPOC Verification QR
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Regenerable
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Students scan this QR to verify your institution during onboarding. No temp IDs needed.
        </p>

        {/* QR Display */}
        <div className="flex flex-col items-center">
          <div
            ref={qrRef}
            className="relative p-5 rounded-2xl bg-background border-2 border-primary/15 shadow-lg shadow-primary/5"
          >
            {qrLoading ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            ) : qrPayload ? (
              <QRCodeSVG
                value={qrPayload}
                size={200}
                bgColor="transparent"
                fgColor="hsl(243, 100%, 69%)"
                level="H"
                includeMargin={false}
              />
            ) : (
              <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-2">
                <QrCode className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground text-center px-4">
                  {qrError?.message || "Failed to generate QR code"}
                </p>
                <Button size="sm" variant="outline" className="mt-1 text-xs h-7" onClick={() => regenerateQR()}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Try Again
                </Button>
              </div>
            )}

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
          </div>

          <p className="text-[11px] font-medium text-muted-foreground mt-3">
            Scan to join • Eternia Verified
          </p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" onClick={copyQRCode} disabled={!qrPayload}>
            {copiedQR ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            Copy
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" onClick={downloadQR} disabled={!qrPayload}>
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" onClick={() => regenerateQR()} disabled={qrLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Bulk Credit Allocation */}
      <div className="p-3 rounded-xl bg-card border border-border/50 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" />
          Bulk Credit Allocation
        </h3>
        <p className="text-xs text-muted-foreground">
          Grant ECC credits to all {activeCount} active students.
        </p>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Credits per student</label>
          <Input
            type="number"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            min="1"
            max="500"
            className="h-9"
          />
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 text-xs">
          <p className="text-muted-foreground">
            Total: <span className="font-semibold text-foreground">
              {(parseInt(creditAmount) || 0) * activeCount} ECC
            </span>
          </p>
        </div>
        <Button
          className="w-full gap-2 h-9 text-xs"
          onClick={() => bulkGrantCredits.mutate()}
          disabled={bulkGrantCredits.isPending || !creditAmount}
        >
          {bulkGrantCredits.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserPlus className="w-3.5 h-3.5" />
          )}
          Allocate Credits
        </Button>
      </div>
    </div>
  );
};

export default SPOCTools;
