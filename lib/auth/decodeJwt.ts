// Декодирует payload JWT без проверки подписи — используется только в middleware
// (Edge runtime, нет Buffer) для быстрого чтения custom claims (role/company_id,
// см. supabase/migrations/0005_auth_hook.sql) без похода в БД (Architecture §12.1,
// "первый рубеж"). RLS в Postgres остаётся источником истины — если здесь что-то
// не распарсится, middleware просто ничего не блокирует, а страница/RLS решают сами.
export function decodeJwtClaims(token: string): { role?: string; company_id?: string } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}
