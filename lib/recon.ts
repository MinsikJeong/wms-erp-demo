import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReconStatus,
  ReconciliationRow,
  ReconciliationSummary,
  SettlementStatus,
  SystemSnapshot,
} from "@/lib/types";

/**
 * 재무 대사 데이터 액세스 레이어.
 * Supabase(snake_case) ↔ 도메인 타입(camelCase) 변환을 이 파일에 격리해
 * 화면 컴포넌트가 DB 스키마에 직접 의존하지 않도록 한다.
 * 서버 프리페치와 클라이언트 useQuery가 같은 queryKey/queryFn 계약을 공유한다.
 */

/** TanStack Query 캐시 키 — 서버 프리페치와 클라이언트가 반드시 동일해야 한다 */
export const RECON_QUERY_KEY = ["reconciliations"] as const;

/** public.reconciliations 테이블 행 (snake_case) */
export interface ReconciliationDbRow {
  id: string;
  order_no: string;
  channel: string;
  transaction_date: string;
  oms_document_no: string | null;
  oms_amount: number | null;
  oms_quantity: number | null;
  oms_recorded_at: string | null;
  wms_document_no: string | null;
  wms_amount: number | null;
  wms_quantity: number | null;
  wms_recorded_at: string | null;
  pg_document_no: string | null;
  pg_amount: number | null;
  pg_recorded_at: string | null;
  status: ReconStatus;
  status_reason: string | null;
  amount_diff: number | null;
  settlement_status: SettlementStatus;
}

/** 시스템 스냅샷 복원 — 문서번호가 없으면 해당 시스템 레코드 누락으로 간주 */
function toSnapshot(
  documentNo: string | null,
  amount: number | null,
  quantity: number | null,
  recordedAt: string | null,
): SystemSnapshot | null {
  if (documentNo == null || amount == null) return null;
  return { documentNo, amount, quantity, recordedAt: recordedAt ?? "" };
}

export function toDomainRow(db: ReconciliationDbRow): ReconciliationRow {
  return {
    id: db.id,
    orderNo: db.order_no,
    channel: db.channel,
    transactionDate: db.transaction_date,
    oms: toSnapshot(db.oms_document_no, db.oms_amount, db.oms_quantity, db.oms_recorded_at),
    wms: toSnapshot(db.wms_document_no, db.wms_amount, db.wms_quantity, db.wms_recorded_at),
    pg: toSnapshot(db.pg_document_no, db.pg_amount, null, db.pg_recorded_at),
    status: db.status,
    statusReason: db.status_reason,
    amountDiff: db.amount_diff,
    settlementStatus: db.settlement_status,
  };
}

/**
 * 대사 결과 전체 조회.
 * 데모 규모(수백 건)는 1회 조회 후 TanStack Table이 클라이언트에서
 * 정렬/필터/페이지네이션을 처리한다. 수만 건 이상으로 확장 시
 * `.range()` 기반 서버 사이드 페이지네이션 + keepPreviousData로 전환한다.
 */
export async function fetchReconciliations(
  client: SupabaseClient,
): Promise<ReconciliationRow[]> {
  const { data, error } = await client
    .from("reconciliations")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("order_no", { ascending: false })
    .limit(2000);

  if (error) {
    // PGRST205 = 테이블 없음 → 화면에서 "시드 SQL 실행 필요" 안내로 분기
    throw new Error(`${error.code ?? "UNKNOWN"}: ${error.message}`);
  }
  return (data as ReconciliationDbRow[]).map(toDomainRow);
}

/** Metric Card용 요약 집계 — 서버/클라이언트 공용 순수 함수 */
export function summarize(rows: ReconciliationRow[]): ReconciliationSummary {
  return rows.reduce<ReconciliationSummary>(
    (acc, row) => {
      acc.totalCount += 1;
      if (row.status === "MATCH") acc.matchCount += 1;
      if (row.status === "MISMATCH") acc.mismatchCount += 1;
      if (row.status === "DUPLICATED") acc.duplicatedCount += 1;
      if (row.status === "MISSING") acc.missingCount += 1;
      if (row.status !== "MATCH" && row.amountDiff !== null) {
        acc.totalDiffAmount += Math.abs(row.amountDiff);
      }
      return acc;
    },
    {
      totalCount: 0,
      matchCount: 0,
      mismatchCount: 0,
      duplicatedCount: 0,
      missingCount: 0,
      totalDiffAmount: 0,
    },
  );
}
