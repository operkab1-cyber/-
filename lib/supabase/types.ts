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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
