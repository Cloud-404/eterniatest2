import { useState, useRef, useMemo, useCallback } from "react";
import { Camera, Upload, Loader2, User, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createAvatar } from "@dicebear/core";
import { lorelei, bottts, avataaars, funEmoji, notionists } from "@dicebear/collection";
import BoringAvatar from "boring-avatars";
import Avvvatars from "avvvatars-react";
import NiceAvatar, { genConfig } from "react-nice-avatar";
import AvatarEditor from "react-avatar-editor";
import ResolvedAvatar from "./ResolvedAvatar";

// ── DiceBear ──────────────────────────────────────────────
const DICEBEAR_STYLES: Record<string, any> = { lorelei, bottts, avataaars, funEmoji, notionists };
const DICEBEAR_LABELS: Record<string, string> = {
  lorelei: "Lorelei", bottts: "Robots", avataaars: "Avataaars",
  funEmoji: "Fun Emoji", notionists: "Notionists",
};

/** Generate a DiceBear avatar data URI */
export const getDiceBearUri = (styleName: string, seed: string): string => {
  const style = DICEBEAR_STYLES[styleName];
  if (!style) return "";
  return createAvatar(style, { seed, size: 128 }).toDataUri();
};

// ── Boring Avatars ────────────────────────────────────────
const BORING_VARIANTS = ["beam", "marble", "pixel", "sunset", "ring", "bauhaus"] as const;
const BORING_COLORS = ["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"];

// ── Avvvatars ─────────────────────────────────────────────
const AVVVATARS_STYLES = ["character", "shape"] as const;

// ── Seeds ─────────────────────────────────────────────────
const SEEDS = Array.from({ length: 12 }, (_, i) => `seed-${i + 1}`);

// ── Category config ───────────────────────────────────────
type AvatarCategory = "dicebear" | "boring" | "avvvatars" | "niceavatar";
const CATEGORY_LABELS: Record<AvatarCategory, string> = {
  dicebear: "DiceBear",
  boring: "Boring Avatars",
  avvvatars: "Avvvatars",
  niceavatar: "Nice Avatar",
};

/** Backward-compat resolver (returns string | null). Use ResolvedAvatar for rendering. */
export const resolveAvatarUrl = (url: string | null | undefined, fallbackSeed?: string): string | null => {
  if (!url && fallbackSeed) return getDiceBearUri("bottts", fallbackSeed);
  if (!url) return null;
  if (url.startsWith("dicebear:")) {
    const [, style, seed] = url.split(":");
    return getDiceBearUri(style, seed);
  }
  if (url.startsWith("emoji:") || url.startsWith("boring:") || url.startsWith("avvvatars:") || url.startsWith("niceavatar:")) {
    return null; // These need React components — use ResolvedAvatar
  }
  return url;
};

// ── Props ─────────────────────────────────────────────────
interface AvatarUploadProps {
  size?: "sm" | "lg";
  institutionId?: string;
  institutionLogoUrl?: string | null;
  onLogoUpdated?: (url: string) => void;
}

const AvatarUpload = ({ size = "lg", institutionId, institutionLogoUrl, onLogoUpdated }: AvatarUploadProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<AvatarCategory>("dicebear");
  const [subStyle, setSubStyle] = useState("lorelei");
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1.2);

  const isInstitution = !!institutionId;
  const currentUrl = isInstitution ? institutionLogoUrl : profile?.avatar_url;
  const isStudent = profile?.role === "student";
  const pixelSize = size === "lg" ? 80 : 56;

  // Students get a static deterministic avatar (no edit)
  if (!isInstitution && isStudent) {
    return <ResolvedAvatar url={currentUrl} fallbackSeed={user?.id} size={pixelSize} />;
  }

  // ── Save helpers ──────────────────────────────────────
  const saveAvatarUrl = async (avatarUrl: string) => {
    if (!user) return;
    setUploading(true);
    try {
      if (isInstitution) {
        const { error } = await supabase.from("institutions").update({ logo_url: avatarUrl } as any).eq("id", institutionId);
        if (error) throw error;
        onLogoUpdated?.(avatarUrl);
      } else {
        const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
        if (error) throw error;
        await refreshProfile();
      }
      toast.success("Avatar updated");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setEditFile(file);
  };

  const handleCropSave = async () => {
    if (!editorRef.current || !user) return;
    setUploading(true);
    try {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas export failed"))), "image/png")
      );
      const folder = isInstitution ? `institutions/${institutionId}` : user.id;
      const filename = isInstitution ? "logo" : "avatar";
      const path = `${folder}/${filename}.png`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await saveAvatarUrl(publicUrl);
      setEditFile(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  // ── Preset grids ──────────────────────────────────────
  const renderPresetGrid = () => {
    if (category === "dicebear") {
      return (
        <>
          <Select value={subStyle} onValueChange={setSubStyle}>
            <SelectTrigger className="h-9 text-xs bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DICEBEAR_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-4 gap-2">
            {SEEDS.map((seed) => {
              const uri = getDiceBearUri(subStyle, seed);
              return (
                <button key={seed} onClick={() => saveAvatarUrl(`dicebear:${subStyle}:${seed}`)} disabled={uploading}
                  className="w-full aspect-square rounded-xl bg-muted/50 hover:bg-primary/10 border border-border hover:border-primary/30 transition-colors overflow-hidden disabled:opacity-50 p-1">
                  <img src={uri} alt={seed} className="w-full h-full" />
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (category === "boring") {
      return (
        <>
          <Select value={subStyle} onValueChange={setSubStyle}>
            <SelectTrigger className="h-9 text-xs bg-muted/30"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BORING_VARIANTS.map((v) => (
                <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-4 gap-2">
            {SEEDS.map((seed) => (
              <button key={seed} onClick={() => saveAvatarUrl(`boring:${subStyle}:${seed}`)} disabled={uploading}
                className="w-full aspect-square rounded-xl bg-muted/50 hover:bg-primary/10 border border-border hover:border-primary/30 transition-colors overflow-hidden disabled:opacity-50 p-1 flex items-center justify-center">
                <BoringAvatar size={48} name={seed} variant={subStyle as any} colors={BORING_COLORS} />
              </button>
            ))}
          </div>
        </>
      );
    }

    if (category === "avvvatars") {
      return (
        <>
          <Select value={subStyle} onValueChange={setSubStyle}>
            <SelectTrigger className="h-9 text-xs bg-muted/30"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AVVVATARS_STYLES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-4 gap-2">
            {SEEDS.map((seed) => (
              <button key={seed} onClick={() => saveAvatarUrl(`avvvatars:${subStyle}:${seed}`)} disabled={uploading}
                className="w-full aspect-square rounded-xl bg-muted/50 hover:bg-primary/10 border border-border hover:border-primary/30 transition-colors overflow-hidden disabled:opacity-50 p-1 flex items-center justify-center">
                <Avvvatars value={seed} style={subStyle as "character" | "shape"} size={48} />
              </button>
            ))}
          </div>
        </>
      );
    }

    if (category === "niceavatar") {
      return (
        <div className="grid grid-cols-4 gap-2">
          {SEEDS.map((seed) => {
            const config = genConfig(seed);
            return (
              <button key={seed} onClick={() => saveAvatarUrl(`niceavatar:${seed}`)} disabled={uploading}
                className="w-full aspect-square rounded-xl bg-muted/50 hover:bg-primary/10 border border-border hover:border-primary/30 transition-colors overflow-hidden disabled:opacity-50 p-1 flex items-center justify-center">
                <NiceAvatar style={{ width: 48, height: 48 }} {...config} />
              </button>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setOpen(true)}>
        <ResolvedAvatar url={currentUrl} fallbackSeed={user?.id} size={pixelSize} />
        <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-5 h-5 text-white" />
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditFile(null); }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isInstitution ? "Update Logo" : "Update Avatar"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="preset" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="preset" className="flex-1 text-xs">Avatars</TabsTrigger>
              <TabsTrigger value="upload" className="flex-1 text-xs">Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="preset" className="space-y-3 pt-2">
              {/* Category selector */}
              <Select value={category} onValueChange={(v) => {
                setCategory(v as AvatarCategory);
                if (v === "dicebear") setSubStyle("lorelei");
                else if (v === "boring") setSubStyle("beam");
                else if (v === "avvvatars") setSubStyle("character");
                else setSubStyle("");
              }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {renderPresetGrid()}
            </TabsContent>

            <TabsContent value="upload" className="space-y-3 pt-2">
              {!editFile ? (
                <>
                  <p className="text-xs text-muted-foreground">Upload an image (max 5MB). You can crop & zoom before saving.</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                  <Button onClick={() => fileRef.current?.click()} variant="outline" className="w-full gap-2 h-10">
                    <Upload className="w-4 h-4" /> Choose Image
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center bg-muted/30 rounded-xl p-2">
                    <AvatarEditor
                      ref={editorRef as any}
                      image={editFile}
                      width={200}
                      height={200}
                      border={20}
                      borderRadius={16}
                      scale={zoom}
                      rotate={0}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Slider
                      min={1} max={3} step={0.05}
                      value={[zoom]}
                      onValueChange={([v]) => setZoom(v)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditFile(null)}>Cancel</Button>
                    <Button className="flex-1 gap-2" onClick={handleCropSave} disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {uploading ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarUpload;
