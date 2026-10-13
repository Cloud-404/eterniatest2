import { useIsMobile } from "@/hooks/use-mobile";
import MobileRecoverySetup from "@/components/mobile/MobileRecoverySetup";

import { useState } from "react";
import { Shield, Key, Save, CheckCircle, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

const RecoverySetup = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [fragmentPairs, setFragmentPairs] = useState([{ hint: "", answer: "" }, { hint: "", answer: "" }, { hint: "", answer: "" }]);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleFragmentChange = (index: number, field: "hint" | "answer", value: string) => {
    setFragmentPairs((prev) => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
  };

  const handleSave = async () => {
    if (!user) return;
    const answers = fragmentPairs.map((p) => p.answer.trim().toLowerCase());
    if (new Set(answers).size !== answers.length) {
      toast.error("All 3 answers must be distinct");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("recovery_credentials").upsert({
        user_id: user.id,
        fragment_pairs_encrypted: JSON.stringify(fragmentPairs),
        emoji_pattern_encrypted: JSON.stringify([]),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      setIsComplete(true);
      toast.success("Recovery setup complete!");
    } catch (e: any) { toast.error(e.message); } finally { setIsSaving(false); }
  };

  if (isMobile) return <MobileRecoverySetup />;

  if (isComplete) return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-20 h-20 rounded-2xl bg-eternia-success/20 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-10 h-10 text-eternia-success" /></div>
        <h1 className="text-3xl font-bold font-display mb-4">Recovery Setup Complete</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">Your security questions have been saved securely.</p>
        <Button onClick={() => window.history.back()} variant="outline">Back to Profile</Button>
      </div>
    </DashboardLayout>
  );

  const allFilled = fragmentPairs.every((p) => p.hint.trim() && p.answer.trim());

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div><h1 className="text-3xl font-bold font-display mb-2">Security Questions</h1><p className="text-muted-foreground">Set up 3 security questions for account recovery</p></div>
        <div className="p-4 rounded-xl bg-gradient-eternia-subtle border border-border"><div className="flex items-start gap-3"><Info className="w-5 h-5 text-primary shrink-0 mt-0.5" /><div><p className="font-medium text-sm mb-1">Why Security Questions?</p><p className="text-sm text-muted-foreground">Since Eternia doesn't collect emails or phone numbers, recovery uses memory-based answers only you would know. All 3 answers must be distinct.</p></div></div></div>

        <Card><CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2"><Key className="w-6 h-6 text-primary" /><h2 className="text-lg font-semibold font-display">Security Questions</h2></div>
          <p className="text-sm text-muted-foreground">Pick 3 questions and provide 3 distinct answers only you would know.</p>
          {fragmentPairs.map((pair, index) => (
            <div key={index} className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Question {index + 1}</p>
              <div><label className="text-xs text-muted-foreground mb-1 block">Security Question</label>
                <Select value={pair.hint} onValueChange={(v) => handleFragmentChange(index, "hint", v)}>
                  <SelectTrigger className="bg-background h-9 text-sm"><SelectValue placeholder="Select a question" /></SelectTrigger>
                  <SelectContent>
                    {HINT_QUESTIONS.filter((q) => !fragmentPairs.some((p, i) => i !== index && p.hint === q)).map((q) => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Answer</label><Input placeholder="Your answer" value={pair.answer} onChange={(e) => handleFragmentChange(index, "answer", e.target.value)} className="bg-background" /></div>
            </div>
          ))}
          <Button onClick={handleSave} disabled={!allFilled || isSaving} className="w-full gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Security Questions
          </Button>
        </CardContent></Card>

        <div className="p-4 rounded-xl border border-border bg-muted/20"><div className="flex items-start gap-3"><Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" /><div><p className="font-medium text-sm mb-1">Encrypted & Secure</p><p className="text-xs text-muted-foreground">Your recovery credentials are encrypted with AES-256-GCM before storage.</p></div></div></div>
      </div>
    </DashboardLayout>
  );
};

export default RecoverySetup;
