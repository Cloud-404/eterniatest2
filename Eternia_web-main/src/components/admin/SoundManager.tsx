import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Music, Plus, Trash2, Edit2, Save, X, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface SoundForm {
  title: string;
  artist: string;
  category: string;
  description: string;
  duration_sec: string;
  cover_emoji: string;
  file_url: string;
}

const EMPTY_FORM: SoundForm = {
  title: "", artist: "", category: "meditation", description: "",
  duration_sec: "", cover_emoji: "🎵", file_url: "",
};

const CATEGORIES = ["meditation", "relaxation", "focus", "sleep", "nature", "ambient"];

export default function SoundManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SoundForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: sounds = [], isLoading } = useQuery({
    queryKey: ["admin-sounds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sound_content").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isAudio = file.type.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "flac", "aac", "mp4"].includes(ext);
    if (!isAudio) {
      toast.error("Please select an audio file (mp3, wav, m4a, ogg, etc.)");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("sound-files").upload(fileName, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("sound-files").getPublicUrl(fileName);
      setForm((p) => ({ ...p, file_url: urlData.publicUrl }));
      setUploadedFileName(file.name);

      // Auto-detect duration
      const audio = new Audio(urlData.publicUrl);
      audio.addEventListener("loadedmetadata", () => {
        if (audio.duration && isFinite(audio.duration)) {
          setForm((p) => ({ ...p, duration_sec: Math.round(audio.duration).toString() }));
        }
      });

      toast.success("Audio uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        artist: form.artist || null,
        category: form.category,
        description: form.description || null,
        duration_sec: form.duration_sec ? parseInt(form.duration_sec) : null,
        cover_emoji: form.cover_emoji || null,
        file_url: form.file_url || null,
        is_active: true,
      };
      if (editingId) {
        const { error } = await supabase.from("sound_content").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sound_content").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sounds"] });
      queryClient.invalidateQueries({ queryKey: ["sound-content"] });
      toast.success(editingId ? "Updated!" : "Added!");
      resetForm();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sound_content").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sounds"] });
      queryClient.invalidateQueries({ queryKey: ["sound-content"] });
      toast.success("Deleted!");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); setUploadedFileName(null); };

  const startEdit = (sound: any) => {
    setForm({
      title: sound.title, artist: sound.artist || "", category: sound.category,
      description: sound.description || "", duration_sec: sound.duration_sec?.toString() || "",
      cover_emoji: sound.cover_emoji || "🎵", file_url: sound.file_url || "",
    });
    setEditingId(sound.id);
    setShowForm(true);
    setUploadedFileName(sound.file_url ? "Existing file" : null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          Sounds ({sounds.length})
        </h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {showForm && (
        <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">{editingId ? "Edit" : "Add"} Sound</p>
            <Button variant="ghost" size="icon" onClick={resetForm} className="h-7 w-7"><X className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Title *" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="h-9" />
            <Input placeholder="Artist" value={form.artist} onChange={(e) => setForm((p) => ({ ...p, artist: e.target.value }))} className="h-9" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Dur (sec)" type="number" value={form.duration_sec} onChange={(e) => setForm((p) => ({ ...p, duration_sec: e.target.value }))} className="h-9" />
            <Input placeholder="Emoji" value={form.cover_emoji} onChange={(e) => setForm((p) => ({ ...p, cover_emoji: e.target.value }))} className="h-9" />
          </div>
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="h-9" />

          {/* Upload Audio */}
          <div className="space-y-1.5">
            <input ref={fileInputRef} type="file" accept="audio/*, .mp3, .wav, .m4a, .ogg, .flac, .aac" className="hidden" onChange={handleFileUpload} />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 h-9 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "Uploading..." : uploadedFileName || "Upload Audio File"}
            </Button>
            {form.file_url && (
              <p className="text-[10px] text-muted-foreground truncate px-1">✓ {form.file_url.split("/").pop()}</p>
            )}
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending} className="w-full gap-1.5 h-8 text-xs" size="sm">
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {editingId ? "Update" : "Add"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : sounds.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-xs">No sounds yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {sounds.map((sound: any) => (
            <div key={sound.id} className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/50 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg shrink-0">{sound.cover_emoji || "🎵"}</span>
                <div className="min-w-0">
                  <p className="font-medium text-xs truncate">{sound.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {sound.category} · {sound.artist || "?"} · {sound.duration_sec ? `${Math.floor(sound.duration_sec / 60)}:${(sound.duration_sec % 60).toString().padStart(2, "0")}` : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${sound.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                  {sound.is_active ? "On" : "Off"}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(sound)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(sound.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
