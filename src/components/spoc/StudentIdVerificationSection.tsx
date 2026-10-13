import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BadgeCheck, Upload, Loader2, CheckCircle, XCircle, FileText,
} from "lucide-react";

interface Props {
  institutionId: string | null | undefined;
  institutionType: string | null | undefined;
}

/** SHA-256 hash matching the edge function format */
async function hashStudentId(institutionId: string, idType: string, rawId: string): Promise<string> {
  const input = `eternia:${institutionId}:${idType}:${rawId}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Mask a raw ID for display: show last 4 chars */
function maskId(rawId: string): string {
  if (rawId.length <= 4) return "••••";
  return "•".repeat(rawId.length - 4) + rawId.slice(-4);
}

const StudentIdVerificationSection = ({ institutionId, institutionType }: Props) => {
  const queryClient = useQueryClient();
  const [idsText, setIdsText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const idType = institutionType === "school" ? "erp" : "apaar";
  const idLabel = idType === "apaar" ? "APAAR / ABC ID" : "ERP ID (Admission No.)";

  const { data: validIds = [], isLoading } = useQuery({
    queryKey: ["institution-student-ids", institutionId],
    queryFn: async () => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("institution_student_ids")
        .select("id, id_type, student_id_hash, is_claimed, claimed_by, created_at")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!institutionId,
  });

  // Get profiles for claimed IDs
  const claimedByIds = validIds.filter(v => v.claimed_by).map(v => v.claimed_by!);
  const { data: claimedProfiles = [] } = useQuery({
    queryKey: ["claimed-profiles", claimedByIds],
    queryFn: async () => {
      if (claimedByIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", claimedByIds);
      if (error) throw error;
      return data;
    },
    enabled: claimedByIds.length > 0,
  });

  const profileMap = Object.fromEntries(claimedProfiles.map(p => [p.id, p.username]));

  const totalIds = validIds.length;
  const claimedCount = validIds.filter(v => v.is_claimed).length;
  const unclaimedCount = totalIds - claimedCount;

  const handleBulkUpload = async () => {
    if (!institutionId || !idsText.trim()) return;
    setIsUploading(true);
    try {
      const rawIds = idsText
        .split(/[\n,;]+/)
        .map(id => id.trim())
        .filter(id => id.length >= 3);

      if (rawIds.length === 0) {
        toast.error("No valid IDs found. Each ID must be at least 3 characters.");
        setIsUploading(false);
        return;
      }

      const uniqueIds = [...new Set(rawIds)];

      // Hash all IDs before storing
      const rows = await Promise.all(
        uniqueIds.map(async (id) => ({
          institution_id: institutionId,
          id_type: idType,
          student_id_hash: await hashStudentId(institutionId, idType, id),
        }))
      );

      let inserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error, data } = await supabase
          .from("institution_student_ids")
          .upsert(batch, { onConflict: "institution_id,id_type,student_id_hash", ignoreDuplicates: true })
          .select();
        if (error) throw error;
        inserted += (data?.length || 0);
      }
      const skipped = uniqueIds.length - inserted;

      toast.success(`Uploaded ${inserted} IDs${skipped > 0 ? `, ${skipped} duplicates skipped` : ""}`);
      setIdsText("");
      queryClient.invalidateQueries({ queryKey: ["institution-student-ids", institutionId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload IDs");
    }
    setIsUploading(false);
  };

  if (!institutionId) return null;

  return (
    <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <BadgeCheck className="w-4 h-4 text-primary" />
        Student ID Verification ({idLabel})
      </h3>
      <p className="text-xs text-muted-foreground">
        Upload valid {idLabel}s so students can be verified during onboarding. IDs are hashed before storage — raw values are never persisted.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <p className="text-lg font-bold text-primary">{totalIds}</p>
          <p className="text-[10px] text-muted-foreground">Total IDs</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <p className="text-lg font-bold text-eternia-success">{claimedCount}</p>
          <p className="text-[10px] text-muted-foreground">Claimed</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
          <p className="text-lg font-bold text-eternia-warning">{unclaimedCount}</p>
          <p className="text-[10px] text-muted-foreground">Unclaimed</p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Paste {idLabel}s (one per line, comma, or semicolon separated)
        </label>
        <Textarea
          placeholder={idType === "apaar" ? "123456789012\n234567890123\n345678901234" : "ERP001\nERP002\nERP003"}
          value={idsText}
          onChange={(e) => setIdsText(e.target.value)}
          className="min-h-[100px] text-sm font-mono bg-muted/20"
        />
        <Button
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={handleBulkUpload}
          disabled={isUploading || !idsText.trim()}
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload IDs
        </Button>
      </div>

      {/* Verification Status Table */}
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : validIds.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">No IDs uploaded yet</p>
        </div>
      ) : (
        <div className="max-h-[250px] overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
          <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider sticky top-0">
            <span>Hash (masked)</span>
            <span>Status</span>
            <span>Claimed By</span>
            <span>Date</span>
          </div>
          {validIds.map((item) => (
            <div key={item.id} className="grid grid-cols-4 gap-2 px-3 py-2 items-center">
              <span className="text-xs font-mono truncate" title="Hashed — original ID not stored">
                {item.student_id_hash.slice(0, 8)}…{item.student_id_hash.slice(-4)}
              </span>
              <span className="flex items-center gap-1">
                {item.is_claimed ? (
                  <><CheckCircle className="w-3 h-3 text-eternia-success" /><span className="text-[10px] text-eternia-success">Claimed</span></>
                ) : (
                  <><XCircle className="w-3 h-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Available</span></>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {item.claimed_by ? (profileMap[item.claimed_by] || "—") : "—"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentIdVerificationSection;
