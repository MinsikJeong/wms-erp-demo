import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { ReconciliationView } from "@/components/reconciliation/reconciliation-view";
import { getCurrentUser } from "@/lib/auth";
import {
  createDefaultParams,
  fetchReconSummary,
  fetchReconciliationPage,
  reconKeys,
} from "@/lib/recon";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "정산 대사 | NewSelect FIS",
};

/**
 * 재무 데이터 검증·대사 페이지 (서버 컴포넌트).
 *
 * TanStack Query 서버 프리페치:
 * - "첫 페이지(기본 파라미터)"와 "전체 집계"만 서버에서 미리 채운다.
 *   이후 페이지 이동/필터 변경은 클라이언트가 해당 조합만 개별 요청한다.
 * - prefetchQuery는 실패해도 throw하지 않으므로 테이블/함수 미생성 오류는
 *   클라이언트 useQuery가 재시도 후 세팅 안내 화면으로 분기한다.
 * - createDefaultParams()가 클라이언트 초기 상태와 동일한 queryKey를 보장한다.
 */
export default async function ReconciliationPage() {
  const user = await getCurrentUser();

  const queryClient = new QueryClient();
  const supabase = getSupabaseServerClient();
  const defaultParams = createDefaultParams();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: reconKeys.page(defaultParams),
      queryFn: () => fetchReconciliationPage(supabase, defaultParams),
    }),
    queryClient.prefetchQuery({
      queryKey: reconKeys.summary,
      queryFn: () => fetchReconSummary(supabase),
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          정산 대사 (Reconciliation)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OMS 주문 · WMS 출고 · PG 정산 데이터를 주문번호 기준으로 상호
          검증합니다. 불일치·중복·누락 건은 행 하이라이트와 뱃지로 표시되며,
          뱃지에 마우스를 올리면 구체적 사유를 확인할 수 있습니다.
        </p>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReconciliationView role={user.role} />
      </HydrationBoundary>
    </div>
  );
}
