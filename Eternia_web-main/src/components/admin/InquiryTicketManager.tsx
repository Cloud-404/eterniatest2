import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Search, Loader2, ChevronDown, ChevronUp, Building2, MapPin, User, FileText, Clock, CheckCircle2, XCircle, HelpCircle, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-500/10 text-blue-400" },
  { value: "under_review", label: "Under Review", color: "bg-amber-500/10 text-amber-400" },
  { value: "approved", label: "Approved", color: "bg-emerald-500/10 text-emerald-400" },
  { value: "rejected", label: "Rejected", color: "bg-destructive/10 text-destructive" },
  { value: "info_requested", label: "Info Requested", color: "bg-purple-500/10 text-purple-400" },
];

const InquiryTicketManager = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["institution-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_inquiries" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes: string }) => {
      const { error } = await supabase
        .from("institution_inquiries" as any)
        .update({ status, admin_notes, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institution-inquiries"] });
      toast({ title: "Ticket updated" });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const filtered = inquiries.filter((inq: any) => {
    if (statusFilter !== "all" && inq.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return inq.ticket_number?.toLowerCase().includes(q) ||
        inq.institution_name?.toLowerCase().includes(q) ||
        inq.contact_person_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    return <Badge className={`${cfg.color} border-0 text-[10px]`}>{cfg.label}</Badge>;
  };

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by ticket, name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-card" />
        </div>
        <div className="flex gap-1">
          {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === s.value ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} inquiries</p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border/50">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No inquiries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inq: any) => {
            const isExpanded = expandedId === inq.id;
            return (
              <div key={inq.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
                {/* Row summary */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{inq.ticket_number}</span>
                      {getStatusBadge(inq.status)}
                    </div>
                    <p className="text-sm font-medium truncate mt-0.5">{inq.institution_name}</p>
                    <p className="text-[11px] text-muted-foreground">{inq.contact_person_name} · {inq.contact_person_email}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(inq.created_at), "dd MMM yyyy")}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border/30 p-4 space-y-4 bg-muted/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Institution */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-primary" /> Institution</h4>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p><span className="text-foreground font-medium">Name:</span> {inq.institution_name}</p>
                          <p><span className="text-foreground font-medium">Type:</span> {inq.institution_type}</p>
                          {inq.student_count && <p><span className="text-foreground font-medium">Students:</span> ~{inq.student_count.toLocaleString()}</p>}
                          {inq.website_url && <p><span className="text-foreground font-medium">Website:</span> <a href={inq.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{inq.website_url}</a></p>}
                        </div>
                      </div>

                      {/* Address */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> Address</h4>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p>{inq.address_line}</p>
                          <p>{inq.city}, {inq.state} — {inq.pincode}</p>
                          {inq.google_maps_url && <a href={inq.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[11px]">View on Maps ↗</a>}
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary" /> Contact Person</h4>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p><span className="text-foreground font-medium">{inq.contact_person_name}</span> ({inq.designation})</p>
                          <p>{inq.contact_person_email}</p>
                          <p>{inq.contact_person_phone}</p>
                        </div>
                      </div>

                      {/* Legal */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-primary" /> Legal</h4>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p><span className="text-foreground font-medium">PAN:</span> {inq.pan_number}</p>
                          <p><span className="text-foreground font-medium">TAN:</span> {inq.tan_number}</p>
                          {inq.gst_number && <p><span className="text-foreground font-medium">GST:</span> {inq.gst_number}</p>}
                        </div>
                      </div>
                    </div>

                    {inq.message && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-semibold mb-1">Message</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{inq.message}</p>
                      </div>
                    )}

                    {/* Admin actions */}
                    <div className="border-t border-border/30 pt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">Update Status</p>
                          <Select
                            defaultValue={inq.status}
                            onValueChange={(val) => {
                              updateMutation.mutate({ id: inq.id, status: val, admin_notes: editNotes[inq.id] ?? inq.admin_notes ?? "" });
                            }}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Admin Notes</p>
                        <Textarea
                          value={editNotes[inq.id] ?? inq.admin_notes ?? ""}
                          onChange={(e) => setEditNotes({ ...editNotes, [inq.id]: e.target.value })}
                          placeholder="Internal notes..."
                          className="text-xs min-h-[60px] bg-background"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 mt-1"
                          onClick={() => updateMutation.mutate({ id: inq.id, status: inq.status, admin_notes: editNotes[inq.id] ?? inq.admin_notes ?? "" })}
                          disabled={updateMutation.isPending}
                        >
                          Save Notes
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InquiryTicketManager;
