export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          skills: string[];
          education: string | null;
          experience: string | null;
          availability: string | null;
          cv_url: string | null;
          gmail_token: string | null;
          languages: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          skills?: string[];
          education?: string | null;
          experience?: string | null;
          availability?: string | null;
          cv_url?: string | null;
          gmail_token?: string | null;
          languages?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string | null;
          skills?: string[];
          education?: string | null;
          experience?: string | null;
          availability?: string | null;
          cv_url?: string | null;
          gmail_token?: string | null;
          languages?: string[];
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          name: string | null;
          skills: string[];
          education: string | null;
          experience: string | null;
          availability: string | null;
          cv_url: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string;
          name?: string | null;
          skills?: string[];
          education?: string | null;
          experience?: string | null;
          availability?: string | null;
          cv_url?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          name?: string | null;
          skills?: string[];
          education?: string | null;
          experience?: string | null;
          availability?: string | null;
          cv_url?: string | null;
          is_default?: boolean;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      campaigns: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string | null;
          location: string;
          fields: string[];
          languages: string[];
          mode: "active" | "hybrid";
          target_count: number;
          status: "running" | "complete" | "paused";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id?: string | null;
          location: string;
          fields: string[];
          languages?: string[];
          mode: "active" | "hybrid";
          target_count: number;
          status?: "running" | "complete" | "paused";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string | null;
          location?: string;
          fields?: string[];
          languages?: string[];
          mode?: "active" | "hybrid";
          target_count?: number;
          status?: "running" | "complete" | "paused";
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      companies: {
        Row: {
          id: string;
          campaign_id: string;
          name: string;
          website: string | null;
          description: string | null;
          location: string | null;
          source: "job_board" | "cold_search";
          source_url: string | null;
          job_posting_url: string | null;
          discovered_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          name: string;
          website?: string | null;
          description?: string | null;
          location?: string | null;
          source: "job_board" | "cold_search";
          source_url?: string | null;
          job_posting_url?: string | null;
          discovered_at?: string;
        };
        Update: {
          name?: string;
          website?: string | null;
          description?: string | null;
          location?: string | null;
          source?: "job_board" | "cold_search";
          source_url?: string | null;
          job_posting_url?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      contacts: {
        Row: {
          id: string;
          company_id: string;
          name: string | null;
          role: string | null;
          email: string | null;
          linkedin_url: string | null;
          confidence_score: number | null;
          type: "founder" | "cto" | "engineer" | "recruiter";
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name?: string | null;
          role?: string | null;
          email?: string | null;
          linkedin_url?: string | null;
          confidence_score?: number | null;
          type: "founder" | "cto" | "engineer" | "recruiter";
          created_at?: string;
        };
        Update: {
          name?: string | null;
          role?: string | null;
          email?: string | null;
          linkedin_url?: string | null;
          confidence_score?: number | null;
          type?: "founder" | "cto" | "engineer" | "recruiter";
        };
        Relationships: GenericRelationship[];
      };
      messages: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          platform: "email" | "linkedin";
          language: string;
          subject: string | null;
          body: string;
          status: "draft" | "sent" | "skipped" | "failed";
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          contact_id: string;
          platform: "email" | "linkedin";
          language?: string;
          subject?: string | null;
          body: string;
          status?: "draft" | "sent" | "skipped" | "failed";
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject?: string | null;
          body?: string;
          status?: "draft" | "sent" | "skipped" | "failed";
          sent_at?: string | null;
          language?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row types
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
