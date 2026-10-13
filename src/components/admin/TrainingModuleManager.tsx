import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  BookOpen, Plus, Pencil, Trash2, Loader2, GripVertical,
  ChevronUp, ChevronDown, X
} from "lucide-react";
import { toast } from "sonner";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface TrainingModule {
  id: string;
  day_number: number;
  title: string;
  description: string;
  duration: string;
  objectives: string[];
  content: string;
  has_quiz: boolean;
  quiz_questions: QuizQuestion[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const emptyModule = {
  day_number: 0,
  title: "",
  description: "",
  duration: "30 min",
  objectives: [] as string[],
  content: "",
  has_quiz: false,
  quiz_questions: [] as QuizQuestion[],
  is_active: true,
};

const TrainingModuleManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [form, setForm] = useState(emptyModule);
  const [objectivesText, setObjectivesText] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["training-modules-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .order("day_number", { ascending: true });
      if (error) throw error;
      return (data as any[]) as TrainingModule[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (mod: typeof form & { id?: string }) => {
      const payload = {
        day_number: mod.day_number,
        title: mod.title,
        description: mod.description,
        duration: mod.duration,
        objectives: mod.objectives as any,
        content: mod.content,
        has_quiz: mod.has_quiz,
        quiz_questions: mod.quiz_questions as any,
        is_active: mod.is_active,
        updated_at: new Date().toISOString(),
      };
      if (mod.id) {
        const { error } = await supabase.from("training_modules").update(payload).eq("id", mod.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_modules").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules-admin"] });
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      toast.success(editingModule ? "Module updated" : "Module created");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules-admin"] });
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      toast.success("Module deleted");
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("training_modules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules-admin"] });
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingModule(null);
    const nextDay = modules.length > 0 ? Math.max(...modules.map(m => m.day_number)) + 1 : 1;
    setForm({ ...emptyModule, day_number: nextDay });
    setObjectivesText("");
    setDialogOpen(true);
  };

  const openEdit = (mod: TrainingModule) => {
    setEditingModule(mod);
    setForm({
      day_number: mod.day_number,
      title: mod.title,
      description: mod.description,
      duration: mod.duration,
      objectives: mod.objectives || [],
      content: mod.content,
      has_quiz: mod.has_quiz,
      quiz_questions: mod.quiz_questions || [],
      is_active: mod.is_active,
    });
    setObjectivesText((mod.objectives || []).join("\n"));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingModule(null);
    setForm(emptyModule);
    setObjectivesText("");
  };

  const handleSave = () => {
    if (!form.title || !form.description || form.day_number < 1) {
      toast.error("Title, description, and day number are required");
      return;
    }
    const objectives = objectivesText.split("\n").map(s => s.trim()).filter(Boolean);
    upsertMutation.mutate({
      ...form,
      objectives,
      id: editingModule?.id,
    });
  };

  // Quiz question management
  const addQuizQuestion = () => {
    setForm(f => ({
      ...f,
      quiz_questions: [...f.quiz_questions, { question: "", options: ["", "", "", ""], correctIndex: 0 }],
    }));
  };

  const updateQuizQuestion = (idx: number, field: string, value: any) => {
    setForm(f => ({
      ...f,
      quiz_questions: f.quiz_questions.map((q, i) =>
        i === idx ? { ...q, [field]: value } : q
      ),
    }));
  };

  const updateQuizOption = (qIdx: number, oIdx: number, value: string) => {
    setForm(f => ({
      ...f,
      quiz_questions: f.quiz_questions.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => j === oIdx ? value : o) } : q
      ),
    }));
  };

  const removeQuizQuestion = (idx: number) => {
    setForm(f => ({ ...f, quiz_questions: f.quiz_questions.filter((_, i) => i !== idx) }));
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />Training Modules ({modules.length})
        </h3>
        <Button size="sm" className="gap-1 h-8 text-xs" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" />Add Module
        </Button>
      </div>

      <div className="space-y-2">
        {modules.map((mod) => (
          <div key={mod.id} className={`p-4 rounded-2xl border flex items-start gap-3 ${mod.is_active ? "bg-card border-border/50" : "bg-muted/20 border-border/30 opacity-60"}`}>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 font-bold text-sm text-primary">
              {mod.day_number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{mod.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{mod.duration}</span>
                {mod.has_quiz && <span className="px-1.5 py-0.5 rounded text-[10px] bg-eternia-warning/10 text-eternia-warning">Quiz</span>}
                <span className="text-[10px] text-muted-foreground">{(mod.objectives as string[])?.length || 0} objectives</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Switch
                checked={mod.is_active}
                onCheckedChange={(v) => toggleActiveMutation.mutate({ id: mod.id, is_active: v })}
                className="scale-75"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(mod)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(mod.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModule ? "Edit Module" : "Add Training Module"}</DialogTitle>
            <DialogDescription>Configure module content, objectives, and quiz questions.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Day Number</Label>
                <Input type="number" min={1} value={form.day_number} onChange={e => setForm(f => ({ ...f, day_number: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Duration</Label>
                <Input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 45 min" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Content (Markdown)</Label>
              <Textarea rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Objectives (one per line)</Label>
              <Textarea rows={4} value={objectivesText} onChange={e => setObjectivesText(e.target.value)} placeholder="One objective per line..." />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.has_quiz} onCheckedChange={v => setForm(f => ({ ...f, has_quiz: v }))} />
              <Label className="text-xs">Has Quiz</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label className="text-xs">Active</Label>
            </div>

            {form.has_quiz && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Quiz Questions</Label>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addQuizQuestion}>
                    <Plus className="w-3 h-3" />Add Question
                  </Button>
                </div>
                {form.quiz_questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground mt-2">Q{qIdx + 1}</span>
                      <Input className="flex-1" value={q.question} onChange={e => updateQuizQuestion(qIdx, "question", e.target.value)} placeholder="Question..." />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeQuizQuestion(qIdx)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2 ml-6">
                        <input
                          type="radio"
                          name={`correct-${qIdx}`}
                          checked={q.correctIndex === oIdx}
                          onChange={() => updateQuizQuestion(qIdx, "correctIndex", oIdx)}
                          className="accent-primary"
                        />
                        <Input className="flex-1 h-8 text-xs" value={opt} onChange={e => updateQuizOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} />
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground ml-6">Select the radio button for the correct answer</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingModule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Module?</DialogTitle>
            <DialogDescription>This action cannot be undone. The module will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingModuleManager;
