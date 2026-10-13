import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, User, Lock, Eye, EyeOff, ArrowLeft, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import EterniaLogo from "@/components/EterniaLogo";
import { motion } from "framer-motion";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const Login = () => {
  const { signIn, user, profile, isLoading: isAuthLoading, profileError } = useAuth();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const isSubmitting = isLoading || isAuthLoading;

  // If already logged in with profile, redirect immediately
  if (user && profile) {
    const role = profile.role;
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "spoc") return <Navigate to="/dashboard/spoc" replace />;
    if (role === "expert") return <Navigate to="/dashboard/expert" replace />;
    if (role === "therapist") return <Navigate to="/dashboard/therapist" replace />;
    if (role === "intern") return <Navigate to="/dashboard/intern" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (user && !profile) {
    if (profileError) {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-eternia flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-background" />
          </div>
          <p className="text-sm text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingMins = Math.ceil((lockoutUntil - Date.now()) / 60000);
      toast.error(`Too many failed attempts. Try again in ${remainingMins} minute(s).`);
      return;
    }
    
    const username = formData.username.trim();
    if (!username || !formData.password) {
      toast.error("Please enter both username and password");
      return;
    }
    if (username.length > 100 || formData.password.length > 128) {
      toast.error("Invalid credentials");
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await signIn(username, formData.password);
      if (error) throw error;
      
      // Reset attempts on success
      setLoginAttempts(0);
      setLockoutUntil(null);
      
      toast.success("Welcome back!");
    } catch {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
        toast.error("Too many failed attempts. Account locked for 5 minutes.");
      } else {
        toast.error(`Invalid username or password (${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining)`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left panel — branding (hidden on mobile, shown on lg+) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden surface-lavender flex-col items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 surface-pink rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 surface-butter rounded-full blur-3xl opacity-60" />
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
            Welcome back to Eternia
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-muted-foreground text-sm leading-relaxed mb-8"
          >
            Your safe space for anonymous counseling, peer support, and emotional wellbeing tools.
          </motion.p>
          
          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {["Anonymous", "Encrypted", "DPDP Compliant", "Peer Support"].map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full text-[11px] bg-primary/8 text-primary border border-primary/10">
                {tag}
              </span>
            ))}
          </motion.div>

          {/* Testimonial card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-10 p-5 rounded-2xl bg-card/60 border border-border/30 backdrop-blur-sm text-left"
          >
            <div className="flex gap-0.5 mb-3">
              {[...Array(5)].map((_, i) => (
                <Sparkles key={i} className="w-3.5 h-3.5 text-eternia-warning fill-eternia-warning" />
              ))}
            </div>
            <p className="text-sm text-foreground/80 italic leading-relaxed">
              "Eternia helped me talk about things I couldn't share with anyone else. The anonymity made all the difference."
            </p>
            <p className="text-xs text-muted-foreground mt-3">— Anonymous Student</p>
          </motion.div>
        </div>
      </div>

      {/* Right panel — login form */}
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

          {/* Mobile logo */}
          <div className="flex items-center mb-6 lg:hidden">
            <EterniaLogo size={44} />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold font-display mb-1.5">Sign in</h1>
            <p className="text-muted-foreground text-sm">
              Use your username or email to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block uppercase tracking-wider">
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  name="username"
                  placeholder="Enter username or email"
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-11 h-12 rounded-xl bg-card/50 border-border/40 focus:border-primary/50 focus:ring-primary/20 transition-all text-sm"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-11 pr-11 h-12 rounded-xl bg-card/50 border-border/40 focus:border-primary/50 focus:ring-primary/20 transition-all text-sm"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold gap-2 shadow-lg shadow-primary/15 transition-all active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/30 text-center">
            <p className="text-muted-foreground text-sm">
              New to Eternia?{" "}
              <Link to="/institution-code" className="text-primary font-medium hover:underline">
                Get started
              </Link>
            </p>
          </div>

          {/* Trust footer */}
          <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-muted-foreground/50">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>Encrypted</span>
            </div>
            <span>•</span>
            <span>Anonymous</span>
            <span>•</span>
            <span>DPDP</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
