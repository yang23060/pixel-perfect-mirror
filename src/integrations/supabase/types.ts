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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      albums: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          event_date: string | null
          family_id: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_date?: string | null
          family_id: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string | null
          family_id?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      appreciations: {
        Row: {
          author_id: string
          created_at: string
          family_id: string
          id: string
          message: string
          to_user_id: string | null
        }
        Insert: {
          author_id: string
          created_at?: string
          family_id: string
          id?: string
          message: string
          to_user_id?: string | null
        }
        Update: {
          author_id?: string
          created_at?: string
          family_id?: string
          id?: string
          message?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appreciations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          family_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          family_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          family_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          is_main: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          is_main?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          is_main?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          created_at: string
          family_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["checkin_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          family_id: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          family_id: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          family_id?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          family_id: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string | null
          target_type: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          family_id?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string | null
          target_type: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          family_id?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string | null
          target_type?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          created_at: string
          event_id: string
          family_id: string
          id: string
          invited: boolean
          status: Database["public"]["Enums"]["rsvp_status"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          family_id: string
          id?: string
          invited?: boolean
          status?: Database["public"]["Enums"]["rsvp_status"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          family_id?: string
          id?: string
          invited?: boolean
          status?: Database["public"]["Enums"]["rsvp_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          category: Database["public"]["Enums"]["event_category"]
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          family_id: string
          id: string
          location: string | null
          recurrence: string | null
          reminder_minutes: number | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          category?: Database["public"]["Enums"]["event_category"]
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          family_id: string
          id?: string
          location?: string | null
          recurrence?: string | null
          reminder_minutes?: number | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          category?: Database["public"]["Enums"]["event_category"]
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          family_id?: string
          id?: string
          location?: string | null
          recurrence?: string | null
          reminder_minutes?: number | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          family_id: string
          id: string
          role: Database["public"]["Enums"]["family_role"]
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          family_id: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          family_id?: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          joined_at: string
          relationship: string | null
          role: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          joined_at?: string
          relationship?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          joined_at?: string
          relationship?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          family_id: string
          id: string
          kind: string
          message_id: string
          position: number
          url: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          kind?: string
          message_id: string
          position?: number
          url: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          kind?: string
          message_id?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          emoji: string
          family_id: string
          message_id: string
          user_id: string
        }
        Insert: {
          emoji: string
          family_id: string
          message_id: string
          user_id: string
        }
        Update: {
          emoji?: string
          family_id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          edited_at: string | null
          family_id: string
          id: string
          image_url: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          edited_at?: string | null
          family_id: string
          id?: string
          image_url?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          edited_at?: string | null
          family_id?: string
          id?: string
          image_url?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          albums: boolean
          birthdays: boolean
          comments: boolean
          events: boolean
          mentions: boolean
          reactions: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          albums?: boolean
          birthdays?: boolean
          comments?: boolean
          events?: boolean
          mentions?: boolean
          reactions?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          albums?: boolean
          birthdays?: boolean
          comments?: boolean
          events?: boolean
          mentions?: boolean
          reactions?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          family_id: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          family_id: string
          id: string
          photo_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          family_id: string
          id?: string
          photo_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          family_id?: string
          id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_comments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_reactions: {
        Row: {
          emoji: string
          family_id: string
          photo_id: string
          user_id: string
        }
        Insert: {
          emoji?: string
          family_id: string
          photo_id: string
          user_id: string
        }
        Update: {
          emoji?: string
          family_id?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_reactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_reactions_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_tags: {
        Row: {
          family_id: string
          photo_id: string
          user_id: string
        }
        Insert: {
          family_id: string
          photo_id: string
          user_id: string
        }
        Update: {
          family_id?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_tags_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_tags_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          album_id: string | null
          caption: string | null
          created_at: string
          duration_seconds: number | null
          family_id: string
          id: string
          is_favorite: boolean
          kind: string
          position: number
          taken_at: string | null
          uploader_id: string
          url: string
        }
        Insert: {
          album_id?: string | null
          caption?: string | null
          created_at?: string
          duration_seconds?: number | null
          family_id: string
          id?: string
          is_favorite?: boolean
          kind?: string
          position?: number
          taken_at?: string | null
          uploader_id: string
          url: string
        }
        Update: {
          album_id?: string | null
          caption?: string | null
          created_at?: string
          duration_seconds?: number | null
          family_id?: string
          id?: string
          is_favorite?: boolean
          kind?: string
          position?: number
          taken_at?: string | null
          uploader_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          family_id: string
          id: string
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          family_id: string
          id?: string
          label: string
          poll_id: string
          position?: number
        }
        Update: {
          family_id?: string
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          family_id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          family_id: string
          id: string
          question: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          family_id: string
          id?: string
          question: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          family_id?: string
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      post_images: {
        Row: {
          created_at: string
          family_id: string
          id: string
          position: number
          post_id: string
          url: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          position?: number
          post_id: string
          url: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          position?: number
          post_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_images_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          duration_seconds: number | null
          family_id: string
          id: string
          kind: string
          position: number
          post_id: string
          uploader_id: string
          url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          family_id: string
          id?: string
          kind?: string
          position?: number
          post_id: string
          uploader_id: string
          url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          family_id?: string
          id?: string
          kind?: string
          position?: number
          post_id?: string
          uploader_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          family_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          family_id: string
          post_id: string
          user_id: string
        }
        Update: {
          family_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          event_date: string | null
          family_id: string
          id: string
          is_highlight: boolean
          location: string | null
          mood: string | null
          post_type: Database["public"]["Enums"]["post_type"]
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          event_date?: string | null
          family_id: string
          id?: string
          is_highlight?: boolean
          location?: string | null
          mood?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          event_date?: string | null
          family_id?: string
          id?: string
          is_highlight?: boolean
          location?: string | null
          mood?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_family_id: string | null
          anniversary: string | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string
          favorite_things: string | null
          id: string
          onboarded: boolean
          share_contact: boolean
          suspended_at: string | null
          suspended_reason: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          active_family_id?: string | null
          anniversary?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string
          favorite_things?: string | null
          id: string
          onboarded?: boolean
          share_contact?: boolean
          suspended_at?: string | null
          suspended_reason?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          active_family_id?: string | null
          anniversary?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string
          favorite_things?: string | null
          id?: string
          onboarded?: boolean
          share_contact?: boolean
          suspended_at?: string | null
          suspended_reason?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_family_id_fkey"
            columns: ["active_family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          family_id: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          family_id: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          family_id?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          family_id: string
          id: string
          url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          family_id: string
          id?: string
          url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          family_id?: string
          id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          family_id: string
          story_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          family_id: string
          story_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          family_id?: string
          story_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_chat: { Args: { _chat: string }; Returns: boolean }
      create_family: {
        Args: { _cover_url: string; _name: string; _relationship: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_family_admin: { Args: { _family: string }; Returns: boolean }
      is_family_member: { Args: { _family: string }; Returns: boolean }
      join_family_with_code: {
        Args: { _code: string; _relationship: string }
        Returns: string
      }
      shares_family_with: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "platform_admin" | "moderator" | "user"
      checkin_status: "great" | "good" | "okay" | "tired" | "need_support"
      event_category:
        | "birthday"
        | "gathering"
        | "appointment"
        | "school"
        | "travel"
        | "anniversary"
        | "reminder"
        | "other"
      family_role: "admin" | "adult" | "child"
      post_type:
        | "update"
        | "celebration"
        | "question"
        | "announcement"
        | "appreciation"
        | "memory"
      rsvp_status: "going" | "maybe" | "cannot"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["platform_admin", "moderator", "user"],
      checkin_status: ["great", "good", "okay", "tired", "need_support"],
      event_category: [
        "birthday",
        "gathering",
        "appointment",
        "school",
        "travel",
        "anniversary",
        "reminder",
        "other",
      ],
      family_role: ["admin", "adult", "child"],
      post_type: [
        "update",
        "celebration",
        "question",
        "announcement",
        "appreciation",
        "memory",
      ],
      rsvp_status: ["going", "maybe", "cannot"],
    },
  },
} as const
