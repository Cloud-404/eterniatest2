import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, QrCode, Shield, CheckCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Html5Qrcode } from "html5-qrcode";

const QRScan = () => {
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [useManual, setUseManual] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner-container";

  // Guard: ensure institution code step was completed first
  useEffect(() => {
    const instId = sessionStorage.getItem("eternia_institution_id");
    if (!instId) {
      toast.error("Please enter your institution code first");
      navigate("/institution-code");
    }
  }, [navigate]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const parseQRPayload = (input: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(input.trim());
      if (parsed.institution_id && parsed.spoc_id && parsed.timestamp && parsed.signature) {
        return { type: "hmac", ...parsed };
      }
      if (parsed.temp_id && parsed.temp_password && parsed.institution_id) {
        return { type: "temp", ...parsed };
      }
    } catch {
      // Not valid JSON
    }
    return null;
  };

  const verifyPayload = async (rawPayload: string) => {
    setIsVerifying(true);
    try {
      const parsed = parseQRPayload(rawPayload);
      if (!parsed) {
        toast.error("Invalid QR code format. Please scan a valid SPOC QR code.");
        setIsVerifying(false);
        return;
      }

      if (parsed.type === "hmac") {
        const { data, error } = await supabase.functions.invoke("validate-spoc-qr", {
          body: { qr_payload: rawPayload },
        });
        if (error || !data?.valid) {
          toast.error(data?.error || "Invalid or expired QR code.");
        } else {
          sessionStorage.setItem("eternia_spoc_verified", "true");
          sessionStorage.setItem("eternia_institution_id", data.institution_id);
          toast.success(`Verified: ${data.institution_name}`);
          navigate("/register");
        }
      } else {
        const { data, error } = await supabase.functions.invoke("verify-temp-credentials", {
          body: { temp_username: parsed.temp_id, temp_password: parsed.temp_password },
        });
        if (error || !data?.valid) {
          toast.error(data?.error || "Invalid or expired QR code. Please ask your Grievance Officer for a new one.");
        } else {
          sessionStorage.setItem("eternia_spoc_verified", "true");
          sessionStorage.setItem("eternia_institution_id", data.institution_id);
          sessionStorage.setItem("eternia_temp_credential_id", data.temp_credential_id);
          toast.success(`Verified: ${data.institution_name}`);
          navigate("/register");
        }
      }
    } catch {
      toast.error("Verification failed. Please check your connection and try again.");
    }
    setIsVerifying(false);
  };

  const isInsideIframe = () => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  };

  const startScanner = async () => {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const inIframe = isInsideIframe();
      if (inIframe) {
        toast.error(
          "Camera access is blocked inside this preview. Please open this page directly in your browser.",
          { duration: 6000 }
        );
      } else if (location.protocol !== "https:" && location.hostname !== "localhost") {
        toast.error(
          "Camera requires a secure (HTTPS) connection. Please access this page via HTTPS.",
          { duration: 6000 }
        );
      } else {
        toast.error("Camera is not available on this device. Please enter the code manually.");
      }
      setUseManual(true);
      return;
    }

    setIsScanning(true);
    try {
      // Enumerate cameras first to give a better error
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        toast.error("No camera detected on this device. Please enter the code manually.");
        setIsScanning(false);
        setUseManual(true);
        return;
      }

      // Prefer back camera
      const backCamera = cameras.find(
        (c) => /back|rear|environment/i.test(c.label)
      );

      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      const cameraConfig = backCamera
        ? { deviceId: { exact: backCamera.id } }
        : { facingMode: "environment" as const };

      await scanner.start(
        cameraConfig,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          await stopScanner();
          verifyPayload(decodedText);
        },
        () => {
          // ignore scan failures (no QR in frame)
        }
      );
    } catch (err: any) {
      console.error("[QRScan] Camera error:", err);
      setIsScanning(false);
      scannerRef.current = null;

      if (err?.name === "NotAllowedError" || /permission/i.test(err?.message || "")) {
        toast.error(
          "Camera permission denied. Please allow camera access in your browser settings and try again.",
          { duration: 6000 }
        );
      } else if (err?.name === "NotFoundError" || /no.*camera/i.test(err?.message || "")) {
        toast.error("No camera found. Please enter the code manually.");
      } else if (err?.name === "NotReadableError") {
        toast.error("Camera is in use by another app. Close other apps using the camera and try again.");
      } else {
        toast.error("Could not access camera. Please enter the code manually.");
      }
      setUseManual(true);
    }
  };

  const handleStopAndManual = async () => {
    await stopScanner();
    setUseManual(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error("Please enter the QR code data");
      return;
    }
    await verifyPayload(manualCode.trim());
  };

  return (
    <div className="min-h-screen min-h-dvh bg-background flex items-start sm:items-center justify-center px-4 py-6 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-eternia-teal/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-eternia-lavender/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-eternia text-background text-xs font-semibold">
            1
          </div>
          <div className="flex-1 h-1 rounded bg-muted" />
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
            2
          </div>
        </div>

        <div className="glass rounded-2xl p-4 sm:p-6">
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-bold font-display mb-1">SPOC Verification</h1>
            <p className="text-sm text-muted-foreground">
              Scan the QR code provided by your institution's Grievance Officer.
            </p>
          </div>

          {!useManual ? (
            <div className="space-y-4">
              {/* Scanner container */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted/20 mx-auto" style={{ maxHeight: 280 }}>
                <div id={scannerContainerId} className="w-full" />
                {!isScanning && (
                  <div className="aspect-square max-h-[240px] flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-eternia flex items-center justify-center">
                      <QrCode className="w-8 h-8 text-background" />
                    </div>
                    <p className="text-xs text-muted-foreground text-center px-6">
                      Position QR code within the scanner
                    </p>
                  </div>
                )}
              </div>

              {isScanning ? (
                <Button
                  onClick={handleStopAndManual}
                  variant="outline"
                  className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                >
                  <X className="w-4 h-4" />
                  Stop Scanner
                </Button>
              ) : (
                <Button
                  onClick={startScanner}
                  disabled={isVerifying}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold gap-2 active:scale-[0.98] transition-all"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Scan QR Code
                    </>
                  )}
                </Button>
              )}

              <button
                onClick={() => { stopScanner(); setUseManual(true); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Can't scan? Enter code manually
              </button>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  QR Code Data
                </label>
                <div className="relative">
                  <Shield className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    placeholder='Paste QR code data here'
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full pl-10 min-h-[80px] rounded-xl bg-card/50 border border-border/40 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={isVerifying}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Ask your Grievance Officer for the QR code or paste the data.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold gap-2 active:scale-[0.98] transition-all"
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Verify & Continue
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setUseManual(false)}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Back to QR scanner
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border">
          <h3 className="font-semibold text-xs mb-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Why is this needed?
          </h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            This verifies you are a legitimate student of the partnered institution. Each QR code can only be used once.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScan;
