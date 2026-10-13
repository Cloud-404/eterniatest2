import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, ArrowLeft, Loader2, Shield, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import EterniaLogo from "@/components/EterniaLogo";
import { motion } from "framer-motion";

const InstitutionCode = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter your institution code");
      return;
    }
    if (code.length < 6) {
      toast.error("Invalid institution code. Please check with your institution.");
      return;
    }
    setIsLoading(true);
    try {
      const { data: institution, error } = await supabase
        .from("institutions")
        .select("id, name, is_active")
        .eq("eternia_code_hash", code)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (institution) {
        toast.success(`Institution verified: ${institution.name}`);
        sessionStorage.setItem("eternia_institution_code", code);
        sessionStorage.setItem("eternia_institution_id", institution.id);
        navigate("/qr-scan");
      } else {
        toast.error("Invalid institution code. Please check with your institution.");
      }
    } catch {
      toast.error("Failed to verify institution code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-card/30 border-r border-border/20 flex-col items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-eternia-teal/15 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-eternia-lavender/15 rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-sm text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <EterniaLogo size={80} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold font-display mb-3"
          >
            Join your institution on Eternia
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-muted-foreground text-sm leading-relaxed mb-8"
          >
            Get access to anonymous counseling, peer support, and emotional wellbeing tools provided by your college.
          </motion.p>

          {/* Steps preview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-3 text-left"
          >
            {[
              { step: "1", label: "Enter institution code", desc: "Provided by your college", active: true },
              { step: "2", label: "Scan QR for verification", desc: "Quick identity proof" },
              { step: "3", label: "Create anonymous account", desc: "No real info needed" },
            ].map((item) => (
              <div key={item.step} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${item.active ? 'bg-primary/8 border border-primary/15' : 'bg-card/30 border border-border/20'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${item.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {item.step}
                </div>
                <div>
                  <p className={`text-sm font-medium ${item.active ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</p>
                  <p className="text-xs text-muted-foreground/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 flex justify-center gap-6 text-xs text-muted-foreground/60"
          >
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>100% Anonymous</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>50+ Institutions</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        <div className="absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute top-1/4 right-0 w-64 h-64 bg-eternia-teal/10 rounded-full blur-[80px]" />
          <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-eternia-lavender/10 rounded-full blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[400px] relative z-10"
        >
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          {/* Mobile logo + progress */}
          <div className="flex items-center mb-5 lg:hidden">
            <EterniaLogo size={44} />
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-1.5 rounded-full bg-primary" />
            <div className="flex-1 h-1.5 rounded-full bg-muted" />
            <div className="flex-1 h-1.5 rounded-full bg-muted" />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold font-display mb-1.5">Enter Institution Code</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your college provides a unique code for access. Contact your institution if you don't have one.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">
                Institution Code
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. IITB2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="pl-11 h-12 rounded-xl bg-card/50 border-border/40 focus:border-primary/50 focus:ring-primary/20 transition-all text-sm tracking-widest uppercase font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold gap-2 shadow-lg shadow-primary/15 transition-all active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/30 text-center">
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Info card */}
          <div className="mt-6 p-4 rounded-xl bg-card/40 border border-border/25">
            <h3 className="font-semibold text-xs mb-1.5 flex items-center gap-1.5 text-foreground/80">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              What is an Institution Code?
            </h3>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              A unique code provided by your college when they partner with Eternia. It ensures only verified students can access the platform.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default InstitutionCode;
