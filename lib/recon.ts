import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReconStatus,
  ReconciliationRow,
  ReconciliationSummary,
  SettlementStatus,
  SystemSnapshot,
} from "@/lib/types";

/**
 * 재무 대사 데이터 액세스 레이어 (서버 사이드 페이지네이션).
 *
 * - 행 조회는 항상 "현재 페이지 + 현재 필터"만 가져온다 (.range + 필터 push-down).
 * - 전체 집계(Metric Card)와 채널 목록은 DB RPC(recon_summary)가 1회 계산한다.
 * - Supabase(snake_case) ↔ 도메인 타입(camelCase) 변환을 이 파일에 격리해
 *   화면 컴포넌트가 DB 스키마에 의존하지 않도록 한다.
 * - queryKey 팩토리를 함께 정의해 서버 프리페치와 클라이언트 useQuery가
 *   동일한 캐시 계약을 공유한다.
 */

/* ------------------------------------------------------------------ */
/* 조회 파라미터                                                        */
/* ------------------------------------------------------------------ */

/** 시스템별 비교 관점 — DB 생성 컬럼(scope_oms_wms/scope_oms_pg)으로 필터링 */
export type ComparisonScope = "OMS_WMS" | "OMS_PG";

/** 정렬 가능 컬럼 (도메인 필드명 기준) */
export type ReconSortKey = "orderNo" | "transactionDate" | "amountDiff";

/** 서버 조회 파라미터 — queryKey에 그대로 포함되므로 직렬화 가능한 값만 사용 */
export interface ReconPageParams {
  pageIndex: number;
  pageSize: number;
  sortBy: ReconSortKey;
  sortDir: "asc" | "desc";
  /** 빈 문자열 = 필터 미적용 (undefined 대신 ""를 써서 키 형태를 고정) */
  status: ReconStatus | "";
  settlement: SettlementStatus | "";
  channel: string;
  scope: ComparisonScope | "";
  dateFrom: string;
  dateTo: string;
  keyword: string;
}

/** 초기 상태 — 서버 프리페치와 클라이언트 초기 렌더가 반드시 같은 값을 써야 캐시가 적중한다 */
export function createDefaultParams(): ReconPageParams {
  return {
    pageIndex: 0,
    pageSize: 10,
    sortBy: "transactionDate",
    sortDir: "desc",
    status: "",
    settlement: "",
    channel: "",
    scope: "",
    dateFrom: "",
    dateTo: "",
    keyword: "",
  };
}

/* ------------------------------------------------------------------ */
/* Query Key 팩토리                                                     */
/* ------------------------------------------------------------------ */

export const reconKeys = {
  all: ["reconciliations"] as const,
  /** 페이지 조회 — 파라미터 객체가 키에 포함돼 페이지/필터별로 캐시가 분리된다 */
  page: (params: ReconPageParams) => ["reconciliations", "page", params] as const,
  summary: ["reconciliations", "summary"] as const,
};

/* ------------------------------------------------------------------ */
/* DB 행 ↔ 도메인 변환                                                  */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 조회 함수                                                            */
/* ------------------------------------------------------------------ */

/** 도메인 정렬 키 → DB 컬럼 매핑 */
const SORT_COLUMNS: Record<ReconSortKey, string> = {
  orderNo: "order_no",
  transactionDate: "transaction_date",
  amountDiff: "amount_diff",
};

/** ilike 패턴 이스케이프 — 사용자 입력의 %/_가 와일드카드로 동작하지 않게 한다 */
function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/** 필터 체이닝에 필요한 최소 인터페이스 — supabase-js의 깊은 제네릭 전개를 차단한다 */
interface FilterableQuery {
  eq(col: string, v: unknown): FilterableQuery;
  gte(col: string, v: unknown): FilterableQuery;
  lte(col: string, v: unknown): FilterableQuery;
  ilike(col: string, v: string): FilterableQuery;
}

/**
 * 파라미터의 필터 조건을 쿼리 빌더에 적용 (페이지 조회/CSV 내보내기 공용).
 * 모든 조건은 DB로 push-down 되어 네트워크로는 매칭 행만 전송된다.
 */
function applyFilters<T>(query: T, params: ReconPageParams): T {
  let q = query as unknown as FilterableQuery;
  if (params.status) q = q.eq("status", params.status);
  if (params.settlement) q = q.eq("settlement_status", params.settlement);
  if (params.channel) q = q.eq("channel", params.channel);
  if (params.dateFrom) q = q.gte("transaction_date", params.dateFrom);
  if (params.dateTo) q = q.lte("transaction_date", params.dateTo);
  if (params.keyword.trim()) q = q.ilike("order_no", `%${escapeLike(params.keyword.trim())}%`);
  if (params.scope === "OMS_WMS") q = q.eq("scope_oms_wms", true);
  if (params.scope === "OMS_PG") q = q.eq("scope_oms_pg", true);
  return q as unknown as T;
}

export interface ReconPage {
  rows: ReconciliationRow[];
  /** 필터 적용 후 전체 건수 (페이지 수 계산용, count=exact) */
  total: number;
}

/** 현재 페이지 1개만 조회 — 페이지/필터/정렬 변경 시마다 호출된다 */
export async function fetchReconciliationPage(
  client: SupabaseClient,
  params: ReconPageParams,
): Promise<ReconPage> {
  const from = params.pageIndex * params.pageSize;
  const sortColumn = SORT_COLUMNS[params.sortBy];

  let query = applyFilters(
    client.from("reconciliations").select("*", { count: "exact" }),
    params,
  ).order(sortColumn, { ascending: params.sortDir === "asc" });

  // 정렬 키가 겹치는 행의 페이지 간 순서 안정성을 위한 2차 정렬
  if (sortColumn !== "order_no") {
    query = query.order("order_no", { ascending: false });
  }

  const { data, error, count } = await query.range(from, from + params.pageSize - 1);

  if (error) {
    // PGRST205=테이블 없음, 42703=scope 컬럼 없음 → 화면에서 세팅 안내로 분기
    throw new Error(`${error.code ?? "UNKNOWN"}: ${error.message}`);
  }
  return {
    rows: (data as ReconciliationDbRow[]).map(toDomainRow),
    total: count ?? 0,
  };
}

/**
 * 엑셀(CSV) 내보내기용 — 현재 필터의 "전체" 행을 조회한다.
 * 페이지네이션과 무관한 1회성 요청이므로 상한을 두어 폭주를 방지한다.
 */
export const EXPORT_ROW_LIMIT = 10_000;

export async function fetchAllFiltered(
  client: SupabaseClient,
  params: ReconPageParams,
): Promise<ReconciliationRow[]> {
  const sortColumn = SORT_COLUMNS[params.sortBy];
  const { data, error } = await applyFilters(
    client.from("reconciliations").select("*"),
    params,
  )
    .order(sortColumn, { ascending: params.sortDir === "asc" })
    .limit(EXPORT_ROW_LIMIT);

  if (error) throw new Error(`${error.code ?? "UNKNOWN"}: ${error.message}`);
  return (data as ReconciliationDbRow[]).map(toDomainRow);
}

/* ------------------------------------------------------------------ */
/* 전체 집계 (Metric Cards)                                             */
/* ------------------------------------------------------------------ */

/** recon_summary() RPC 응답 — 집계 + 필터 옵션용 채널 목록 */
export interface ReconSummaryResponse extends ReconciliationSummary {
  channels: string[];
}

/** 전체 집계는 DB가 1회 계산 (행 전체를 클라이언트로 가져오지 않는다) */
export async function fetchReconSummary(
  client: SupabaseClient,
): Promise<ReconSummaryResponse> {
  const { data, error } = await client.rpc("recon_summary");
  if (error) {
    // PGRST202 = 함수 없음 → supabase/02-server-paging.sql 실행 안내로 분기
    throw new Error(`${error.code ?? "UNKNOWN"}: ${error.message}`);
  }
  return data as ReconSummaryResponse;
}
