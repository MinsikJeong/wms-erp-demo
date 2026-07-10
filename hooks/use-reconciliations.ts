"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchReconciliationPage,
  fetchReconSummary,
  reconKeys,
  type ReconPageParams,
} from "@/lib/recon";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 대사 데이터 조회 훅 (TanStack Query, 서버 사이드 페이지네이션).
 *
 * - queryKey에 파라미터 전체가 포함돼 페이지/필터/정렬 조합별로 캐시가 분리된다.
 *   방문했던 페이지로 돌아가면 staleTime 내에서는 재요청 없이 즉시 표시된다.
 * - placeholderData: keepPreviousData → 페이지 전환 중 이전 데이터를 유지해
 *   테이블이 비었다가 다시 그려지는 깜빡임을 없앤다 (isPlaceholderData로 표시).
 */
export function useReconciliationPage(params: ReconPageParams) {
  return useQuery({
    queryKey: reconKeys.page(params),
    queryFn: () => fetchReconciliationPage(getSupabaseBrowserClient(), params),
    placeholderData: keepPreviousData,
  });
}

/** Metric Card 집계 + 채널 필터 옵션 (DB RPC 1회 계산) */
export function useReconSummary() {
  return useQuery({
    queryKey: reconKeys.summary,
    queryFn: () => fetchReconSummary(getSupabaseBrowserClient()),
  });
}
