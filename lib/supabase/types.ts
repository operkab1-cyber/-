// Эти типы — ручной черновик под каталожный срез MVP (Phase 1/3 из Build Prompt).
// В реальном проекте заменяются автогенерацией:
//   npx supabase gen types typescript --local > lib/supabase/types.ts
// Оставлено намеренно узким — только то, что использует уже написанный код каталога,
// остальные таблицы описаны в Tamga_Green_Database_Design.md и появятся здесь по мере
// того, как для них будет написан код.
//
// `Relationships: []` на каждой таблице и `Views/Functions/Enums/CompositeTypes: {}`
// на схеме — не бизнес-данные, а обязательная форма для дженериков @supabase/supabase-js
// (без них PostgrestClient не может вывести тип результата `.select()` и схлопывает
// его в `never`).

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          slug: string;
          icon: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & {
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      plants: {
        Row: {
          id: string;
          company_id: string | null;
          category_id: string | null;
          slug: string;
          latin_name: string | null;
          sku: string | null;
          unit: string;
          status: "draft" | "active" | "hidden" | "out_of_stock" | "archived";
          is_plant: boolean;
          min_order_qty: number | null;
          cover_image_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plants"]["Row"]> & {
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["plants"]["Row"]>;
        Relationships: [];
      };
      plant_images: {
        Row: {
          id: string;
          plant_id: string;
          file_path: string;
          alt_text: string | null;
          position: number;
          is_cover: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["plant_images"]["Row"]> & {
          plant_id: string;
          file_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["plant_images"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "plant_images_plant_id_fkey";
            columns: ["plant_id"];
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
        ];
      };
      prices: {
        Row: {
          id: string;
          plant_id: string;
          min_qty: number;
          price: number;
          currency: string;
          valid_from: string | null;
          valid_to: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["prices"]["Row"]> & {
          plant_id: string;
          min_qty: number;
          price: number;
        };
        Update: Partial<Database["public"]["Tables"]["prices"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "prices_plant_id_fkey";
            columns: ["plant_id"];
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
        ];
      };
      availability: {
        Row: {
          id: string;
          plant_id: string;
          location: string | null;
          quantity: number;
          season_start: string | null;
          season_end: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["availability"]["Row"]> & {
          plant_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["availability"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "availability_plant_id_fkey";
            columns: ["plant_id"];
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
        ];
      };
      translations: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          field: string;
          locale: string;
          value: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["translations"]["Row"]> & {
          entity_type: string;
          entity_id: string;
          field: string;
          locale: string;
        };
        Update: Partial<Database["public"]["Tables"]["translations"]["Row"]>;
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          type: "nursery" | "wholesaler" | "garden_center" | "landscaper" | "other";
          country: string;
          vat_number: string | null;
          address: string | null;
          description: string | null;
          logo_url: string | null;
          verification_status: "pending" | "approved" | "rejected";
          rating_avg: number;
          rating_count: number;
          monthly_purchase_volume: string | null;
          credit_limit: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["companies"]["Row"]> & {
          name: string;
          slug: string;
          type: Database["public"]["Tables"]["companies"]["Row"]["type"];
          country: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Row"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          company_id: string | null;
          role: "supplier" | "buyer" | "admin" | "consumer";
          full_name: string;
          email: string;
          phone: string | null;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & {
          id: string;
          role: Database["public"]["Tables"]["users"]["Row"]["role"];
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_documents: {
        Row: {
          id: string;
          company_id: string;
          doc_type: string;
          file_path: string;
          status: "pending" | "approved" | "rejected";
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["verification_documents"]["Row"]> & {
          company_id: string;
          doc_type: string;
          file_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["verification_documents"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "verification_documents_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      attributes: {
        Row: {
          id: string;
          category_id: string | null;
          code: string;
          data_type: "text" | "number" | "boolean" | "enum";
          unit: string | null;
          enum_options: string[] | null;
          is_filterable: boolean;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["attributes"]["Row"]> & {
          code: string;
          data_type: Database["public"]["Tables"]["attributes"]["Row"]["data_type"];
        };
        Update: Partial<Database["public"]["Tables"]["attributes"]["Row"]>;
        Relationships: [];
      };
      plant_attribute_values: {
        Row: {
          id: string;
          plant_id: string;
          attribute_id: string;
          value_text: string | null;
          value_number: number | null;
          value_boolean: boolean | null;
        };
        Insert: Partial<Database["public"]["Tables"]["plant_attribute_values"]["Row"]> & {
          plant_id: string;
          attribute_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["plant_attribute_values"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "plant_attribute_values_plant_id_fkey";
            columns: ["plant_id"];
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plant_attribute_values_attribute_id_fkey";
            columns: ["attribute_id"];
            referencedRelation: "attributes";
            referencedColumns: ["id"];
          },
        ];
      };
      plant_compatibility: {
        Row: {
          id: string;
          plant_id_a: string;
          plant_id_b: string;
          relation: "companion" | "incompatible";
          reason: string | null;
          source: "expert" | "ai_suggested";
        };
        Insert: Partial<Database["public"]["Tables"]["plant_compatibility"]["Row"]> & {
          plant_id_a: string;
          plant_id_b: string;
          relation: Database["public"]["Tables"]["plant_compatibility"]["Row"]["relation"];
        };
        Update: Partial<Database["public"]["Tables"]["plant_compatibility"]["Row"]>;
        Relationships: [];
      };
      requests: {
        Row: {
          id: string;
          user_id: string | null;
          type: "quote" | "contact" | "project_consultation" | "plant_availability_alert";
          subject_type: "plant" | "landscape_solution" | "project" | null;
          subject_id: string | null;
          name: string | null;
          email: string | null;
          phone: string | null;
          message: string | null;
          status: "new" | "in_progress" | "closed";
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["requests"]["Row"]> & {
          type: Database["public"]["Tables"]["requests"]["Row"]["type"];
        };
        Update: Partial<Database["public"]["Tables"]["requests"]["Row"]>;
        Relationships: [];
      };
      carts: {
        Row: {
          id: string;
          buyer_company_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["carts"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["carts"]["Row"]>;
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          plant_id: string | null;
          qty: number;
          price_snapshot: number;
        };
        Insert: Partial<Database["public"]["Tables"]["cart_items"]["Row"]> & {
          cart_id: string;
          qty: number;
          price_snapshot: number;
        };
        Update: Partial<Database["public"]["Tables"]["cart_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_plant_id_fkey";
            columns: ["plant_id"];
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          buyer_company_id: string | null;
          supplier_company_id: string | null;
          status: "new" | "confirmed" | "packed" | "shipped" | "delivered" | "completed" | "disputed" | "cancelled";
          subtotal: number;
          shipping_cost: number;
          total: number;
          currency: string;
          shipping_address: Record<string, unknown>;
          payment_method: string | null;
          confirm_deadline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          order_number: string;
          subtotal: number;
          total: number;
          shipping_address: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          plant_id: string | null;
          product_name_snapshot: Record<string, unknown>;
          qty: number;
          unit_price: number;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
          product_name_snapshot: Record<string, unknown>;
          qty: number;
          unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          status: "new" | "confirmed" | "packed" | "shipped" | "delivered" | "completed" | "disputed" | "cancelled";
          changed_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_status_history"]["Row"]> & {
          order_id: string;
          status: Database["public"]["Tables"]["order_status_history"]["Row"]["status"];
        };
        Update: Partial<Database["public"]["Tables"]["order_status_history"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_plants_fuzzy: {
        Args: { query_text: string };
        Returns: { plant_id: string; score: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
