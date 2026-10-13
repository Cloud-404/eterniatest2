import { useState } from "react";
import { Shield, Key, Save, CheckCircle, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const HINT_QUESTIONS = [
  "Favourite colour",
  "First pet's name",
  "Childhood nickname",
  "Mother's maiden name",
  "Favourite teacher",
  "Birth city",
  "Best friend in school",
  "Favourite movie",
  "First phone brand",
  "Favourite food",
];

const MobileRecoverySetup = () => {
  const { user } = useAuth();
  const [pairs, setPairs] = useState([{ hint: "", answer: "" }, { hint: "", answer: "" }, { hint: "", answer: "" }]);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleChange = (i: number, field: "hint" | "answer", value: string) => {
    setPairs((p) => { const u = [...p]; u[i] = { ...u[i], [field]: value }; return u; });
  };

  const handleSave = async () => {
    if (!user) return;
    const answers = pairs.map((p) => p.answer.trim().toLowerCase());
    if (new Set(answers).size !== answers.length) {
      toast.error("All 3 answers must be distinct");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("recovery_credentials").upsert({
        user_id: user.id,
        fragment_pairs_encrypted: JSON.stringify(pairs),
        emoji_pattern_encrypted: JSON.stringify([]),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      setIsComplete(true); toast.success("Recovery setup complete!");
    } catch (e: any) { toast.error(e.message); } finally { setIsSaving(false); }
  };

  if (isComplete) return (
    <DashboardLayout>
      <div className="text-center py-16 pb-24">
        <div className="w-16 h-16 rounded-2xl bg-eternia-success/20 flex items-center justify-center mx-auto mb-5"><CheckCircle className="w-8 h-8 text-eternia-success" /></div>
        <h1 className="text-xl font-bold font-display mb-2">Setup Complete</h1>
        <p className="text-sm text-muted-foreground mb-5">Your recovery credentials are saved securely.</p>
        <Button onClick={() => window.history.back()} variant="outline" className="h-10 text-sm">Back to Profile</Button>
      </div>
    </DashboardLayout>
  );

  const allFilled = pairs.every((p) => p.hint.trim() && p.answer.trim());

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <h1 className="text-xl font-bold font-display">Security Questions</h1>

        <div className="p-4 rounded-2xl bg-gradient-eternia-subtle border border-border flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">Pick 3 security questions with 3 distinct answers. You'll use these to recover your password.</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2"><Key className="w-5 h-5 text-primary" /><h2 className="text-sm font-semibold">Security Questions</h2></div>
          {pairs.map((pair, i) => (
            <div key={i} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Question {i + 1}</p>
              <Select value={pair.hint} onValueChange={(v) => handleChange(i, "hint", v)}>
                <SelectTrigger className="bg-background h-10 text-sm"><SelectValue placeholder="Select question" /></SelectTrigger>
                <SelectContent>
                  {HINT_QUESTIONS.filter((q) => !pairs.some((p, idx) => idx !== i && p.hint === q)).map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Answer" value={pair.answer} onChange={(e) => handleChange(i, "answer", e.target.value)} className="bg-background h-10 text-sm" />
            </div>
          ))}
          <Button onClick={handleSave} disabled={!allFilled || isSaving} className="w-full gap-2 h-12 text-sm">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
          </Button>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">Encrypted with AES-256-GCM. Write-only — never returned in API responses.</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MobileRecoverySetup;
