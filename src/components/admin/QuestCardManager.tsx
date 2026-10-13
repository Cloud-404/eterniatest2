import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Loader2, Save, X, Eye, Award } from "lucide-react";
import { format } from "date-fns";

const QuestCardManager = () => {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newXp, setNewXp] = useState("10");
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", xp_reward: "10", category: "" });

  // Fetch all quest cards (admin sees all including inactive)
  const { data: questCards = [], isLoading: loadingCards } = useQuery({
    queryKey: ["admin-quest-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all completions with answer
  const { data: allCompletions = [], isLoading: loadingCompletions } = useQuery({
    queryKey: ["admin-quest-completions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_completions")
        .select("id, user_id, quest_id, completed_date, completed_at, answer")
        .order("completed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for usernames
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-for-quests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username");
      if (error) throw error;
      return data;
    },
  });

  const addCard = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim() || !newDesc.trim()) throw new Error("Title and description required");
      const { error } = await supabase.from("quest_cards").insert({
        title: newTitle.trim(),
        description: newDesc.trim(),
        xp_reward: parseInt(newXp) || 10,
        category: newCategory.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quest-cards"] });
      queryClient.invalidateQueries({ queryKey: ["quest-cards"] });
      setNewTitle(""); setNewDesc(""); setNewXp("10"); setNewCategory("");
      toast.success("Question added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quest_cards").update({
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        xp_reward: parseInt(editForm.xp_reward) || 10,
        category: editForm.category.trim() || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quest-cards"] });
      queryClient.invalidateQueries({ queryKey: ["quest-cards"] });
      setEditingId(null);
      toast.success("Question updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("quest_cards").update({ is_active: !is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quest-cards"] });
      queryClient.invalidateQueries({ queryKey: ["quest-cards"] });
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quest_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quest-cards"] });
      queryClient.invalidateQueries({ queryKey: ["quest-cards"] });
      toast.success("Question deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const getUsername = (userId: string) => profiles.find(p => p.id === userId)?.username || "Unknown";
  const getQuestTitle = (questId: string) => questCards.find(q => q.id === questId)?.title || "Deleted";

  return (
    <Tabs defaultValue="questions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="questions" className="gap-1.5"><Award className="w-3.5 h-3.5" />Questions</TabsTrigger>
        <TabsTrigger value="answers" className="gap-1.5"><Eye className="w-3.5 h-3.5" />Answers</TabsTrigger>
      </TabsList>

      <TabsContent value="questions" className="space-y-4">
        {/* Add new question */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add New Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Question title (shown on card)" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <Input placeholder="Description / prompt" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <div className="flex gap-2">
              <Input type="number" placeholder="XP" value={newXp} onChange={e => setNewXp(e.target.value)} className="w-24" />
              <Input placeholder="Category (optional)" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="flex-1" />
              <Button onClick={() => addCard.mutate()} disabled={addCard.isPending || !newTitle.trim() || !newDesc.trim()} className="gap-1.5">
                {addCard.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing questions */}
        {loadingCards ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : questCards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No questions yet. Add one above.</div>
        ) : (
          <div className="space-y-2">
            {questCards.map((card) => (
              <div key={card.id} className={`p-3 rounded-xl border transition-all ${card.is_active ? "bg-card border-border/50" : "bg-muted/30 border-border/30 opacity-70"}`}>
                {editingId === card.id ? (
                  <div className="space-y-2">
                    <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                    <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                    <div className="flex gap-2">
                      <Input type="number" value={editForm.xp_reward} onChange={e => setEditForm(f => ({ ...f, xp_reward: e.target.value }))} className="w-24" />
                      <Input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} placeholder="Category" className="flex-1" />
                      <Button size="sm" onClick={() => updateCard.mutate(card.id)} disabled={updateCard.isPending} className="gap-1"><Save className="w-3.5 h-3.5" />Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{card.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{card.description}</p>
                    </div>
                    <span className="text-xs font-medium text-primary shrink-0">+{card.xp_reward} XP</span>
                    {card.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{card.category}</span>}
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => toggleActive.mutate({ id: card.id, is_active: card.is_active })}>
                      <span className={`w-2.5 h-2.5 rounded-full ${card.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => { setEditingId(card.id); setEditForm({ title: card.title, description: card.description, xp_reward: String(card.xp_reward), category: card.category || "" }); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteCard.mutate(card.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="answers" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">User Answers</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCompletions ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : allCompletions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No answers yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCompletions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-xs">{getUsername(c.user_id)}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{getQuestTitle(c.quest_id)}</TableCell>
                      <TableCell className="text-xs max-w-[300px]">{c.answer || <span className="text-muted-foreground italic">No answer</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(c.completed_at), "MMM d, h:mm a")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default QuestCardManager;
