/**
 * GENERATED — do not edit. `npm run db:types` regenerates this from the
 * production schema (scripts/db-types.mjs). Commit the result with the
 * migration that changed the schema, the same way tokens travel with
 * cw.tokens.json.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          order_ref: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          order_ref: string
          token: string
          used?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          order_ref?: string
          token?: string
          used?: boolean
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          role: string
          run_id: string
          seq: number
          tool_args: Json | null
          tool_name: string | null
          tool_result: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          role: string
          run_id: string
          seq: number
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          role?: string
          run_id?: string
          seq?: number
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          contour: string
          course_id: string | null
          error: string | null
          finished_at: string | null
          guest_key: string | null
          id: string
          input_tokens: number
          model: string | null
          output_tokens: number
          started_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          contour: string
          course_id?: string | null
          error?: string | null
          finished_at?: string | null
          guest_key?: string | null
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          contour?: string
          course_id?: string | null
          error?: string | null
          finished_at?: string | null
          guest_key?: string | null
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_marketing_inputs: {
        Row: {
          clicks: number
          currency: string
          id: number
          impressions: number
          period_label: string | null
          reach: number
          spend: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clicks?: number
          currency?: string
          id: number
          impressions?: number
          period_label?: string | null
          reach?: number
          spend?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clicks?: number
          currency?: string
          id?: number
          impressions?: number
          period_label?: string | null
          reach?: number
          spend?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      analytics_meta_ad_daily: {
        Row: {
          account_id: string
          ad_id: string
          ad_name: string
          adset_id: string
          adset_name: string
          campaign_id: string
          campaign_name: string
          clicks: number
          created_at: string
          currency: string
          day: string
          impressions: number
          initiate_checkout: number
          purchase: number
          raw: Json
          reach: number
          spend: number
          synced_at: string
          updated_at: string
          view_content: number
        }
        Insert: {
          account_id: string
          ad_id: string
          ad_name?: string
          adset_id?: string
          adset_name?: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          created_at?: string
          currency?: string
          day: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Update: {
          account_id?: string
          ad_id?: string
          ad_name?: string
          adset_id?: string
          adset_name?: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          created_at?: string
          currency?: string
          day?: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Relationships: []
      }
      analytics_meta_adset_daily: {
        Row: {
          account_id: string
          adset_id: string
          adset_name: string
          campaign_id: string
          campaign_name: string
          clicks: number
          created_at: string
          currency: string
          day: string
          impressions: number
          initiate_checkout: number
          purchase: number
          raw: Json
          reach: number
          spend: number
          synced_at: string
          updated_at: string
          view_content: number
        }
        Insert: {
          account_id: string
          adset_id: string
          adset_name?: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          created_at?: string
          currency?: string
          day: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Update: {
          account_id?: string
          adset_id?: string
          adset_name?: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          created_at?: string
          currency?: string
          day?: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Relationships: []
      }
      analytics_meta_campaign_daily: {
        Row: {
          account_id: string
          campaign_id: string
          campaign_name: string
          clicks: number
          created_at: string
          currency: string
          day: string
          impressions: number
          initiate_checkout: number
          purchase: number
          raw: Json
          reach: number
          spend: number
          synced_at: string
          updated_at: string
          view_content: number
        }
        Insert: {
          account_id: string
          campaign_id: string
          campaign_name?: string
          clicks?: number
          created_at?: string
          currency?: string
          day: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Update: {
          account_id?: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          created_at?: string
          currency?: string
          day?: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Relationships: []
      }
      analytics_meta_daily: {
        Row: {
          account_id: string
          clicks: number
          created_at: string
          currency: string
          day: string
          impressions: number
          initiate_checkout: number
          purchase: number
          raw: Json
          reach: number
          spend: number
          synced_at: string
          updated_at: string
          view_content: number
        }
        Insert: {
          account_id: string
          clicks?: number
          created_at?: string
          currency?: string
          day: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Update: {
          account_id?: string
          clicks?: number
          created_at?: string
          currency?: string
          day?: string
          impressions?: number
          initiate_checkout?: number
          purchase?: number
          raw?: Json
          reach?: number
          spend?: number
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Relationships: []
      }
      analytics_pixel_daily: {
        Row: {
          created_at: string
          day: string
          initiate_checkout: number
          pixel_id: string
          purchase: number
          raw: Json
          synced_at: string
          updated_at: string
          view_content: number
        }
        Insert: {
          created_at?: string
          day: string
          initiate_checkout?: number
          pixel_id: string
          purchase?: number
          raw?: Json
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Update: {
          created_at?: string
          day?: string
          initiate_checkout?: number
          pixel_id?: string
          purchase?: number
          raw?: Json
          synced_at?: string
          updated_at?: string
          view_content?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      customers: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          google_id: string | null
          id: string
          meta: Json | null
          notes: string | null
          phone: string | null
          tags: string[]
          tg_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          google_id?: string | null
          id?: string
          meta?: Json | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          tg_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          google_id?: string | null
          id?: string
          meta?: Json | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          tg_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          order_ref: string | null
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_ref?: string | null
          payload?: Json
          type: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          order_ref?: string | null
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_text: string | null
          id: string
          payload: Json | null
          run_at: string | null
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_text?: string | null
          id?: string
          payload?: Json | null
          run_at?: string | null
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_text?: string | null
          id?: string
          payload?: Json | null
          run_at?: string | null
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          campaign: string | null
          client_ip: string | null
          client_ua: string | null
          created_at: string
          email: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          id: string
          name: string | null
          order_ref: string
          page_url: string | null
          payload: Json
          phone: string | null
          product_code: string
          source: string
          stage: string
          stage_changed_at: string | null
        }
        Insert: {
          campaign?: string | null
          client_ip?: string | null
          client_ua?: string | null
          created_at?: string
          email?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          id?: string
          name?: string | null
          order_ref: string
          page_url?: string | null
          payload?: Json
          phone?: string | null
          product_code: string
          source: string
          stage?: string
          stage_changed_at?: string | null
        }
        Update: {
          campaign?: string | null
          client_ip?: string | null
          client_ua?: string | null
          created_at?: string
          email?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          id?: string
          name?: string | null
          order_ref?: string
          page_url?: string | null
          payload?: Json
          phone?: string | null
          product_code?: string
          source?: string
          stage?: string
          stage_changed_at?: string | null
        }
        Relationships: []
      }
      lms_annotations: {
        Row: {
          block_id: string | null
          client_id: string
          course_version: number
          created_at: string
          end_offset: number | null
          enrollment_id: string
          id: string
          kind: string
          lesson_id: string
          note: string | null
          prefix: string | null
          quote: string | null
          start_offset: number | null
          updated_at: string
        }
        Insert: {
          block_id?: string | null
          client_id: string
          course_version?: number
          created_at?: string
          end_offset?: number | null
          enrollment_id: string
          id?: string
          kind: string
          lesson_id: string
          note?: string | null
          prefix?: string | null
          quote?: string | null
          start_offset?: number | null
          updated_at?: string
        }
        Update: {
          block_id?: string | null
          client_id?: string
          course_version?: number
          created_at?: string
          end_offset?: number | null
          enrollment_id?: string
          id?: string
          kind?: string
          lesson_id?: string
          note?: string | null
          prefix?: string | null
          quote?: string | null
          start_offset?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_annotations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "lms_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_annotations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_authors: {
        Row: {
          achievement_badge: string | null
          auth_user_id: string | null
          background: Json | null
          bio: string | null
          consultation_contact_url: string | null
          consultation_enabled: boolean
          consultation_points: Json | null
          consultation_summary: string | null
          consultation_title: string | null
          created_at: string
          credentials: Json | null
          experience_badge: string | null
          id: string
          listed: boolean
          name: string
          photo: Json | null
          profile_blocks: Json | null
          profile_facts: Json | null
          quote: string | null
          role: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          achievement_badge?: string | null
          auth_user_id?: string | null
          background?: Json | null
          bio?: string | null
          consultation_contact_url?: string | null
          consultation_enabled?: boolean
          consultation_points?: Json | null
          consultation_summary?: string | null
          consultation_title?: string | null
          created_at?: string
          credentials?: Json | null
          experience_badge?: string | null
          id?: string
          listed?: boolean
          name: string
          photo?: Json | null
          profile_blocks?: Json | null
          profile_facts?: Json | null
          quote?: string | null
          role?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          achievement_badge?: string | null
          auth_user_id?: string | null
          background?: Json | null
          bio?: string | null
          consultation_contact_url?: string | null
          consultation_enabled?: boolean
          consultation_points?: Json | null
          consultation_summary?: string | null
          consultation_title?: string | null
          created_at?: string
          credentials?: Json | null
          experience_badge?: string | null
          id?: string
          listed?: boolean
          name?: string
          photo?: Json | null
          profile_blocks?: Json | null
          profile_facts?: Json | null
          quote?: string | null
          role?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      lms_course_offers: {
        Row: {
          access_days: number | null
          access_lifetime: boolean
          active: boolean
          amount: number
          code: string
          course_id: string
          created_at: string
          currency: string
          id: string
          list_amount: number | null
          pixel_content_name: string
          updated_at: string
        }
        Insert: {
          access_days?: number | null
          access_lifetime?: boolean
          active?: boolean
          amount: number
          code: string
          course_id: string
          created_at?: string
          currency?: string
          id?: string
          list_amount?: number | null
          pixel_content_name: string
          updated_at?: string
        }
        Update: {
          access_days?: number | null
          access_lifetime?: boolean
          active?: boolean
          amount?: number
          code?: string
          course_id?: string
          created_at?: string
          currency?: string
          id?: string
          list_amount?: number | null
          pixel_content_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_course_offers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_course_revisions: {
        Row: {
          content: Json
          content_hash: string
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string | null
          parent_revision_id: string | null
          revision_number: number
          source_revision_id: string | null
        }
        Insert: {
          content: Json
          content_hash: string
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          label?: string | null
          parent_revision_id?: string | null
          revision_number: number
          source_revision_id?: string | null
        }
        Update: {
          content?: Json
          content_hash?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string | null
          parent_revision_id?: string | null
          revision_number?: number
          source_revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_course_revisions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_course_revisions_parent_fk"
            columns: ["course_id", "parent_revision_id"]
            isOneToOne: false
            referencedRelation: "lms_course_revisions"
            referencedColumns: ["course_id", "id"]
          },
          {
            foreignKeyName: "lms_course_revisions_source_fk"
            columns: ["course_id", "source_revision_id"]
            isOneToOne: false
            referencedRelation: "lms_course_revisions"
            referencedColumns: ["course_id", "id"]
          },
        ]
      }
      lms_course_sources: {
        Row: {
          byte_size: number | null
          checksum: string | null
          course_id: string
          created_at: string
          extracted_text: string | null
          id: string
          kind: string
          mime_type: string | null
          origin: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          byte_size?: number | null
          checksum?: string | null
          course_id: string
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          origin?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          byte_size?: number | null
          checksum?: string | null
          course_id?: string
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          origin?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_course_sources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_courses: {
        Row: {
          access_note: string | null
          approved_at: string | null
          approved_by: string | null
          audience: Json | null
          author_id: string | null
          author_note: string | null
          author_profile_id: string | null
          brand: string
          categories: Json | null
          cover: Json | null
          created_at: string
          draft_generation: number
          duration_days: number | null
          entitlement_product_codes: string[]
          format: Json | null
          id: string
          kind: string | null
          locale: string
          pending_content: Json | null
          pending_review_note: string | null
          pending_review_status: string | null
          pending_submitted_at: string | null
          pending_updated_at: string | null
          posttitle: string | null
          pretitle: string | null
          program_slug: string
          published_revision_id: string | null
          results: Json | null
          review_note: string | null
          review_status: string
          revision_seq: number
          schedule: Json
          slug: string
          sort_order: number | null
          status: string
          submitted_at: string | null
          summary: Json | null
          tagline: string | null
          theme: Json | null
          title: string
          translation_group_id: string
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          access_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          audience?: Json | null
          author_id?: string | null
          author_note?: string | null
          author_profile_id?: string | null
          brand?: string
          categories?: Json | null
          cover?: Json | null
          created_at?: string
          draft_generation?: number
          duration_days?: number | null
          entitlement_product_codes?: string[]
          format?: Json | null
          id?: string
          kind?: string | null
          locale?: string
          pending_content?: Json | null
          pending_review_note?: string | null
          pending_review_status?: string | null
          pending_submitted_at?: string | null
          pending_updated_at?: string | null
          posttitle?: string | null
          pretitle?: string | null
          program_slug: string
          published_revision_id?: string | null
          results?: Json | null
          review_note?: string | null
          review_status?: string
          revision_seq?: number
          schedule?: Json
          slug: string
          sort_order?: number | null
          status?: string
          submitted_at?: string | null
          summary?: Json | null
          tagline?: string | null
          theme?: Json | null
          title: string
          translation_group_id: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Update: {
          access_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          audience?: Json | null
          author_id?: string | null
          author_note?: string | null
          author_profile_id?: string | null
          brand?: string
          categories?: Json | null
          cover?: Json | null
          created_at?: string
          draft_generation?: number
          duration_days?: number | null
          entitlement_product_codes?: string[]
          format?: Json | null
          id?: string
          kind?: string | null
          locale?: string
          pending_content?: Json | null
          pending_review_note?: string | null
          pending_review_status?: string | null
          pending_submitted_at?: string | null
          pending_updated_at?: string | null
          posttitle?: string | null
          pretitle?: string | null
          program_slug?: string
          published_revision_id?: string | null
          results?: Json | null
          review_note?: string | null
          review_status?: string
          revision_seq?: number
          schedule?: Json
          slug?: string
          sort_order?: number | null
          status?: string
          submitted_at?: string | null
          summary?: Json | null
          tagline?: string | null
          theme?: Json | null
          title?: string
          translation_group_id?: string
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_courses_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "lms_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_courses_published_revision_fk"
            columns: ["id", "published_revision_id"]
            isOneToOne: false
            referencedRelation: "lms_course_revisions"
            referencedColumns: ["course_id", "id"]
          },
        ]
      }
      lms_enrollments: {
        Row: {
          auth_user_id: string
          blocked_at: string | null
          blocked_reason: string | null
          course_id: string
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          order_ref: string | null
          revoked_at: string | null
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          blocked_at?: string | null
          blocked_reason?: string | null
          course_id: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          order_ref?: string | null
          revoked_at?: string | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          blocked_at?: string | null
          blocked_reason?: string | null
          course_id?: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          order_ref?: string | null
          revoked_at?: string | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_lessons: {
        Row: {
          blocks: Json
          course_id: string
          created_at: string
          day_index: number | null
          duration_min: number | null
          id: string
          module_id: string
          order: number
          slug: string
          summary: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          course_id: string
          created_at?: string
          day_index?: number | null
          duration_min?: number | null
          id?: string
          module_id: string
          order: number
          slug: string
          summary?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          course_id?: string
          created_at?: string
          day_index?: number | null
          duration_min?: number | null
          id?: string
          module_id?: string
          order?: number
          slug?: string
          summary?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_media_assets: {
        Row: {
          asset_key: string
          bytes: number
          canonical_path: string
          content_type: string
          course_id: string | null
          created_at: string
          height: number
          id: string
          paths: string[]
          swept_at: string | null
          uploaded_by: string | null
          width: number
        }
        Insert: {
          asset_key: string
          bytes: number
          canonical_path: string
          content_type: string
          course_id?: string | null
          created_at?: string
          height: number
          id: string
          paths: string[]
          swept_at?: string | null
          uploaded_by?: string | null
          width: number
        }
        Update: {
          asset_key?: string
          bytes?: number
          canonical_path?: string
          content_type?: string
          course_id?: string | null
          created_at?: string
          height?: number
          id?: string
          paths?: string[]
          swept_at?: string | null
          uploaded_by?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "lms_media_assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order: number
          reference: boolean
          slug: string
          summary: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order: number
          reference?: boolean
          slug: string
          summary?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order?: number
          reference?: boolean
          slug?: string
          summary?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_progress_events: {
        Row: {
          client_id: string
          created_at: string
          enrollment_id: string
          id: string
          lesson_id: string
          occurred_at: string
          payload: Json
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          lesson_id: string
          occurred_at?: string
          payload?: Json
          type: string
        }
        Update: {
          client_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          lesson_id?: string
          occurred_at?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_progress_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "lms_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_progress_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_reminder_log: {
        Row: {
          channel: string
          day_number: number
          enrollment_id: string
          id: string
          lesson_id: string
          sent_at: string
        }
        Insert: {
          channel?: string
          day_number: number
          enrollment_id: string
          id?: string
          lesson_id: string
          sent_at?: string
        }
        Update: {
          channel?: string
          day_number?: number
          enrollment_id?: string
          id?: string
          lesson_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_reminder_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "lms_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_reminder_log_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_unstarted_reminders: {
        Row: {
          auth_user_id: string
          channel: string
          course_id: string
          id: string
          nudge_number: number
          order_ref: string
          sent_at: string
        }
        Insert: {
          auth_user_id: string
          channel?: string
          course_id: string
          id?: string
          nudge_number: number
          order_ref: string
          sent_at?: string
        }
        Update: {
          auth_user_id?: string
          channel?: string
          course_id?: string
          id?: string
          nudge_number?: number
          order_ref?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_unstarted_reminders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number | null
          campaign: string | null
          client_ip: string | null
          client_ua: string | null
          created_at: string
          currency: string | null
          customer_id: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          id: string
          meta: Json | null
          order_ref: string
          page_url: string | null
          payload: Json | null
          product_code: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          campaign?: string | null
          client_ip?: string | null
          client_ua?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          id?: string
          meta?: Json | null
          order_ref: string
          page_url?: string | null
          payload?: Json | null
          product_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          campaign?: string | null
          client_ip?: string | null
          client_ua?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          id?: string
          meta?: Json | null
          order_ref?: string
          page_url?: string | null
          payload?: Json | null
          product_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          id: string
          order_ref: string
          provider: string
          provider_tx_id: string | null
          raw_payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_ref: string
          provider?: string
          provider_tx_id?: string | null
          raw_payload?: Json
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          order_ref?: string
          provider?: string
          provider_tx_id?: string | null
          raw_payload?: Json
          status?: string
        }
        Relationships: []
      }
      personal_offer_tokens: {
        Row: {
          amount: number
          campaign: string | null
          channel: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: number
          issued_at: string | null
          metadata: Json
          offer_id: string
          old_amount: number | null
          product_code: string
          recipient_key: string | null
          status: string
          token: string
        }
        Insert: {
          amount: number
          campaign?: string | null
          channel?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: number
          issued_at?: string | null
          metadata?: Json
          offer_id: string
          old_amount?: number | null
          product_code: string
          recipient_key?: string | null
          status?: string
          token: string
        }
        Update: {
          amount?: number
          campaign?: string | null
          channel?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: number
          issued_at?: string | null
          metadata?: Json
          offer_id?: string
          old_amount?: number | null
          product_code?: string
          recipient_key?: string | null
          status?: string
          token?: string
        }
        Relationships: []
      }
      platform_users: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_sign_in_at: string | null
          locale: string
          marketing_opt_in: boolean
          notification_channels: string[]
          onboarding_state: string
          provider: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          locale?: string
          marketing_opt_in?: boolean
          notification_channels?: string[]
          onboarding_state?: string
          provider?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          locale?: string
          marketing_opt_in?: boolean
          notification_channels?: string[]
          onboarding_state?: string
          provider?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_offers: {
        Row: {
          active: boolean
          amount: number | null
          code: string
          created_at: string
          currency: string
          kind: string
          list_amount: number | null
          pixel_content_name: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number | null
          code: string
          created_at?: string
          currency?: string
          kind?: string
          list_amount?: number | null
          pixel_content_name?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          code?: string
          created_at?: string
          currency?: string
          kind?: string
          list_amount?: number | null
          pixel_content_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      support_bot_sessions: {
        Row: {
          contact: string | null
          selected_product: string | null
          state: string
          telegram_user_id: string
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          contact?: string | null
          selected_product?: string | null
          state?: string
          telegram_user_id: string
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          contact?: string | null
          selected_product?: string | null
          state?: string
          telegram_user_id?: string
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      test_answers: {
        Row: {
          answer_order: number
          attempt_id: string
          created_at: string
          id: string
          mapped_dosha: string
          option_id: string
          question_id: string
        }
        Insert: {
          answer_order: number
          attempt_id: string
          created_at?: string
          id?: string
          mapped_dosha: string
          option_id: string
          question_id: string
        }
        Update: {
          answer_order?: number
          attempt_id?: string
          created_at?: string
          id?: string
          mapped_dosha?: string
          option_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "v_user_dosha_test_profile"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "v_user_latest_test_attempts"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "quiz_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "test_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          current_question_index: number
          id: string
          last_activity_at: string
          reminder_sent_count: number
          result_payload_json: Json | null
          result_type: Database["public"]["Enums"]["dosha_result_type"] | null
          score_kapha: number
          score_pitta: number
          score_vata: number
          session_id: string
          source: string | null
          started_at: string
          status: string
          test_id: string
          updated_at: string
          user_id: string | null
          version: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_question_index?: number
          id?: string
          last_activity_at?: string
          reminder_sent_count?: number
          result_payload_json?: Json | null
          result_type?: Database["public"]["Enums"]["dosha_result_type"] | null
          score_kapha?: number
          score_pitta?: number
          score_vata?: number
          session_id: string
          source?: string | null
          started_at?: string
          status?: string
          test_id: string
          updated_at?: string
          user_id?: string | null
          version?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_question_index?: number
          id?: string
          last_activity_at?: string
          reminder_sent_count?: number
          result_payload_json?: Json | null
          result_type?: Database["public"]["Enums"]["dosha_result_type"] | null
          score_kapha?: number
          score_pitta?: number
          score_vata?: number
          session_id?: string
          source?: string | null
          started_at?: string
          status?: string
          test_id?: string
          updated_at?: string
          user_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_definitions: {
        Row: {
          created_at: string
          id: string
          slug: string
          status: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      test_options: {
        Row: {
          created_at: string
          id: string
          mapped_dosha: string
          option_code: string
          option_order: number
          option_text: string
          question_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapped_dosha: string
          option_code: string
          option_order: number
          option_text: string
          question_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapped_dosha?: string
          option_code?: string
          option_order?: number
          option_text?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          created_at: string
          id: string
          order_index: number
          question_code: string
          question_text: string
          status: string
          test_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index: number
          question_code: string
          question_text: string
          status?: string
          test_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          question_code?: string
          question_text?: string
          status?: string
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      lms_media_usage: {
        Row: {
          assets: number | null
          bytes: number | null
          course_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_media_assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_funnel_daily: {
        Row: {
          conversion_rate_percent: number | null
          date: string | null
          leads_count: number | null
          orders_created: number | null
          orders_paid: number | null
          total_revenue: number | null
          unique_lead_phones: number | null
        }
        Relationships: []
      }
      mv_quality_gaps: {
        Row: {
          paid_missing_client_ip: number | null
          paid_missing_client_ua: number | null
          paid_missing_fbc: number | null
          paid_missing_fbclid: number | null
          paid_missing_fbp: number | null
          paid_missing_page_url: number | null
          snapshot_date: string | null
        }
        Relationships: []
      }
      mv_revenue_by_campaign: {
        Row: {
          paid_orders: number | null
          source_campaign: string | null
          total_orders: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      v_user_dosha_test_profile: {
        Row: {
          attempt_id: string | null
          completed_at: string | null
          result_type: Database["public"]["Enums"]["dosha_result_type"] | null
          score_kapha: number | null
          score_pitta: number | null
          score_vata: number | null
          test_id: string | null
          test_slug: string | null
          user_id: string | null
          version: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_latest_test_attempts: {
        Row: {
          attempt_id: string | null
          completed_at: string | null
          created_at: string | null
          result_type: Database["public"]["Enums"]["dosha_result_type"] | null
          score_kapha: number | null
          score_pitta: number | null
          score_vata: number | null
          test_id: string | null
          user_id: string | null
          version: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_lms_course_release: {
        Args: {
          p_content: Json
          p_content_hash: string
          p_course: Json
          p_course_id: string
          p_created_by?: string
          p_final_values: Json
          p_kind: string
          p_label?: string
          p_lessons: Json
          p_modules: Json
          p_remove_lesson_ids: string[]
          p_remove_module_ids: string[]
          p_source_revision_id?: string
        }
        Returns: {
          created_at: string
          id: string
          revision_number: number
        }[]
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after: number
        }[]
      }
      checkpoint_lms_course_autosave: {
        Args: {
          p_content: Json
          p_content_hash: string
          p_course_id: string
          p_created_by?: string
          p_min_interval?: string
        }
        Returns: {
          created_at: string
          id: string
          revision_number: number
        }[]
      }
      create_lms_course_revision: {
        Args: {
          p_content: Json
          p_content_hash: string
          p_course_id: string
          p_created_by?: string
          p_kind: string
          p_label?: string
          p_parent_revision_id?: string
          p_source_revision_id?: string
        }
        Returns: {
          created_at: string
          id: string
          revision_number: number
        }[]
      }
      create_lms_course_revision_once: {
        Args: {
          p_content: Json
          p_content_hash: string
          p_course_id: string
          p_created_by?: string
          p_kind: string
          p_label?: string
        }
        Returns: {
          created: boolean
          created_at: string
          id: string
          revision_number: number
        }[]
      }
      cron_call_endpoint: { Args: { path: string }; Returns: number }
      cw_apply_row_set: {
        Args: { p_rows: Json; p_table: unknown }
        Returns: undefined
      }
      cw_patch_lms_course: {
        Args: { p_course_id: string; p_values: Json }
        Returns: undefined
      }
      get_my_role: { Args: never; Returns: string }
      journal_lms_course_state: {
        Args: {
          p_content: Json
          p_content_hash: string
          p_course_id: string
          p_created_by?: string
          p_kind: string
          p_label?: string
          p_source_revision_id?: string
          p_values: Json
        }
        Returns: {
          created_at: string
          id: string
          revision_number: number
        }[]
      }
      lms_media_asset_key: { Args: { object_path: string }; Returns: string }
      lms_media_inventory: {
        Args: never
        Returns: {
          asset_key: string
          bytes: number
          newest: string
          objects: string[]
        }[]
      }
      lms_referenced_media: {
        Args: never
        Returns: {
          asset_key: string
        }[]
      }
      refresh_analytics_views: { Args: never; Returns: undefined }
    }
    Enums: {
      dosha_result_type:
        | "vata"
        | "pitta"
        | "kapha"
        | "vata_pitta"
        | "pitta_kapha"
        | "vata_kapha"
        | "tridosha"
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
      dosha_result_type: [
        "vata",
        "pitta",
        "kapha",
        "vata_pitta",
        "pitta_kapha",
        "vata_kapha",
        "tridosha",
      ],
    },
  },
} as const

