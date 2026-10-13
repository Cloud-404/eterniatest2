import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  username: string;
  role: "student" | "intern" | "expert" | "spoc" | "admin" | "therapist";
  institution_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  avatar_url: string | null;
  specialty: string | null;
  bio: string | null;
  total_sessions: number;
  streak_days: number;
  training_status: string;
  training_progress: number[] | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  creditBalance: number;
  isLoading: boolean;
  profileError: boolean;
  signUp: (username: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: Error | null }>;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const fetchingRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, role, institution_id, is_active, is_verified, avatar_url, specialty, bio, total_sessions, streak_days, training_status, training_progress, created_at")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data as Profile);
      setProfileError(false);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfileError(true);
    }
  }, []);

  const fetchCreditBalance = useCallback(async (userId: string) => {
    try {
      // Use fast materialized view function for O(1) lookups
      const { data, error } = await supabase.rpc("get_credit_balance_fast", {
        _user_id: userId,
      });

      if (error) {
        // Fallback to original function if materialized view not ready
        const { data: fallback, error: fbErr } = await supabase.rpc("get_credit_balance", {
          _user_id: userId,
        });
        if (fbErr) throw fbErr;
        setCreditBalance(fallback || 0);
        return;
      }
      setCreditBalance(data || 0);
    } catch (error) {
      console.error("Error fetching credit balance:", error);
    }
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      await Promise.all([fetchProfile(userId), fetchCreditBalance(userId)]);
    } finally {
      fetchingRef.current = false;
    }
  }, [fetchProfile, fetchCreditBalance]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            if (mounted) {
              await loadUserData(session.user.id);
              if (mounted) setIsLoading(false);
            }
          }, 100);
        } else {
          setProfile(null);
          setCreditBalance(0);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadUserData(session.user.id);
      }

      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signUp = useCallback(async (username: string, password: string, metadata?: Record<string, unknown>) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: `${username.toLowerCase()}@eternia.local`,
        password,
        options: {
          data: {
            username,
            ...metadata,
          },
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const input = username.toLowerCase().trim();

    const emailsToTry = input.includes("@")
      ? [input]
      : [`${input}@eternia.local`, `${input}@eternia.com`];

    setIsLoading(true);
    setProfile(null);
    setProfileError(false);
    setCreditBalance(0);

    let lastError: Error | null = null;

    for (const email of emailsToTry) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return { error: null };
      lastError = error as Error;
    }

    setIsLoading(false);
    return { error: lastError };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCreditBalance(0);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const refreshCredits = useCallback(async () => {
    if (user) {
      await fetchCreditBalance(user.id);
    }
  }, [user, fetchCreditBalance]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        creditBalance,
        isLoading,
        profileError,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        refreshCredits,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
