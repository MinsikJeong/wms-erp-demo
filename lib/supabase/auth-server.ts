import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 인증(세션) 전용 Supabase 서버 클라이언트.
 *
 * WMS 데이터 조회용 익명 클라이언트(`server.ts`)와 분리한다 — 이쪽은 요청의
 * 인증 쿠키에 바인딩되어 로그인 세션(getUser)·로그인/로그아웃 처리에만 쓴다.
 *
 * Next.js 16: `cookies()`는 비동기 API. RSC 렌더 중에는 쿠키 쓰기가 금지되어
 * `setAll`이 throw할 수 있는데, 세션 갱신은 proxy(`proxy.ts`)가 담당하므로
 * 여기서는 조용히 무시해도 안전하다(공식 @supabase/ssr 권장 패턴).
 */
export async function getSupabaseAuthClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // RSC 렌더 컨텍스트에서 호출된 경우 — proxy가 세션을 갱신하므로 무시
          }
        },
      },
    },
  );
}
