import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버(RSC/Route Handler)용 Supabase 클라이언트.
 * TanStack Query 서버 프리페치(초기 HTML에 데이터 포함)에 사용된다.
 * 요청 간 상태를 공유하지 않도록 호출 시마다 생성한다.
 */
export function getSupabaseServerClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
