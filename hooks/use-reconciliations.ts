"use client";

import { useQuery } from "@tanstack/react-query";
import { RECON_QUERY_KEY, fetchReconciliations } from "@/lib/recon";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 대사 데이터 조회 훅 (TanStack Query).
 *
 * 서버 컴포넌트에서 prefetch + HydrationBoundary로 내려준 캐시를 이어받아
 * 첫 화면은 재요청 없이 그리고, 이후 staleTime 경과 시에만 재검증한다.
 * queryKey/queryFn 계약은 lib/recon.ts와 공유한다.
 */
export function useReconciliations() {
  return useQuery({
    queryKey: RECON_QUERY_KEY,
    queryFn: () => fetchReconciliations(getSupabaseBrowserClient()),
  });
}
