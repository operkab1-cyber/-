import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { decodeJwtClaims } from "@/lib/auth/decodeJwt";

const intlMiddleware = createIntlMiddleware({
  locales: ["en", "ru"],
  defaultLocale: "en",
});

// Architecture §12.1: "Middleware Next.js проверяет роль на уровне маршрута как
// первый рубеж, RLS в Postgres — как второй, независимый от frontend". Реальные
// URL-сегменты /supplier, /buyer, /admin (не (group) — route groups Next.js не
// добавляют сегмент в URL, а Architecture §2 рисует и (supplier), и (buyer) с
// одинаковым dashboard/page.tsx, что физически коллизирует на один путь /dashboard —
// [решено самостоятельно] здесь используются настоящие папки-сегменты вместо групп.
const ROLE_PREFIXES: { prefix: string; role: string }[] = [
  { prefix: "/supplier", role: "supplier" },
  { prefix: "/buyer", role: "buyer" },
  { prefix: "/admin", role: "admin" },
];

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  // next-intl уже решил редиректнуть на локализованный путь (например, добавить
  // /en) — авторизацию проверим на следующем проходе, когда путь уже с локалью.
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  const response = intlResponse;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean); // ["ru", "supplier", "dashboard", ...]
  const locale = segments[0] ?? "en";
  const pathAfterLocale = "/" + segments.slice(1).join("/");

  // Точное совпадение сегмента, а не просто startsWith — иначе /suppliers/[slug]
  // (публичная страница профиля поставщика, Phase 7) ложно матчится префиксом
  // "/supplier" (кабинет поставщика) и анонимных посетителей редиректит на /login.
  // [найдено живым тестированием в Phase 9]
  const matchedRule = ROLE_PREFIXES.find((r) => pathAfterLocale === r.prefix || pathAfterLocale.startsWith(r.prefix + "/"));
  const requiresAuth = matchedRule || pathAfterLocale.startsWith("/onboarding");

  if (requiresAuth && !user) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (matchedRule && user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const claims = session ? decodeJwtClaims(session.access_token) : null;
    // Отсутствие claim'а (например, хук ещё не отработал на самой первой сессии)
    // не блокирует — страница и RLS всё равно проверят авторитетно (см. заголовок файла).
    if (claims?.role && claims.role !== matchedRule.role) {
      const statusUrl = new URL(`/${locale}/onboarding/status`, request.url);
      return NextResponse.redirect(statusUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
