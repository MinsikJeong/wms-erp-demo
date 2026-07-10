import type { Metadata } from "next";
import { DataTable } from "@/components/reconciliation/data-table";
import { MetricCards } from "@/components/reconciliation/metric-cards";
import { getCurrentUser } from "@/lib/auth";
import { fetchReconciliationRows, summarize } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "정산 대사 | NewSelect FIS",
};

/**
 * 재무 데이터 검증·대사 페이지 (서버 컴포넌트).
 *
 * 데이터 흐름:
 * 1. 서버에서 대사 결과(OMS·WMS·PG 3-way 조인)와 세션을 병렬 조회
 * 2. Metric 집계도 서버에서 완료 → 클라이언트는 순수 렌더링
 * 3. 인터랙션(필터/페이지네이션/CSV)이 필요한 테이블만 클라이언트 컴포넌트
 *
 * 로딩 중 스켈레톤은 같은 세그먼트의 `loading.tsx`가 담당하고,
 * 데이터 소스 장애는 상위 `error.tsx` ErrorBoundary가 수습한다.
 */
export default async function ReconciliationPage() {
  // 세션과 대사 데이터는 서로 의존하지 않으므로 병렬로 가져와 응답 시간을 줄인다
  const [user, rows] = await Promise.all([
    getCurrentUser(),
    fetchReconciliationRows(),
  ]);

  const summary = summarize(rows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          정산 대사 (Reconciliation)
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          OMS 주문 · WMS 출고 · PG 정산 데이터를 주문번호 기준으로 상호
          검증합니다. 불일치·중복·누락 건은 행 하이라이트와 뱃지로 표시되며,
          뱃지에 마우스를 올리면 구체적 사유를 확인할 수 있습니다.
        </p>
      </div>

      {/* 상단: 리스크 요약 Metric Cards */}
      <MetricCards summary={summary} role={user.role} />

      {/* 하단: 상세 대조 테이블 (필터 + 엑셀 다운로드) */}
      <DataTable rows={rows} role={user.role} />
    </div>
  );
}
