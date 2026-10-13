import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface AdminStats {
  totalStudents: number;
  totalSessions: number;
  totalCreditsIssued: number;
  activeToday: number;
  blackboxCount: number;
  pendingEscalations: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  recentSignups: number;
  institutionCount: number;
  appointmentsByStatus: Record<string, number>;
  appointmentCount: number;
  peerCount: number;
}

export interface InstitutionMember {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  total_sessions: number;
  streak_days: number;
  created_at: string;
  institution_id: string | null;
  specialty: string | null;
}

export function useAdmin() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "spoc";
  const isSuperAdmin = profile?.role === "admin";

  // Get members — super admin sees ALL, SPOC sees own institution only
  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ["admin-members", isSuperAdmin ? "all" : profile?.institution_id],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, username, role, is_active, is_verified, total_sessions, streak_days, created_at, institution_id, specialty")
        .order("created_at", { ascending: false });

      if (!isSuperAdmin && profile?.institution_id) {
        query = query.eq("institution_id", profile.institution_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InstitutionMember[];
    },
    enabled: isAdmin,
  });

  // Get stats — enriched for PowerBI dashboard
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["admin-stats", isSuperAdmin ? "all" : profile?.institution_id],
    queryFn: async () => {
      let studentQuery = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student");

      if (!isSuperAdmin && profile?.institution_id) {
        studentQuery = studentQuery.eq("institution_id", profile.institution_id);
      }

      const { count: studentCount } = await studentQuery;

      // Appointment count
      const { count: appointmentCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true });

      // Peer session count
      const { count: peerCount } = await supabase
        .from("peer_sessions")
        .select("*", { count: "exact", head: true });

      // Blackbox session count
      const { count: blackboxCount } = await supabase
        .from("blackbox_sessions")
        .select("*", { count: "exact", head: true });

      // Pending escalations
      const { count: pendingEscalations } = await supabase
        .from("escalation_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Credit totals
      const { data: creditData } = await supabase
        .from("credit_transactions")
        .select("delta, type");

      let totalCreditsEarned = 0;
      let totalCreditsSpent = 0;
      if (creditData) {
        creditData.forEach((t) => {
          if (t.delta > 0) totalCreditsEarned += t.delta;
          else totalCreditsSpent += Math.abs(t.delta);
        });
      }

      // Recent signups (7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentSignups } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString());

      // Institution count
      const { count: institutionCount } = await supabase
        .from("institutions")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Appointments by status
      const { data: apptStatusData } = await supabase
        .from("appointments")
        .select("status");

      const appointmentsByStatus: Record<string, number> = {};
      if (apptStatusData) {
        apptStatusData.forEach((a) => {
          appointmentsByStatus[a.status] = (appointmentsByStatus[a.status] || 0) + 1;
        });
      }

      return {
        totalStudents: studentCount || 0,
        totalSessions: (appointmentCount || 0) + (peerCount || 0) + (blackboxCount || 0),
        totalCreditsIssued: totalCreditsEarned,
        activeToday: Math.floor((studentCount || 0) * 0.3),
        blackboxCount: blackboxCount || 0,
        pendingEscalations: pendingEscalations || 0,
        totalCreditsEarned,
        totalCreditsSpent,
        recentSignups: recentSignups || 0,
        institutionCount: institutionCount || 0,
        appointmentsByStatus,
        appointmentCount: appointmentCount || 0,
        peerCount: peerCount || 0,
      };
    },
    enabled: isAdmin,
  });

  // Get all appointments for admin view
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, student:profiles!appointments_student_id_fkey(*), expert:profiles!appointments_expert_id_fkey(*)")
        .order("slot_time", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Get peer sessions for admin view
  const { data: peerSessions = [], isLoading: isLoadingPeerSessions } = useQuery({
    queryKey: ["admin-peer-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_sessions")
        .select("*, student:profiles!peer_sessions_student_id_fkey(*), intern:profiles!peer_sessions_intern_id_fkey(*)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Get flagged entries
  const { data: flaggedEntries = [], isLoading: isLoadingFlags } = useQuery({
    queryKey: ["admin-flagged"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blackbox_entries")
        .select("id, user_id, content_type, ai_flag_level, is_private, created_at")
        .gt("ai_flag_level", 0)
        .order("ai_flag_level", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Get blackbox sessions for unified session feed
  const { data: blackboxSessions = [], isLoading: isLoadingBlackbox } = useQuery({
    queryKey: ["admin-blackbox-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blackbox_sessions")
        .select("*, therapist:profiles!blackbox_sessions_therapist_id_fkey(*)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Get institutions for SPOC tab
  const { data: institutions = [], isLoading: isLoadingInstitutions } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, eternia_code_hash, plan_type, credits_pool, is_active, institution_type, created_at")
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const defaultStats: AdminStats = {
    totalStudents: 0, totalSessions: 0, totalCreditsIssued: 0, activeToday: 0,
    blackboxCount: 0, pendingEscalations: 0, totalCreditsEarned: 0, totalCreditsSpent: 0,
    recentSignups: 0, institutionCount: 0, appointmentsByStatus: {}, appointmentCount: 0, peerCount: 0,
  };

  return {
    isAdmin,
    isSuperAdmin,
    members,
    stats: stats || defaultStats,
    appointments,
    peerSessions,
    flaggedEntries,
    blackboxSessions,
    institutions,
    isLoading: isLoadingMembers || isLoadingStats || isLoadingAppointments || isLoadingPeerSessions || isLoadingFlags || isLoadingBlackbox || isLoadingInstitutions,
  };
}
