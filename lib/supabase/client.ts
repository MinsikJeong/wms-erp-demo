"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 브라우저용 Supabase 클라이언트 (싱글턴).
 * publishable(anon) key는 RLS 정책(select만 허용) 하에서만 동작하므로
 * 클라이언트 번들에 포함되어도 안전하다.
 */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      // 데모는 익명 조회 전용 — 세션 저장 로직을 꺼서 오버헤드 제거
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return browserClient;
}
