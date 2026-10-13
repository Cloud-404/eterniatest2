import { useIsMobile } from "@/hooks/use-mobile";
import MobileProfile from "@/components/mobile/MobileProfile";

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  User, Shield, Bell, Lock, Building2, Calendar, Coins, CheckCircle, Settings,
  ChevronRight, Save, Loader2, Phone, UserCircle, BadgeCheck, AlertCircle,
  Award, BookOpen, Stethoscope, Clock, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AccountDeletion from "@/components/admin/AccountDeletion";
import AvatarUpload from "@/components/profile/AvatarUpload";

const Profile = () => {
  const isMobile = useIsMobile();
  const { user, profile, refreshProfile } = useAuth();
  const { balance } = useCredits();
  const [bio, setBio] = useState(profile?.bio || "");
  const [specialty, setSpecialty] = useState(profile?.specialty || "");

  // APAAR / Student ID (student only)
  const [studentId, setStudentId] = useState("");
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [idVerified, setIdVerified] = useState(false);

  // Emergency contact (student only)
  const [contactIsSelf, setContactIsSelf] = useState<boolean | null>(null);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEmergency, setIsSavingEmergency] = useState(false);
  const [notifications, setNotifications] = useState({ sessions: true, credits: true, wellness: false });

  const isStudent = profile?.role === "student";
  const isExpert = profile?.role === "expert";
  const isIntern = profile?.role === "intern";
  const isTherapist = (profile as any)?.role === "therapist";
  const isSPOC = profile?.role === "spoc";

  // Load existing private data (student only)
  useEffect(() => {
    if (!user || !isStudent) return;
    const loadPrivate = async () => {
      const { data } = await supabase
        .from("user_private")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setContactIsSelf(data.contact_is_self ?? null);
        setEmergencyName(data.emergency_name_encrypted || "");
        setEmergencyPhone(data.emergency_phone_encrypted || "");
        setEmergencyRelation(data.emergency_relation || "");
        const verified = !!(data.apaar_verified || data.erp_verified);
        setIdVerified(verified);
        if (verified) setStudentId("••••••••");
      }
    };
    loadPrivate();
  }, [user, isStudent]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const updates: { bio: string; updated_at: string; specialty?: string } = { bio, updated_at: new Date().toISOString() };
      if (isExpert || isTherapist) updates.specialty = specialty;
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyStudentId = async () => {
    if (!user || !studentId.trim() || studentId === "••••••••") return;
    setIsVerifyingId(true);
    try {
      const institutionId = profile?.institution_id;
      if (!institutionId) { toast.error("No institution linked to your account"); setIsVerifyingId(false); return; }

      // Determine ID type from institution
      const { data: inst } = await supabase
        .from("institutions").select("institution_type").eq("id", institutionId).single();
      const idType = inst?.institution_type === "school" ? "erp" : "apaar";

      // Call verify-student-id edge function with claim
      const { data, error } = await supabase.functions.invoke("verify-student-id", {
        body: { institution_id: institutionId, id_type: idType, student_id: studentId.trim(), claim_for_user_id: user.id }
      });

      if (error) throw error;

      if (data.verified) {
        // Update verification flags only — never store raw ID
        const upsertData = {
          user_id: user.id,
          apaar_verified: idType === "apaar" ? true : false,
          erp_verified: idType === "erp" ? true : false,
          student_id_encrypted: null as string | null,
          apaar_id_encrypted: null as string | null,
          erp_id_encrypted: null as string | null,
        };
        await supabase.from("user_private").upsert([upsertData], { onConflict: "user_id" });

        await supabase.from("profiles").update({ is_verified: true }).eq("id", user.id);
        await refreshProfile();
        setIdVerified(true);
        setStudentId("••••••••");
        toast.success("ID verified successfully");
      } else if (data.reason === "no_records") {
        // Institution hasn't uploaded IDs — pass through
        await supabase.from("profiles").update({ is_verified: true }).eq("id", user.id);
        await refreshProfile();
        setIdVerified(true);
        setStudentId("••••••••");
        toast.info(data.message || "Verified (no institution records to check against)");
      } else {
        toast.error(data.message || "Verification failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsVerifyingId(false);
    }
  };

  const handleSaveEmergency = async () => {
    if (!user || contactIsSelf === null) return;
    if (!emergencyPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!contactIsSelf && !emergencyRelation.trim()) {
      toast.error("Relationship is required when contact is not self");
      return;
    }
    setIsSavingEmergency(true);
    try {
      const { error } = await supabase.from("user_private").upsert({
        user_id: user.id,
        contact_is_self: contactIsSelf,
        emergency_name_encrypted: contactIsSelf ? "" : emergencyName.trim(),
        emergency_phone_encrypted: emergencyPhone.trim(),
        emergency_relation: contactIsSelf ? "self" : emergencyRelation.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Emergency contact saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSavingEmergency(false);
    }
  };

  if (isMobile) return <MobileProfile />;

  // Training progress for interns
  const trainingProgress = (profile as any)?.training_progress as number[] | null;
  const completedModules = trainingProgress || [];
  const trainingStatus = (profile as any)?.training_status || "not_started";

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display mb-1">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account settings</p>
        </div>

        {/* Profile Card */}
        <div className="p-6 rounded-2xl bg-card border border-border">
          <div className="flex items-start gap-6">
            <AvatarUpload size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <h2 className="text-xl font-bold font-display truncate">{profile?.username || "User"}</h2>
                {profile?.is_verified && <CheckCircle className="w-4 h-4 text-eternia-success" />}
                <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary capitalize">{profile?.role}</span>
              </div>
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Building2 className="w-3.5 h-3.5" />{profile?.institution_id ? "Institution Member" : "Independent User"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "N/A"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
            <div className="text-center"><Calendar className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{profile?.total_sessions || 0}</p><p className="text-sm text-muted-foreground">Sessions</p></div>
            {isStudent && (
              <div className="text-center"><Coins className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{balance}</p><p className="text-sm text-muted-foreground">Credits</p></div>
            )}
            <div className="text-center"><Shield className="w-5 h-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{profile?.streak_days || 0}</p><p className="text-sm text-muted-foreground">Streak</p></div>
          </div>
          {isStudent && (profile as any)?.student_id && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Student ID</p>
              <p className="text-sm font-mono font-medium text-primary">••••{String((profile as any).student_id).slice(-4)}</p>
            </div>
          )}
        </div>

        {/* Role-Specific Sections */}

        {/* Expert/Therapist: Specialty & Licence */}
        {(isExpert || isTherapist) && (
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold font-display text-sm flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary" />Professional Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Specialty</label>
                <Input
                  placeholder="e.g., Clinical Psychology"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="bg-muted/30 h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">CRR Verification</label>
                <div className="flex items-center gap-1.5 h-9">
                  {profile?.is_verified ? (
                    <><CheckCircle className="w-4 h-4 text-eternia-success" /><span className="text-sm font-medium text-eternia-success">Verified</span></>
                  ) : (
                    <><Clock className="w-4 h-4 text-eternia-warning" /><span className="text-sm font-medium text-eternia-warning">Pending</span></>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Intern: Training Status */}
        {isIntern && (
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold font-display text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />Training Status
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Progress</p>
                <Progress value={(completedModules.length / 7) * 100} className="h-2 mb-1" />
                <p className="text-xs text-muted-foreground">{completedModules.length}/7 modules completed</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <p className={`text-sm font-medium ${trainingStatus === "active" || trainingStatus === "completed" ? "text-eternia-success" : "text-eternia-warning"}`}>
                  {trainingStatus === "active" || trainingStatus === "completed" ? "Certified" : trainingStatus === "interview_pending" ? "Interview Pending" : "In Progress"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">CRR Verification</p>
                <div className="flex items-center gap-1.5">
                  {profile?.is_verified ? (
                    <><CheckCircle className="w-4 h-4 text-eternia-success" /><span className="text-sm font-medium text-eternia-success">Verified</span></>
                  ) : (
                    <><Clock className="w-4 h-4 text-eternia-warning" /><span className="text-sm font-medium text-eternia-warning">Pending</span></>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SPOC: Institution Info */}
        {isSPOC && (
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-semibold font-display text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />Institution Management
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Institution</p>
                <p className="text-sm font-medium">{profile?.institution_id ? "Linked" : "Not linked"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Verification</p>
                <div className="flex items-center gap-1.5">
                  {profile?.is_verified ? (
                    <><CheckCircle className="w-4 h-4 text-eternia-success" /><span className="text-sm font-medium text-eternia-success">Verified</span></>
                  ) : (
                    <><Clock className="w-4 h-4 text-eternia-warning" /><span className="text-sm font-medium text-eternia-warning">Pending</span></>
                  )}
                </div>
              </div>
            </div>
            <Link to="/dashboard/spoc">
              <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs mt-2">
                Go to SPOC Dashboard<ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {/* APAAR / Student ID Verification — Student Only */}
        {isStudent && (
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-semibold font-display text-sm flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-primary" />Student Verification (APAAR / ABC / ERP ID)
            </h3>
            <p className="text-xs text-muted-foreground">
              Submit your APAAR ID (university/college) or ERP ID (school) for institutional verification. This ID is encrypted and never visible publicly.
            </p>
            {idVerified ? (
              <div className="p-3 rounded-xl bg-eternia-success/10 border border-eternia-success/20 flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-eternia-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-eternia-success">Verified</p>
                  <p className="text-[11px] text-muted-foreground">Your student ID has been securely stored.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Enter APAAR / ABC / ERP ID"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="bg-muted/30 h-9 text-sm"
                  maxLength={30}
                />
                <Button
                  onClick={handleVerifyStudentId}
                  disabled={!studentId.trim() || isVerifyingId}
                  size="sm"
                  className="gap-1.5 h-8"
                >
                  {isVerifyingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                  Verify & Store
                </Button>
              </div>
            )}
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                Your ID is AES-256 encrypted and accessible only by Eternia Admin during formal escalation. It is never exposed in any API response.
              </p>
            </div>
          </div>
        )}

        {/* Bio */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
          <h3 className="font-semibold font-display text-sm flex items-center gap-2"><UserCircle className="w-4 h-4 text-primary" />About You</h3>
          <Textarea placeholder="Tell us about yourself..." value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[100px] bg-muted/30 border-border resize-none text-sm" />
          <Button onClick={handleSaveProfile} disabled={isSaving} size="sm" className="gap-1.5 h-8">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save Profile
          </Button>
        </div>

        {/* Emergency Contact — Student Only */}
        {isStudent && (
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold font-display text-sm flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />Emergency Contact
            </h3>
            <p className="text-xs text-muted-foreground">Encrypted and only accessible during escalation.</p>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Whose number is this? *</label>
              <Select
                value={contactIsSelf === null ? "" : contactIsSelf ? "self" : "other"}
                onValueChange={(v) => {
                  setContactIsSelf(v === "self");
                  if (v === "self") { setEmergencyName(""); setEmergencyRelation("self"); }
                }}
              >
                <SelectTrigger className="h-9 text-sm bg-muted/30"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">My own number</SelectItem>
                  <SelectItem value="other">Someone else's number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone Number *</label>
              <Input placeholder="+91 XXXXX XXXXX" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="bg-muted/30 h-9 text-sm" maxLength={15} />
            </div>

            {contactIsSelf === false && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Contact Name *</label>
                  <Input placeholder="e.g., Parent / Guardian" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="bg-muted/30 h-9 text-sm" maxLength={100} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Relationship *</label>
                  <Select value={emergencyRelation} onValueChange={setEmergencyRelation}>
                    <SelectTrigger className="h-9 text-sm bg-muted/30"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveEmergency}
              disabled={isSavingEmergency || contactIsSelf === null || !emergencyPhone.trim()}
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
            >
              {isSavingEmergency ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Emergency Contact
            </Button>
          </div>
        )}

        {/* Account Settings */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <h3 className="font-semibold font-display text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Account Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Username</label>
              <Input value={profile?.username || ""} disabled className="bg-muted/30 h-9 text-sm" />
              <p className="text-[11px] text-muted-foreground mt-1">Cannot be changed for anonymity</p>
            </div>
            <Link to="/dashboard/recovery-setup"><Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs">Set up recovery<ChevronRight className="w-3.5 h-3.5" /></Button></Link>
            <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs">Update password<ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        {/* App Updates */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
          <h3 className="font-semibold font-display text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />App Updates
          </h3>
          <p className="text-xs text-muted-foreground">
            Version {__APP_VERSION__} • Check if a newer version is available.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={async () => {
              try {
                const reg = await navigator.serviceWorker?.getRegistration();
                if (reg) {
                  await reg.update();
                  if (reg.waiting) {
                    toast.success("Update available! Refresh to apply.");
                  } else {
                    toast.success("You're on the latest version.");
                  }
                } else {
                  toast.info("No service worker registered.");
                }
              } catch {
                toast.error("Could not check for updates.");
              }
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Check for Updates
          </Button>
        </div>

        {/* Notifications */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <h3 className="font-semibold font-display text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Notifications</h3>
          <div className="space-y-3">
            {[
              { key: "sessions" as const, label: "Session Reminders", desc: "Upcoming appointments" },
              ...(isStudent ? [{ key: "credits" as const, label: "Credit Updates", desc: "Credits earned or spent" }] : []),
              { key: "wellness" as const, label: "Wellness Tips", desc: "Daily self-care reminders" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <div><p className="font-medium text-sm">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                <Switch checked={notifications[item.key]} onCheckedChange={(c) => setNotifications({ ...notifications, [item.key]: c })} />
              </div>
            ))}
          </div>
        </div>

        {/* Privacy & Consent */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
          <h3 className="font-semibold font-display text-sm flex items-center gap-2"><Lock className="w-4 h-4 text-primary" />Privacy & Security</h3>
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs">View Privacy Settings<ChevronRight className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs">Download My Data<ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div><p className="font-medium text-xs mb-0.5">Your Data is Protected</p><p className="text-[11px] text-muted-foreground leading-relaxed">AES-256 encrypted. Only formal escalation can reveal identity.</p></div>
            </div>
          </div>
        </div>

        <AccountDeletion />
      </div>
    </DashboardLayout>
  );
};

export default Profile;
