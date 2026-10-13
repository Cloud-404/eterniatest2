import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User, Shield, Bell, Lock, Building2, Calendar, Coins, CheckCircle, Settings,
  ChevronRight, Save, Loader2, Phone, UserCircle, LogOut, BadgeCheck, AlertCircle,
  Award, BookOpen, Stethoscope, Clock,
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

const MobileProfile = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { balance } = useCredits();
  const [bio, setBio] = useState(profile?.bio || "");
  const [specialty, setSpecialty] = useState(profile?.specialty || "");

  // Student-only state
  const [studentId, setStudentId] = useState("");
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
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

  useEffect(() => {
    if (!user || !isStudent) return;
    const loadPrivate = async () => {
      const { data } = await supabase.from("user_private").select("*").eq("user_id", user.id).maybeSingle();
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
      await supabase.from("profiles").update(updates).eq("id", user.id);
      await refreshProfile();
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSaving(false); }
  };

  const handleVerifyStudentId = async () => {
    if (!user || !studentId.trim() || studentId === "••••••••") return;
    setIsVerifyingId(true);
    try {
      const institutionId = profile?.institution_id;
      if (!institutionId) { toast.error("No institution linked"); setIsVerifyingId(false); return; }

      const { data: inst } = await supabase
        .from("institutions").select("institution_type").eq("id", institutionId).single();
      const idType = inst?.institution_type === "school" ? "erp" : "apaar";

      const { data, error } = await supabase.functions.invoke("verify-student-id", {
        body: { institution_id: institutionId, id_type: idType, student_id: studentId.trim(), claim_for_user_id: user.id }
      });
      if (error) throw error;

      if (data.verified) {
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
        setIdVerified(true); setStudentId("••••••••");
        toast.success("ID verified successfully");
      } else if (data.reason === "no_records") {
        await supabase.from("profiles").update({ is_verified: true }).eq("id", user.id);
        await refreshProfile();
        setIdVerified(true); setStudentId("••••••••");
        toast.info(data.message || "Verified (no records to check)");
      } else {
        toast.error(data.message || "Verification failed");
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setIsVerifyingId(false); }
  };

  const handleSaveEmergency = async () => {
    if (!user || contactIsSelf === null) return;
    if (!emergencyPhone.trim()) { toast.error("Phone number required"); return; }
    if (!contactIsSelf && !emergencyRelation.trim()) { toast.error("Relationship required"); return; }
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
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSavingEmergency(false); }
  };

  const trainingProgress = (profile as any)?.training_progress as number[] | null;
  const completedModules = trainingProgress || [];
  const trainingStatus = (profile as any)?.training_status || "not_started";

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <h1 className="text-xl font-bold font-display">Profile</h1>

        {/* Profile Card */}
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-start gap-4">
            <AvatarUpload size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold font-display truncate">{profile?.username || "User"}</h2>
                {profile?.is_verified && <CheckCircle className="w-4 h-4 text-eternia-success" />}
                <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary capitalize">{profile?.role}</span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="w-3.5 h-3.5" />{profile?.institution_id ? "Institution" : "Independent"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            {[
              { icon: Calendar, val: profile?.total_sessions || 0, label: "Sessions" },
              ...(isStudent ? [{ icon: Coins, val: balance, label: "Credits" }] : []),
              { icon: Shield, val: profile?.streak_days || 0, label: "Streak" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <s.icon className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-base font-bold">{s.val}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          {isStudent && (profile as any)?.student_id && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Student ID</p>
              <p className="text-sm font-mono font-medium text-primary">{(profile as any).student_id}</p>
            </div>
          )}
        </div>

        {/* Expert/Therapist: Professional Details */}
        {(isExpert || isTherapist) && (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary" />Professional Details
            </h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Specialty</label>
              <Input placeholder="e.g., Clinical Psychology" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="bg-muted/30 h-10 text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">CRR Verification</span>
              {profile?.is_verified ? (
                <span className="text-sm font-medium text-eternia-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Verified</span>
              ) : (
                <span className="text-sm font-medium text-eternia-warning flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pending</span>
              )}
            </div>
          </div>
        )}

        {/* Intern: Training Status */}
        {isIntern && (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />Training Status
            </h3>
            <Progress value={(completedModules.length / 7) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">{completedModules.length}/7 modules · {trainingStatus === "active" || trainingStatus === "completed" ? "Certified" : trainingStatus === "interview_pending" ? "Interview Pending" : "In Progress"}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">CRR Verification</span>
              {profile?.is_verified ? (
                <span className="text-sm font-medium text-eternia-success flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Verified</span>
              ) : (
                <span className="text-sm font-medium text-eternia-warning flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pending</span>
              )}
            </div>
          </div>
        )}

        {/* SPOC: Institution Info */}
        {isSPOC && (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />Institution
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="text-sm font-medium">{profile?.institution_id ? "Linked" : "Not linked"}</span>
            </div>
            <Link to="/dashboard/spoc">
              <Button variant="outline" className="w-full justify-between h-10 text-sm">SPOC Dashboard<ChevronRight className="w-4 h-4" /></Button>
            </Link>
          </div>
        )}

        {/* APAAR / Student ID — Student Only */}
        {isStudent && (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-primary" />Student Verification
            </h3>
            <p className="text-xs text-muted-foreground">APAAR / ABC ID (university) or ERP ID (school)</p>
            {idVerified ? (
              <div className="p-3 rounded-xl bg-eternia-success/10 border border-eternia-success/20 flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-eternia-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-eternia-success">Verified</p>
                  <p className="text-[11px] text-muted-foreground">Securely stored.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input placeholder="Enter APAAR / ABC / ERP ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="bg-muted/30 h-10 text-sm" maxLength={30} />
                <Button onClick={handleVerifyStudentId} disabled={!studentId.trim() || isVerifyingId} size="sm" className="gap-1.5 h-9 text-xs">
                  {isVerifyingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}Verify
                </Button>
              </div>
            )}
            <div className="p-2 rounded-lg bg-muted/30 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground">Encrypted. Only accessible during formal escalation.</p>
            </div>
          </div>
        )}

        {/* Bio */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><UserCircle className="w-4 h-4 text-primary" />About</h3>
          <Textarea placeholder="About you (anonymous)..." value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[80px] bg-muted/30 resize-none text-sm" />
          <Button onClick={handleSaveProfile} disabled={isSaving} size="sm" className="gap-1.5 h-9 text-xs">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
          </Button>
        </div>

        {/* Emergency Contact — Student Only */}
        {isStudent && (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-primary" />Emergency Contact</h3>
            <p className="text-xs text-muted-foreground">Encrypted, only for escalation.</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Whose number? *</label>
              <Select
                value={contactIsSelf === null ? "" : contactIsSelf ? "self" : "other"}
                onValueChange={(v) => {
                  setContactIsSelf(v === "self");
                  if (v === "self") { setEmergencyName(""); setEmergencyRelation("self"); }
                }}
              >
                <SelectTrigger className="h-10 text-sm bg-muted/30"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">My own number</SelectItem>
                  <SelectItem value="other">Someone else's</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone Number *</label>
              <Input placeholder="+91 XXXXX XXXXX" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="bg-muted/30 h-10 text-sm" maxLength={15} />
            </div>
            {contactIsSelf === false && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Contact Name *</label>
                  <Input placeholder="e.g., Parent" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="bg-muted/30 h-10 text-sm" maxLength={100} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Relationship *</label>
                  <Select value={emergencyRelation} onValueChange={setEmergencyRelation}>
                    <SelectTrigger className="h-10 text-sm bg-muted/30"><SelectValue placeholder="Select..." /></SelectTrigger>
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
            <Button onClick={handleSaveEmergency} disabled={isSavingEmergency || contactIsSelf === null || !emergencyPhone.trim()} variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
              {isSavingEmergency ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
            </Button>
          </div>
        )}

        {/* Settings */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Settings</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Username</label>
            <Input value={profile?.username || ""} disabled className="bg-muted/30 h-10 text-sm" />
          </div>
          <Link to="/dashboard/recovery-setup"><Button variant="outline" className="w-full justify-between h-10 text-sm">Recovery setup<ChevronRight className="w-4 h-4" /></Button></Link>
          <Button variant="outline" className="w-full justify-between h-10 text-sm">Update password<ChevronRight className="w-4 h-4" /></Button>
        </div>

        {/* Notifications */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Notifications</h3>
          {[
            { key: "sessions" as const, label: "Session Reminders", desc: "Upcoming appointments" },
            ...(isStudent ? [{ key: "credits" as const, label: "Credit Updates", desc: "Credits earned/spent" }] : []),
            { key: "wellness" as const, label: "Wellness Tips", desc: "Daily reminders" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 py-1">
              <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
              <Switch checked={notifications[item.key]} onCheckedChange={(c) => setNotifications({ ...notifications, [item.key]: c })} />
            </div>
          ))}
        </div>

        {/* Privacy */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Lock className="w-4 h-4 text-primary" />Privacy</h3>
          <Button variant="outline" className="w-full justify-between h-10 text-sm">View Privacy Settings<ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" className="w-full justify-between h-10 text-sm">Download My Data<ChevronRight className="w-4 h-4" /></Button>
          <div className="p-3 rounded-xl bg-muted/30 flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">AES-256 encrypted. Identity only revealed via formal escalation.</p>
          </div>
        </div>

        <AccountDeletion />

        <Button
          variant="destructive"
          className="w-full h-12 text-sm font-semibold gap-2"
          onClick={async () => { await signOut(); toast.success("Logged out"); navigate("/"); }}
        >
          <LogOut className="w-5 h-5" />Log Out
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default MobileProfile;
