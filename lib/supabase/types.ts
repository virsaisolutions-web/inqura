// Supabase TypeScript types — manual stub for Phase 1 development.
// Replace with `npx supabase gen types typescript --project-id <id>` once project is live.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string | null
          plan: string
          status: string
          settings: Json
          vault_url: string
          vault_client_id: string
          vault_client_secret: string
          vault_username: string | null
          vault_password: string | null
          vault_api_version: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          plan?: string
          status?: string
          settings?: Json
          vault_url: string
          vault_client_id?: string
          vault_client_secret?: string
          vault_username?: string | null
          vault_password?: string | null
          vault_api_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          plan?: string
          status?: string
          settings?: Json
          vault_url?: string
          vault_client_id?: string
          vault_client_secret?: string
          vault_username?: string | null
          vault_password?: string | null
          vault_api_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_users: {
        Row: {
          id: number
          tenant_id: string
          user_id: string
          role: string
          invited_by: string | null
          invited_at: string
          joined_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          tenant_id: string
          user_id: string
          role?: string
          invited_by?: string | null
          invited_at?: string
          joined_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          tenant_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          invited_at?: string
          joined_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          id: number
          tenant_id: string | null
          sync_type: string
          started_at: string
          completed_at: string | null
          records_processed: number | null
          status: string
          error_msg: string | null
        }
        Insert: {
          id?: number
          tenant_id?: string | null
          sync_type: string
          started_at?: string
          completed_at?: string | null
          records_processed?: number | null
          status?: string
          error_msg?: string | null
        }
        Update: {
          id?: number
          tenant_id?: string | null
          sync_type?: string
          started_at?: string
          completed_at?: string | null
          records_processed?: number | null
          status?: string
          error_msg?: string | null
        }
        Relationships: []
      }
      cases: {
        Row: {
          id: number
          tenant_id: string | null
          vault_case_id: string
          product: string | null
          topic_category: string | null
          channel: string | null
          status: string | null
          priority: string | null
          hcp_specialty: string | null
          hcp_institution: string | null
          country: string | null
          submitted_at: string
          assigned_at: string | null
          fulfilled_at: string | null
          sla_deadline: string | null
          sla_hours_target: number
          is_off_label: boolean
          vault_synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          tenant_id?: string | null
          vault_case_id: string
          product?: string | null
          topic_category?: string | null
          channel?: string | null
          status?: string | null
          priority?: string | null
          hcp_specialty?: string | null
          hcp_institution?: string | null
          country?: string | null
          submitted_at: string
          assigned_at?: string | null
          fulfilled_at?: string | null
          sla_deadline?: string | null
          sla_hours_target?: number
          is_off_label?: boolean
          vault_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          tenant_id?: string | null
          vault_case_id?: string
          product?: string | null
          topic_category?: string | null
          channel?: string | null
          status?: string | null
          priority?: string | null
          hcp_specialty?: string | null
          hcp_institution?: string | null
          country?: string | null
          submitted_at?: string
          assigned_at?: string | null
          fulfilled_at?: string | null
          sla_deadline?: string | null
          sla_hours_target?: number
          is_off_label?: boolean
          vault_synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      metrics_daily: {
        Row: {
          id: number
          tenant_id: string | null
          metric_date: string
          product: string | null
          total_cases: number
          fulfilled_cases: number
          sla_met: number
          sla_breached: number
          avg_response_h: number | null
          topic_breakdown: Json | null
          channel_breakdown: Json | null
        }
        Insert: {
          id?: number
          tenant_id?: string | null
          metric_date: string
          product?: string | null
          total_cases?: number
          fulfilled_cases?: number
          sla_met?: number
          sla_breached?: number
          avg_response_h?: number | null
          topic_breakdown?: Json | null
          channel_breakdown?: Json | null
        }
        Update: {
          id?: number
          tenant_id?: string | null
          metric_date?: string
          product?: string | null
          total_cases?: number
          fulfilled_cases?: number
          sla_met?: number
          sla_breached?: number
          avg_response_h?: number | null
          topic_breakdown?: Json | null
          channel_breakdown?: Json | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          id: number
          tenant_id: string | null
          case_id: number | null
          alert_type: string
          severity: string
          message: string
          is_read: boolean
          triggered_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: number
          tenant_id?: string | null
          case_id?: number | null
          alert_type: string
          severity: string
          message: string
          is_read?: boolean
          triggered_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: number
          tenant_id?: string | null
          case_id?: number | null
          alert_type?: string
          severity?: string
          message?: string
          is_read?: boolean
          triggered_at?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: number
          tenant_id: string | null
          user_email: string | null
          action: string
          resource: string | null
          resource_id: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: number
          tenant_id?: string | null
          user_email?: string | null
          action: string
          resource?: string | null
          resource_id?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          tenant_id?: string | null
          user_email?: string | null
          action?: string
          resource?: string | null
          resource_id?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Relationships: []
      }
      report_jobs: {
        Row: {
          id: string
          tenant_id: string | null
          requested_by: string
          period: string
          status: string
          download_url: string | null
          error_msg: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          requested_by: string
          period: string
          status?: string
          download_url?: string | null
          error_msg?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          requested_by?: string
          period?: string
          status?: string
          download_url?: string | null
          error_msg?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          id: number
          tenant_id: string | null
          type: string
          webhook_url: string
          enabled: boolean
          label: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          tenant_id?: string | null
          type: string
          webhook_url: string
          enabled?: boolean
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          tenant_id?: string | null
          type?: string
          webhook_url?: string
          enabled?: boolean
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience row types
export type Tenant       = Database['public']['Tables']['tenants']['Row']
export type SyncLog      = Database['public']['Tables']['sync_log']['Row']
export type Case         = Database['public']['Tables']['cases']['Row']
export type MetricsDaily = Database['public']['Tables']['metrics_daily']['Row']
export type Alert        = Database['public']['Tables']['alerts']['Row']
export type AuditLog     = Database['public']['Tables']['audit_log']['Row']
export type Integration  = Database['public']['Tables']['integrations']['Row']
export type TenantUser   = Database['public']['Tables']['tenant_users']['Row']
export type ReportJob    = Database['public']['Tables']['report_jobs']['Row']
