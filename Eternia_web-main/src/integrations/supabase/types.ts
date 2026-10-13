export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          country: string | null
          created_at: string
          event_type: string
          id: string
          page_path: string
          referrer: string | null
          screen_size: string | null
          session_hash: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          page_path: string
          referrer?: string | null
          screen_size?: string | null
          session_hash: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          page_path?: string
          referrer?: string | null
          screen_size?: string | null
          session_hash?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          completed_at: string | null
          created_at: string
          credits_charged: number
          expert_id: string
          id: string
          reschedule_reason: string | null
          rescheduled_by: string | null
          rescheduled_from: string | null
          room_id: string | null
          session_notes_encrypted: string | null
          session_type: string
          slot_id: string | null
          slot_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credits_charged?: number
          expert_id: string
          id?: string
          reschedule_reason?: string | null
          rescheduled_by?: string | null
          rescheduled_from?: string | null
          room_id?: string | null
          session_notes_encrypted?: string | null
          session_type?: string
          slot_id?: string | null
          slot_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credits_charged?: number
          expert_id?: string
          id?: string
          reschedule_reason?: string | null
          rescheduled_by?: string | null
          rescheduled_from?: string | null
          room_id?: string | null
          session_notes_encrypted?: string | null
          session_type?: string
          slot_id?: string | null
          slot_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "expert_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blackbox_entries: {
        Row: {
          ai_flag_level: number
          content_encrypted: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          is_private: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_flag_level?: number
          content_encrypted: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          is_private?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_flag_level?: number
          content_encrypted?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          is_private?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blackbox_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blackbox_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          escalation_history: Json | null
          escalation_reason: string | null
          flag_level: number
          id: string
          last_join_error: string | null
          refunded: boolean
          room_id: string | null
          session_notes_encrypted: string | null
          silence_duration_sec: number | null
          started_at: string | null
          status: string
          student_id: string
          student_joined_at: string | null
          therapist_id: string | null
          therapist_joined_at: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          escalation_history?: Json | null
          escalation_reason?: string | null
          flag_level?: number
          id?: string
          last_join_error?: string | null
          refunded?: boolean
          room_id?: string | null
          session_notes_encrypted?: string | null
          silence_duration_sec?: number | null
          started_at?: string | null
          status?: string
          student_id: string
          student_joined_at?: string | null
          therapist_id?: string | null
          therapist_joined_at?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          escalation_history?: Json | null
          escalation_reason?: string | null
          flag_level?: number
          id?: string
          last_join_error?: string | null
          refunded?: boolean
          room_id?: string | null
          session_notes_encrypted?: string | null
          silence_duration_sec?: number | null
          started_at?: string | null
          status?: string
          student_id?: string
          student_joined_at?: string | null
          therapist_id?: string | null
          therapist_joined_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blackbox_sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          created_at: string
          delta: number
          id: string
          institution_id: string | null
          notes: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["credit_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          institution_id?: string | null
          notes?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["credit_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          institution_id?: string | null
          notes?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["credit_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sessions: {
        Row: {
          created_at: string
          device_id_hash: string
          expires_at: string
          id: string
          refresh_token_hash: string
          revoked: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id_hash: string
          expires_at: string
          id?: string
          refresh_token_hash: string
          revoked?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          device_id_hash?: string
          expires_at?: string
          id?: string
          refresh_token_hash?: string
          revoked?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ecc_stability_pool: {
        Row: {
          balance: number
          id: string
          institution_id: string | null
          total_contributed: number
          total_disbursed: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          institution_id?: string | null
          total_contributed?: number
          total_disbursed?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          institution_id?: string | null
          total_contributed?: number
          total_disbursed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecc_stability_pool_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_requests: {
        Row: {
          admin_id: string | null
          created_at: string
          entry_id: string | null
          escalation_level: number | null
          id: string
          justification_encrypted: string
          resolved_at: string | null
          session_id: string | null
          spoc_id: string
          status: string
          trigger_snippet: string | null
          trigger_timestamp: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          entry_id?: string | null
          escalation_level?: number | null
          id?: string
          justification_encrypted: string
          resolved_at?: string | null
          session_id?: string | null
          spoc_id: string
          status?: string
          trigger_snippet?: string | null
          trigger_timestamp?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          entry_id?: string | null
          escalation_level?: number | null
          id?: string
          justification_encrypted?: string
          resolved_at?: string | null
          session_id?: string | null
          spoc_id?: string
          status?: string
          trigger_snippet?: string | null
          trigger_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_requests_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "blackbox_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "peer_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_requests_spoc_id_fkey"
            columns: ["spoc_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_availability: {
        Row: {
          created_at: string
          end_time: string
          expert_id: string
          id: string
          institution_id: string | null
          is_booked: boolean
          recurrence_rule: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          expert_id: string
          id?: string
          institution_id?: string | null
          is_booked?: boolean
          recurrence_rule?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          expert_id?: string
          id?: string
          institution_id?: string | null
          is_booked?: boolean
          recurrence_rule?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_availability_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_availability_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      gratitude_entries: {
        Row: {
          created_at: string
          entry_1: string
          entry_2: string
          entry_3: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_1?: string
          entry_2?: string
          entry_3?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_1?: string
          entry_2?: string
          entry_3?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      institution_inquiries: {
        Row: {
          address_line: string
          admin_notes: string | null
          city: string
          contact_person_email: string
          contact_person_name: string
          contact_person_phone: string
          created_at: string
          designation: string
          google_maps_url: string | null
          gst_number: string | null
          id: string
          institution_name: string
          institution_type: string
          message: string | null
          pan_number: string
          pincode: string
          state: string
          status: string
          student_count: number | null
          tan_number: string
          ticket_number: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address_line?: string
          admin_notes?: string | null
          city?: string
          contact_person_email: string
          contact_person_name: string
          contact_person_phone: string
          created_at?: string
          designation?: string
          google_maps_url?: string | null
          gst_number?: string | null
          id?: string
          institution_name: string
          institution_type?: string
          message?: string | null
          pan_number?: string
          pincode?: string
          state?: string
          status?: string
          student_count?: number | null
          tan_number?: string
          ticket_number?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address_line?: string
          admin_notes?: string | null
          city?: string
          contact_person_email?: string
          contact_person_name?: string
          contact_person_phone?: string
          created_at?: string
          designation?: string
          google_maps_url?: string | null
          gst_number?: string | null
          id?: string
          institution_name?: string
          institution_type?: string
          message?: string | null
          pan_number?: string
          pincode?: string
          state?: string
          status?: string
          student_count?: number | null
          tan_number?: string
          ticket_number?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      institution_student_ids: {
        Row: {
          claimed_by: string | null
          created_at: string
          id: string
          id_type: string
          institution_id: string
          is_claimed: boolean
          student_id_hash: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          id?: string
          id_type: string
          institution_id: string
          is_claimed?: boolean
          student_id_hash: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          id?: string
          id_type?: string
          institution_id?: string
          is_claimed?: boolean
          student_id_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_student_ids_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_student_ids_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          credits_pool: number
          eternia_code_hash: string
          id: string
          institution_type: string
          is_active: boolean
          logo_url: string | null
          name: string
          plan_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_pool?: number
          eternia_code_hash: string
          id?: string
          institution_type?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          plan_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_pool?: number
          eternia_code_hash?: string
          id?: string
          institution_type?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      intern_referral_codes: {
        Row: {
          assigned_to: string | null
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_used: boolean
          used_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          mood_tag: string | null
          title: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          mood_tag?: string | null
          title?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mood_tag?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_entries: {
        Row: {
          created_at: string
          id: string
          mood: number
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: number
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: number
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          admin_id: string | null
          admin_note: string | null
          created_at: string
          id: string
          reason: string | null
          resolved_at: string | null
          status: string
          temp_password: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          admin_id?: string | null
          admin_note?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          temp_password?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          admin_id?: string | null
          admin_note?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          temp_password?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      peer_messages: {
        Row: {
          content_encrypted: string
          created_at: string
          id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          content_encrypted: string
          created_at?: string
          id?: string
          sender_id: string
          session_id: string
        }
        Update: {
          content_encrypted?: string
          created_at?: string
          id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "peer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          escalation_note_encrypted: string | null
          id: string
          intern_id: string | null
          is_flagged: boolean
          room_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["peer_session_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          escalation_note_encrypted?: string | null
          id?: string
          intern_id?: string | null
          is_flagged?: boolean
          room_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["peer_session_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          escalation_note_encrypted?: string | null
          id?: string
          intern_id?: string | null
          is_flagged?: boolean
          room_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["peer_session_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_sessions_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cookie_consent: string
          created_at: string
          deletion_requested_at: string | null
          id: string
          institution_id: string | null
          is_active: boolean
          is_verified: boolean
          last_login: string | null
          role: Database["public"]["Enums"]["app_role"]
          specialty: string | null
          streak_days: number
          student_id: string | null
          total_sessions: number
          training_progress: Json | null
          training_status: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cookie_consent?: string
          created_at?: string
          deletion_requested_at?: string | null
          id: string
          institution_id?: string | null
          is_active?: boolean
          is_verified?: boolean
          last_login?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          streak_days?: number
          student_id?: string | null
          total_sessions?: number
          training_progress?: Json | null
          training_status?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cookie_consent?: string
          created_at?: string
          deletion_requested_at?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean
          is_verified?: boolean
          last_login?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          streak_days?: number
          student_id?: string | null
          total_sessions?: number
          training_progress?: Json | null
          training_status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_cards: {
        Row: {
          category: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          title: string
          xp_reward: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          title: string
          xp_reward?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      quest_completions: {
        Row: {
          answer: string | null
          completed_at: string
          completed_date: string
          id: string
          quest_id: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          completed_at?: string
          completed_date?: string
          id?: string
          quest_id: string
          user_id: string
        }
        Update: {
          answer?: string | null
          completed_at?: string
          completed_date?: string
          id?: string
          quest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_completions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quest_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          request_count: number
          window_start: string
        }
        Insert: {
          id?: string
          key: string
          request_count?: number
          window_start?: string
        }
        Update: {
          id?: string
          key?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      recovery_credentials: {
        Row: {
          created_at: string
          emoji_pattern_encrypted: string
          fragment_pairs_encrypted: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji_pattern_encrypted: string
          fragment_pairs_encrypted: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji_pattern_encrypted?: string
          fragment_pairs_encrypted?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sound_content: {
        Row: {
          artist: string | null
          category: string
          cover_emoji: string | null
          created_at: string
          description: string | null
          duration_sec: number | null
          file_url: string | null
          id: string
          is_active: boolean
          play_count: number
          title: string
        }
        Insert: {
          artist?: string | null
          category: string
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          duration_sec?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          play_count?: number
          title: string
        }
        Update: {
          artist?: string | null
          category?: string
          cover_emoji?: string | null
          created_at?: string
          description?: string | null
          duration_sec?: number | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          play_count?: number
          title?: string
        }
        Relationships: []
      }
      temp_credentials: {
        Row: {
          activated_at: string | null
          assigned_at: string | null
          auth_user_id: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          institution_id: string
          status: string
          temp_password_hash: string
          temp_password_plain: string
          temp_username: string
        }
        Insert: {
          activated_at?: string | null
          assigned_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          institution_id: string
          status?: string
          temp_password_hash: string
          temp_password_plain: string
          temp_username: string
        }
        Update: {
          activated_at?: string | null
          assigned_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          status?: string
          temp_password_hash?: string
          temp_password_plain?: string
          temp_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "temp_credentials_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          content: string
          created_at: string
          day_number: number
          description: string
          duration: string
          has_quiz: boolean
          id: string
          is_active: boolean
          objectives: Json
          quiz_questions: Json
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          day_number: number
          description: string
          duration?: string
          has_quiz?: boolean
          id?: string
          is_active?: boolean
          objectives?: Json
          quiz_questions?: Json
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          day_number?: number
          description?: string
          duration?: string
          has_quiz?: boolean
          id?: string
          is_active?: boolean
          objectives?: Json
          quiz_questions?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_private: {
        Row: {
          apaar_id_encrypted: string | null
          apaar_verified: boolean | null
          contact_is_self: boolean | null
          created_at: string
          device_id_encrypted: string | null
          emergency_name_encrypted: string | null
          emergency_phone_encrypted: string | null
          emergency_relation: string | null
          erp_id_encrypted: string | null
          erp_verified: boolean | null
          student_id_encrypted: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apaar_id_encrypted?: string | null
          apaar_verified?: boolean | null
          contact_is_self?: boolean | null
          created_at?: string
          device_id_encrypted?: string | null
          emergency_name_encrypted?: string | null
          emergency_phone_encrypted?: string | null
          emergency_relation?: string | null
          erp_id_encrypted?: string | null
          erp_verified?: boolean | null
          student_id_encrypted?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apaar_id_encrypted?: string | null
          apaar_verified?: boolean | null
          contact_is_self?: boolean | null
          created_at?: string
          device_id_encrypted?: string | null
          emergency_name_encrypted?: string | null
          emergency_phone_encrypted?: string | null
          emergency_relation?: string | null
          erp_id_encrypted?: string | null
          erp_verified?: boolean | null
          student_id_encrypted?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      credit_balance_view: {
        Row: {
          balance: number | null
          last_transaction_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { _key: string; _max_requests?: number; _window_seconds?: number }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      get_blackbox_daily_count: { Args: { _user_id: string }; Returns: number }
      get_blackbox_usage_count: { Args: { _user_id: string }; Returns: number }
      get_credit_balance: { Args: { _user_id: string }; Returns: number }
      get_credit_balance_fast: { Args: { _user_id: string }; Returns: number }
      get_daily_earn_total: { Args: { _user_id: string }; Returns: number }
      get_pool_balance: { Args: { _institution_id: string }; Returns: number }
      get_weekly_earn_total: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_play_count: { Args: { _track_id: string }; Returns: undefined }
      spend_credits_atomic: {
        Args: {
          _amount: number
          _notes?: string
          _reference_id?: string
          _user_id: string
        }
        Returns: {
          remaining: number
          source: string
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "student" | "intern" | "expert" | "spoc" | "admin" | "therapist"
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
      content_type: "text" | "voice"
      credit_type: "earn" | "spend" | "grant" | "purchase"
      peer_session_status: "pending" | "active" | "completed" | "flagged"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "intern", "expert", "spoc", "admin", "therapist"],
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
      content_type: ["text", "voice"],
      credit_type: ["earn", "spend", "grant", "purchase"],
      peer_session_status: ["pending", "active", "completed", "flagged"],
    },
  },
} as const
