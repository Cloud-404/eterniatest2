import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, User, Lock, Eye, EyeOff, ArrowLeft, Shield, AlertTriangle, CheckCircle, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EterniaLogo from "@/components/EterniaLogo";


const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    emergencyName: "",
    emergencyContact: "",
    emergencyRelation: "",
    contactIsSelf: false,
    studentId: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [institutionType, setInstitutionType] = useState<string>("university");
  const [studentIdVerified, setStudentIdVerified] = useState(false);
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [studentIdSkipped, setStudentIdSkipped] = useState(false);

  const tempCredentialId = sessionStorage.getItem("eternia_temp_credential_id");

  useEffect(() => {
    const instId = sessionStorage.getItem("eternia_institution_id");
    if (instId) {
      supabase.from("institutions").select("institution_type").eq("id", instId).single()
        .then(({ data }) => {
          if (data?.institution_type) setInstitutionType(data.institution_type);
        });
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (e.target.name === "studentId") {
      setStudentIdVerified(false);
      setStudentIdSkipped(false);
    }
  };

  const isSchool = institutionType === "school";
  const idLabel = isSchool ? "ERP ID (Admission Number)" : "APAAR / ABC ID";
  const idPlaceholder = isSchool ? "Your ERP ID / Admission Number" : "12-digit APAAR / ABC ID";

  const validateApaarFormat = (id: string): boolean => /^\d{12}$/.test(id);
  const validateErpFormat = (id: string): boolean => /^[a-zA-Z0-9]{3,50}$/.test(id);

  const handleVerifyStudentId = async () => {
    const id = formData.studentId.trim();
    if (!id) {
      toast.error(`Please enter your ${idLabel}`);
      return;
    }

    // Client-side format validation first
    if (isSchool) {
      if (!validateErpFormat(id)) {
        toast.error("ERP ID must be 3-50 alphanumeric characters");
        return;
      }
    } else {
      if (!validateApaarFormat(id)) {
        toast.error("APAAR / ABC ID must be exactly 12 digits");
        return;
      }
    }

    setIsVerifyingId(true);
    try {
      const institutionId = sessionStorage.getItem("eternia_institution_id");
      if (!institutionId) {
        toast.error("Institution not found. Please restart the registration process.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("verify-student-id", {
        body: {
          institution_id: institutionId,
          id_type: isSchool ? "erp" : "apaar",
          student_id: id,
        },
      });

      if (error) throw new Error(error.message || "Verification failed");

      if (data?.verified) {
        setStudentIdVerified(true);
        toast.success(`${isSchool ? "ERP ID" : "APAAR ID"} verified successfully`);
      } else if (data?.reason === "no_records") {
        // Institution hasn't uploaded IDs yet — allow proceeding with warning
        setStudentIdVerified(true);
        toast.warning(data.message || "Verification records not available. Proceeding without verification.");
      } else {
        toast.error(data?.message || "ID verification failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed. Please try again.");
    } finally {
      setIsVerifyingId(false);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const username = formData.username.trim();

    if (!username || username.length < 4) {
      toast.error("Username must be at least 4 characters");
      return;
    }
    if (username.length > 30) {
      toast.error("Username must be 30 characters or less");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error("Username can only contain letters, numbers, and underscores");
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (formData.password.length > 128) {
      toast.error("Password must be 128 characters or less");
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(formData.password)) {
      toast.error("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      toast.error("Password must contain at least one number");
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password)) {
      toast.error("Password must contain at least one special character");
      return;
    }
    if (formData.password.toLowerCase().includes(username.toLowerCase())) {
      toast.error("Password cannot contain your username");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emergencyName = formData.emergencyName.trim();
    const emergencyContact = formData.emergencyContact.trim();
    const studentId = formData.studentId.trim();

    if (!emergencyName || emergencyName.length < 2 || emergencyName.length > 100) {
      toast.error("Emergency contact name must be 2-100 characters");
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(emergencyName)) {
      toast.error("Emergency contact name contains invalid characters");
      return;
    }
    if (!emergencyContact) {
      toast.error("Emergency contact number is required");
      return;
    }
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(emergencyContact.replace(/[\s-]/g, ""))) {
      toast.error("Please enter a valid Indian phone number");
      return;
    }
    if (!formData.contactIsSelf && !formData.emergencyRelation?.trim()) {
      toast.error("Please specify the relationship to the contact person");
      return;
    }
    if (!studentIdSkipped) {
      if (!studentId || studentId.length < 3 || studentId.length > 50) {
        toast.error(`${idLabel} must be 3-50 characters, or click Skip to verify later`);
        return;
      }
      if (!studentIdVerified) {
        toast.error(`Please verify your ${idLabel} or click Skip to verify later`);
        return;
      }
    }
    if (!acceptedConsent) {
      toast.error("Please accept the emergency escalation consent");
      return;
    }

    setIsLoading(true);
    try {
      if (tempCredentialId) {
        const { data, error } = await supabase.functions.invoke("activate-account", {
          body: {
            temp_credential_id: tempCredentialId,
            new_username: formData.username.trim(),
            new_password: formData.password,
            emergency_name: formData.emergencyName,
            emergency_phone: formData.emergencyContact,
            emergency_relation: formData.contactIsSelf ? "Self" : formData.emergencyRelation,
            contact_is_self: formData.contactIsSelf,
            student_id: studentIdSkipped ? "" : formData.studentId,
            device_fingerprint: null,
          },
        });

        if (error) throw new Error(error.message || "Account activation failed");
        if (data?.error) throw new Error(data.error);

        if (data?.auto_login && data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }

        toast.success("Account created successfully!");
        sessionStorage.removeItem("eternia_institution_code");
        sessionStorage.removeItem("eternia_institution_id");
        sessionStorage.removeItem("eternia_spoc_verified");
        sessionStorage.removeItem("eternia_temp_credential_id");

        if (data?.auto_login) {
          navigate("/dashboard");
        } else {
          navigate("/login");
        }
      } else {
        const institutionCode = sessionStorage.getItem("eternia_institution_code");
        const institutionId = sessionStorage.getItem("eternia_institution_id");
        const { error } = await signUp(formData.username, formData.password, {
          institution_code: institutionCode,
        });
        if (error) throw error;

        const waitForUser = (): Promise<string | null> => {
          return new Promise((resolve) => {
            let attempts = 0;
            const check = async () => {
              const { data: { user: authUser } } = await supabase.auth.getUser();
              if (authUser?.id) return resolve(authUser.id);
              if (++attempts >= 10) return resolve(null);
              setTimeout(check, 400);
            };
            check();
          });
        };

        const userId = await waitForUser();
        if (userId) {
          await supabase.from("user_private").insert({
            user_id: userId,
            emergency_name_encrypted: formData.emergencyName,
            emergency_phone_encrypted: formData.emergencyContact,
            emergency_relation: formData.contactIsSelf ? "Self" : formData.emergencyRelation,
            student_id_encrypted: null,
            contact_is_self: formData.contactIsSelf,
            device_id_encrypted: null,
            apaar_id_encrypted: null,
            erp_id_encrypted: null,
            apaar_verified: !isSchool && studentIdVerified ? true : false,
            erp_verified: isSchool && studentIdVerified ? true : false,
          });

          if (institutionId) {
            await supabase
              .from("profiles")
              .update({ institution_id: institutionId })
              .eq("id", userId);
          }
        }

        toast.success("Account created successfully!");
        sessionStorage.removeItem("eternia_institution_code");
        sessionStorage.removeItem("eternia_institution_id");
        sessionStorage.removeItem("eternia_spoc_verified");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getBackAction = () => {
    if (step === 1) return () => navigate("/qr-scan");
    if (step === 2) return () => setStep(1);
    return () => setStep(1);
  };

  const getBackLabel = () => {
    if (step === 1) return "Back";
    if (step === 2) return "Back to Credentials";
    return "Back to Credentials";
  };

  return (
    <div className="min-h-screen min-h-dvh bg-background flex items-start sm:items-center justify-center px-4 py-6 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-eternia-teal/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-eternia-lavender/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <button
          onClick={getBackAction()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {getBackLabel()}
        </button>

        <div className="flex items-center mb-5">
          <EterniaLogo size={44} />
        </div>

        {/* Progress Steps — 3 steps */}
        <div className="flex items-center gap-2 mb-5">
          {/* Step 1: Credentials */}
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
            step > 1 ? "bg-eternia-success text-background" : "bg-gradient-eternia text-background"
          }`}>
            {step > 1 ? <CheckCircle className="w-4 h-4" /> : "1"}
          </div>
          <div className={`flex-1 h-1 rounded ${step >= 2 ? "bg-gradient-eternia" : "bg-muted"}`} />

          {/* Step 2: Private Profile */}
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
            step === 2 ? "bg-gradient-eternia text-background" : "bg-muted text-muted-foreground"
          }`}>
            2
          </div>
        </div>

        <div className="glass rounded-2xl p-4 sm:p-6">
          {/* ─── STEP 1: Credentials ─── */}
          {step === 1 && (
            <>
              <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-bold font-display mb-1">
                  {tempCredentialId ? "Set Up Your Account" : "Create Your Identity"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {tempCredentialId
                    ? "Choose your permanent username and password to activate your account."
                    : "Choose a username and password. Your real name is never required."}
                </p>
              </div>

              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Username</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      name="username"
                      placeholder="Choose a unique username"
                      value={formData.username}
                      onChange={handleChange}
                      className="pl-10 h-11 rounded-xl bg-card/50 border-border/40 text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">This will be your permanent identity</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="8+ characters"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 pr-10 h-11 rounded-xl bg-card/50 border-border/40 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10 h-11 rounded-xl bg-card/50 border-border/40 text-sm"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold gap-2 shadow-lg shadow-primary/15 active:scale-[0.98] transition-all mt-2">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}

          {/* ─── STEP 2: Private Profile ─── */}
          {step === 2 && (
            <>
              <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-bold font-display mb-1">Private Profile</h1>
                <p className="text-sm text-muted-foreground">
                  Encrypted and only accessed during emergencies.
                </p>
              </div>

              <form onSubmit={handleStep2Submit} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Emergency Contact Name</label>
                  <Input
                    type="text"
                    name="emergencyName"
                    placeholder="Full name"
                    value={formData.emergencyName}
                    onChange={handleChange}
                    className="h-11 rounded-xl bg-card/50 border-border/40 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Emergency Contact Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      name="emergencyContact"
                      placeholder="+91 XXXXX XXXXX"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      className="pl-10 h-11 rounded-xl bg-card/50 border-border/40 text-sm"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="contactIsSelf"
                      checked={formData.contactIsSelf}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, contactIsSelf: checked as boolean, emergencyRelation: checked ? "Self" : "" }))
                      }
                    />
                    <label htmlFor="contactIsSelf" className="text-sm cursor-pointer">
                      This is my own phone number
                    </label>
                  </div>
                </div>

                {!formData.contactIsSelf && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Relation to Contact</label>
                    <Input
                      type="text"
                      name="emergencyRelation"
                      placeholder="e.g., Parent, Guardian"
                      value={formData.emergencyRelation}
                      onChange={handleChange}
                      className="h-11 rounded-xl bg-card/50 border-border/40 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    {idLabel} <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      name="studentId"
                      placeholder={idPlaceholder}
                      value={formData.studentId}
                      onChange={handleChange}
                      disabled={studentIdSkipped}
                      className="h-11 rounded-xl bg-card/50 border-border/40 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant={studentIdVerified ? "outline" : "default"}
                      onClick={handleVerifyStudentId}
                      disabled={isVerifyingId || studentIdVerified || studentIdSkipped}
                      className="h-11 rounded-xl text-sm px-4 flex-shrink-0"
                    >
                      {isVerifyingId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : studentIdVerified ? (
                        <CheckCircle className="w-4 h-4 text-eternia-success" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={studentIdSkipped ? "outline" : "ghost"}
                      onClick={() => {
                        setStudentIdSkipped((prev) => {
                          const next = !prev;
                          if (next) {
                            setFormData((p) => ({ ...p, studentId: "" }));
                            setStudentIdVerified(false);
                          }
                          return next;
                        });
                      }}
                      disabled={isVerifyingId || studentIdVerified}
                      className="h-11 rounded-xl text-sm px-3 flex-shrink-0"
                    >
                      {studentIdSkipped ? "Skipped" : "Skip"}
                    </Button>
                  </div>
                  {studentIdVerified && (
                    <p className="text-[11px] text-eternia-success mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {isSchool ? "ERP ID verified" : "APAAR / ABC ID verified"}
                    </p>
                  )}
                  {studentIdSkipped && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      You can verify your {idLabel} later from your Profile.
                    </p>
                  )}
                  {!studentIdVerified && !studentIdSkipped && !isVerifyingId && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {isSchool
                        ? "Enter your school ERP ID or Admission Number (optional)"
                        : "Enter your 12-digit APAAR / ABC ID, or skip for now"}
                    </p>
                  )}
                </div>


                {/* Consent */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="consent"
                      checked={acceptedConsent}
                      onCheckedChange={(checked) => setAcceptedConsent(checked as boolean)}
                      className="mt-0.5"
                    />
                    <label htmlFor="consent" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                      <span className="flex items-center gap-1.5 font-medium text-foreground text-sm mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-eternia-warning" />
                        Emergency Escalation Consent
                      </span>
                      I consent to the platform sharing my username and emergency contact with my institution's SPOC (Single Point of Contact) if the system or a qualified professional detects a high-risk situation requiring immediate intervention.
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold gap-2 shadow-lg shadow-primary/15 active:scale-[0.98] transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      {tempCredentialId ? "Activating Account..." : "Creating Account..."}
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      {tempCredentialId ? "Activate Account" : "Complete Registration"}
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          <div className="mt-5 pt-4 border-t border-border/30 text-center">
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
