import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, User, FileText, Send, Search, Loader2, CheckCircle2, Clock, XCircle, HelpCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

const inquirySchema = z.object({
  institution_name: z.string().trim().min(2, "Institution name is required").max(200),
  institution_type: z.enum(["university", "college", "school", "coaching", "other"]),
  student_count: z.coerce.number().int().min(1, "Must be at least 1").max(999999).optional().or(z.literal("")),
  website_url: z.string().url("Enter a valid URL").max(500).optional().or(z.literal("")),
  address_line: z.string().trim().min(5, "Address is required").max(500),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  google_maps_url: z.string().url("Enter a valid URL").max(1000).optional().or(z.literal("")),
  contact_person_name: z.string().trim().min(2, "Name is required").max(100),
  contact_person_email: z.string().trim().email("Enter a valid email").max(255),
  contact_person_phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number"),
  designation: z.string().trim().min(2, "Designation is required").max(100),
  pan_number: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN (e.g. ABCDE1234F)"),
  tan_number: z.string().trim().regex(/^[A-Z]{4}[0-9]{5}[A-Z]$/, "Enter a valid TAN (e.g. ABCD12345E)"),
  gst_number: z.string().trim().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/, "Enter a valid GST number").optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

type InquiryFormData = z.infer<typeof inquirySchema>;

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  new: { label: "Submitted", icon: Clock, color: "bg-blue-500/10 text-blue-400" },
  under_review: { label: "Under Review", icon: Search, color: "bg-amber-500/10 text-amber-400" },
  approved: { label: "Approved", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-400" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-destructive/10 text-destructive" },
  info_requested: { label: "Info Requested", icon: HelpCircle, color: "bg-purple-500/10 text-purple-400" },
};

const ContactInstitution = () => {
  const [submitting, setSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<InquiryFormData | null>(null);
  const [trackQuery, setTrackQuery] = useState("");
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackError, setTrackError] = useState("");

  const form = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      institution_type: "university",
      institution_name: "", address_line: "", city: "", state: "", pincode: "",
      contact_person_name: "", contact_person_email: "", contact_person_phone: "",
      designation: "", pan_number: "", tan_number: "",
    },
  });

  const buildInquiryHTML = (fields: { label: string; value: string }[], ticket: string, dateStr: string) => {
    const logoUrl = `${window.location.origin}/eternia_logo_main.svg`;
    const sections: { title: string; rows: [string, string][] }[] = [];
    
    // Group fields into sections
    const instFields = ["Institution Name", "Type", "Approx. Students", "Website"];
    const addrFields = ["Street Address", "City", "State", "Pincode", "Google Maps"];
    const contactFields = ["Contact Name", "Designation", "Email", "Phone"];
    const legalFields = ["PAN", "TAN", "GST"];

    const group = (title: string, keys: string[]) => {
      const rows = fields.filter(f => keys.includes(f.label)).map(f => [f.label, f.value] as [string, string]);
      if (rows.length) sections.push({ title, rows });
    };
    group("INSTITUTION DETAILS", instFields);
    group("ADDRESS", addrFields);
    group("CONTACT PERSON", contactFields);
    group("LEGAL & TAX", legalFields);
    const msg = fields.find(f => f.label === "Message");
    if (msg) sections.push({ title: "MESSAGE", rows: [["", msg.value]] });

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Eternia Inquiry - ${ticket}</title>
<style>
  @media print { body { margin: 0; } @page { margin: 20mm; } }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; background: #fff; max-width: 700px; margin: 0 auto; padding: 40px 32px; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #6c5ce7; padding-bottom: 20px; }
  .header img { height: 48px; margin-bottom: 8px; }
  .header h1 { font-size: 13px; margin: 0 0 4px; color: #6c5ce7; letter-spacing: 2px; text-transform: uppercase; }
  .header p { margin: 4px 0; color: #666; font-size: 13px; }
  .ticket-box { background: #f0edff; border-radius: 8px; padding: 12px 20px; display: inline-block; margin: 12px 0 0; }
  .ticket-box span { font-size: 20px; font-family: 'Courier New', monospace; font-weight: 700; color: #6c5ce7; }
  .section { margin: 24px 0; }
  .section-title { font-size: 11px; font-weight: 700; color: #6c5ce7; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e8e4ff; padding-bottom: 6px; }
  .row { display: flex; padding: 6px 0; font-size: 13px; }
  .row .label { width: 160px; color: #888; flex-shrink: 0; }
  .row .value { color: #1a1a2e; font-weight: 500; word-break: break-word; }
  .footer { text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
</style></head><body>
<div class="header">
  <img src="${logoUrl}" alt="Eternia" />
  <h1>Institution Onboarding Inquiry</h1>
  <div class="ticket-box"><span>${ticket}</span></div>
  <p style="margin-top:8px;font-size:11px;">Submitted on ${dateStr}</p>
</div>
${sections.map(s => `<div class="section"><div class="section-title">${s.title}</div>${s.rows.map(([l, v]) => l ? `<div class="row"><div class="label">${l}</div><div class="value">${v}</div></div>` : `<div style="font-size:13px;color:#1a1a2e;line-height:1.6;">${v}</div>`).join("")}</div>`).join("")}
<div class="footer">This is an auto-generated document from Eternia. For queries, email support@eternia.life</div>
</body></html>`;
  };

  const formDataToFields = (data: InquiryFormData): { label: string; value: string }[] => {
    const typeLabels: Record<string, string> = { university: "University", college: "College", school: "School", coaching: "Coaching Institute", other: "Other" };
    const fields: { label: string; value: string }[] = [
      { label: "Institution Name", value: data.institution_name },
      { label: "Type", value: typeLabels[data.institution_type] || data.institution_type },
    ];
    if (data.student_count) fields.push({ label: "Approx. Students", value: String(data.student_count) });
    if (data.website_url) fields.push({ label: "Website", value: data.website_url });
    fields.push(
      { label: "Street Address", value: data.address_line },
      { label: "City", value: data.city },
      { label: "State", value: data.state },
      { label: "Pincode", value: data.pincode },
    );
    if (data.google_maps_url) fields.push({ label: "Google Maps", value: data.google_maps_url });
    fields.push(
      { label: "Contact Name", value: data.contact_person_name },
      { label: "Designation", value: data.designation },
      { label: "Email", value: data.contact_person_email },
      { label: "Phone", value: data.contact_person_phone },
      { label: "PAN", value: data.pan_number },
      { label: "TAN", value: data.tan_number },
    );
    if (data.gst_number) fields.push({ label: "GST", value: data.gst_number });
    if (data.message) fields.push({ label: "Message", value: data.message });
    return fields;
  };

  const downloadInquiryHTML = (html: string, ticket: string) => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticket}-inquiry.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const onSubmit = async (data: InquiryFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        institution_name: data.institution_name,
        institution_type: data.institution_type,
        student_count: data.student_count ? Number(data.student_count) : null,
        website_url: data.website_url || null,
        address_line: data.address_line,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        google_maps_url: data.google_maps_url || null,
        contact_person_name: data.contact_person_name,
        contact_person_email: data.contact_person_email,
        contact_person_phone: data.contact_person_phone,
        designation: data.designation,
        pan_number: data.pan_number,
        tan_number: data.tan_number,
        gst_number: data.gst_number || null,
        message: data.message || null,
      };

      const { data: result, error } = await supabase
        .from("institution_inquiries" as any)
        .insert(payload as any)
        .select("ticket_number")
        .single();

      if (error) throw error;
      const ticketNum = (result as any).ticket_number;
      setTicketNumber(ticketNum);
      setSubmittedData(data);
      // Auto-download
      const fields = formDataToFields(data);
      const now = new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
      const html = buildInquiryHTML(fields, ticketNum, now);
      downloadInquiryHTML(html, ticketNum);
      toast({ title: "Application submitted!", description: "Your inquiry has been received and downloaded." });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrack = async () => {
    if (!trackQuery.trim()) return;
    setTracking(true);
    setTrackError("");
    setTrackResult(null);
    try {
      const { data, error } = await supabase
        .from("institution_inquiries" as any)
        .select("*")
        .eq("ticket_number", trackQuery.trim().toUpperCase())
        .single();

      if (error || !data) {
        setTrackError("No application found with this ticket number.");
      } else {
        setTrackResult(data);
      }
    } catch {
      setTrackError("Something went wrong. Please try again.");
    } finally {
      setTracking(false);
    }
  };

  if (ticketNumber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border/50">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold font-display">Application Submitted!</h2>
            <p className="text-sm text-muted-foreground">Your inquiry has been received. Save your ticket number to track the status.</p>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Ticket Number</p>
              <p className="text-2xl font-mono font-bold text-primary">{ticketNumber}</p>
            </div>
            <p className="text-xs text-muted-foreground">Our team will review your application and get back to you within 3-5 business days.</p>
            <div className="flex gap-2 justify-center pt-2 flex-wrap">
              {submittedData && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const fields = formDataToFields(submittedData);
                  const now = new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
                  downloadInquiryHTML(buildInquiryHTML(fields, ticketNumber!, now), ticketNumber!);
                }}>
                  <Download className="w-3.5 h-3.5" /> Download Again
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { setTicketNumber(null); setSubmittedData(null); form.reset(); }}>
                Submit Another
              </Button>
              <Link to="/">
                <Button size="sm">Back to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-sm font-bold font-display">Bring Eternia to Your Campus</h1>
            <p className="text-[11px] text-muted-foreground">Fill in your institution details to get started</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Track Application */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4" /> Track Your Application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter ticket number (e.g. ETN-INQ-00001)"
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                className="h-9 text-sm bg-background"
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
              />
              <Button size="sm" onClick={handleTrack} disabled={tracking} className="h-9 shrink-0">
                {tracking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Track"}
              </Button>
            </div>
            {trackError && <p className="text-xs text-destructive">{trackError}</p>}
            {trackResult && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">{trackResult.ticket_number}</span>
                  {(() => {
                    const cfg = STATUS_CONFIG[trackResult.status] || STATUS_CONFIG.new;
                    const Icon = cfg.icon;
                    return (
                      <Badge className={`${cfg.color} border-0 gap-1`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </Badge>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">{trackResult.institution_name} · Submitted {new Date(trackResult.created_at).toLocaleDateString()}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs mt-1"
                  onClick={() => {
                    const typeLabels: Record<string, string> = { university: "University", college: "College", school: "School", coaching: "Coaching Institute", other: "Other" };
                    const r = trackResult;
                    const fields: { label: string; value: string }[] = [
                      { label: "Institution Name", value: r.institution_name },
                      { label: "Type", value: typeLabels[r.institution_type] || r.institution_type },
                    ];
                    if (r.student_count) fields.push({ label: "Approx. Students", value: String(r.student_count) });
                    if (r.website_url) fields.push({ label: "Website", value: r.website_url });
                    fields.push(
                      { label: "Street Address", value: r.address_line },
                      { label: "City", value: r.city },
                      { label: "State", value: r.state },
                      { label: "Pincode", value: r.pincode },
                    );
                    if (r.google_maps_url) fields.push({ label: "Google Maps", value: r.google_maps_url });
                    fields.push(
                      { label: "Contact Name", value: r.contact_person_name },
                      { label: "Designation", value: r.designation },
                      { label: "Email", value: r.contact_person_email },
                      { label: "Phone", value: r.contact_person_phone },
                      { label: "PAN", value: r.pan_number },
                      { label: "TAN", value: r.tan_number },
                    );
                    if (r.gst_number) fields.push({ label: "GST", value: r.gst_number });
                    if (r.message) fields.push({ label: "Message", value: r.message });
                    const dateStr = new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
                    downloadInquiryHTML(buildInquiryHTML(fields, r.ticket_number, dateStr), r.ticket_number);
                  }}
                >
                  <Download className="w-3 h-3" /> Download Application
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Institution Details */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Institution Details</CardTitle>
                <CardDescription className="text-xs">Basic information about your institution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="institution_name" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Institution Name *</FormLabel><FormControl><Input {...field} placeholder="e.g. Delhi University" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="institution_type" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger></FormControl><SelectContent>
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="college">College</SelectItem>
                      <SelectItem value="school">School</SelectItem>
                      <SelectItem value="coaching">Coaching Institute</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="student_count" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Approx. Student Count</FormLabel><FormControl><Input {...field} type="number" placeholder="e.g. 5000" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="website_url" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Website URL</FormLabel><FormControl><Input {...field} placeholder="https://www.example.edu" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Section 2: Address */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="address_line" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Street Address *</FormLabel><FormControl><Input {...field} placeholder="123 Main Road, Sector 12" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">City *</FormLabel><FormControl><Input {...field} placeholder="New Delhi" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">State *</FormLabel><FormControl><Input {...field} placeholder="Delhi" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="pincode" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Pincode *</FormLabel><FormControl><Input {...field} placeholder="110001" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="google_maps_url" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Google Maps Link</FormLabel><FormControl><Input {...field} placeholder="https://maps.google.com/..." className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Section 3: Contact Person */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Contact Person</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="contact_person_name" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Full Name *</FormLabel><FormControl><Input {...field} placeholder="Dr. Rajesh Kumar" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="designation" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Designation *</FormLabel><FormControl><Input {...field} placeholder="Principal / Director / Admin" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="contact_person_email" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Email *</FormLabel><FormControl><Input {...field} type="email" placeholder="admin@university.edu" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="contact_person_phone" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Phone *</FormLabel><FormControl><Input {...field} placeholder="9876543210" className="h-9 text-sm bg-background" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Legal/Tax */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Legal & Tax Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="pan_number" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">PAN Number *</FormLabel><FormControl><Input {...field} placeholder="ABCDE1234F" className="h-9 text-sm bg-background uppercase" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="tan_number" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">TAN Number *</FormLabel><FormControl><Input {...field} placeholder="ABCD12345E" className="h-9 text-sm bg-background uppercase" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="gst_number" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">GST Number (Optional)</FormLabel><FormControl><Input {...field} placeholder="22ABCDE1234F1Z5" className="h-9 text-sm bg-background uppercase" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Section 5: Message */}
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-5 space-y-3">
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Additional Message (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="Any additional details about your requirements..." className="text-sm bg-background min-h-[80px]" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Application
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ContactInstitution;
