import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useJournaling } from "@/hooks/useJournaling";
import { ArrowLeft, PenLine, Trash2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const moodTags = ["😊 Happy", "😢 Sad", "😤 Frustrated", "😰 Anxious", "😌 Calm", "🤔 Reflective"];

const prompts = [
  "What made you smile today?",
  "What's one thing you learned about yourself?",
  "Describe a challenge you overcame recently.",
  "What are you looking forward to?",
  "Write about something you're proud of.",
];

const Journaling = () => {
  const { entries, isLoading, todayCount, addEntry, isAdding, deleteEntry } = useJournaling();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = () => {
    if (!content.trim()) return;
    addEntry(
      { title: title.trim() || "Untitled", content: content.trim(), mood_tag: selectedMood },
      {
        onSuccess: () => {
          setTitle("");
          setContent("");
          setSelectedMood(undefined);
          setShowForm(false);
        },
      }
    );
  };

  const randomPrompt = () => {
    setContent(prompts[Math.floor(Math.random() * prompts.length)]);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5 pb-24">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/self-help" className="w-9 h-9 rounded-xl bg-card border border-border/50 flex items-center justify-center hover:border-primary/30 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-display">Journaling</h1>
            <p className="text-sm text-muted-foreground">Guided reflective writing</p>
          </div>
        </div>

        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="w-full rounded-xl gap-2" size="lg">
            <PenLine className="w-4 h-4" /> New Entry
          </Button>
        ) : (
          <div className="rounded-2xl bg-card border border-border/40 p-4 space-y-3">
            <Input
              placeholder="Entry title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
            <div className="relative">
              <Textarea
                placeholder="Write your thoughts..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="rounded-xl resize-none"
              />
              <button
                onClick={randomPrompt}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                title="Get a writing prompt"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">How are you feeling?</p>
              <div className="flex flex-wrap gap-2">
                {moodTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedMood(selectedMood === tag ? undefined : tag)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedMood === tag
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-card border-border/50 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={isAdding || !content.trim()} className="flex-1 rounded-xl">
                {isAdding ? "Saving..." : "Save Entry"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Entries</p>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No journal entries yet. Start writing! ✍️</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-card border border-border/40 p-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">{entry.title || "Untitled"}</p>
                      {entry.mood_tag && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                          {entry.mood_tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{entry.content}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(entry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Journaling;
