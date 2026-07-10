"use client";

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_META, StatusBadge } from "@/components/reconciliation/status-badge";
import { maskAmount } from "@/lib/rbac";
import type {
  ReconStatus,
  ReconciliationRow,
  SettlementStatus,
  UserRole,
} from "@/lib/types";
import { cn, krw, num } from "@/lib/utils";

/**
 * 재무 대사 DataTable (클라이언트 컴포넌트).
 *
 * 성능 전략 (AGENTS.md 2.2 — 대량 데이터 핸들링):
 * - 필터링/페이지네이션 결과는 전부 `useMemo`로 파생 → 무관한 상태 변경 시 재계산 없음.
 * - 행은 `memo()`된 `ReconRowItem`으로 분리 → 필터 입력 타이핑 중 기존 행 리렌더링 방지.
 * - 검색어는 `useDeferredValue`로 디바운싱과 동등한 효과(입력 응답성 우선)를 얻는다.
 * - 수만 건 규모로 확장 시: 페이지네이션을 서버 사이드로 옮기거나
 *   TanStack Virtual 기반 가상 스크롤로 교체하는 것을 전제로 행 구조를 단순하게 유지했다.
 */

/* ------------------------------------------------------------------ */
/* 필터 정의                                                            */
/* ------------------------------------------------------------------ */

/** 시스템별 비교 관점 — 어떤 두 시스템을 대조할지 선택 */
type ComparisonScope = "ALL" | "OMS_WMS" | "OMS_PG";

interface Filters {
  dateFrom: string;
  dateTo: string;
  status: ReconStatus | "ALL";
  settlement: SettlementStatus | "ALL";
  scope: ComparisonScope;
  keyword: string;
}

const INITIAL_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  status: "ALL",
  settlement: "ALL",
  scope: "ALL",
  keyword: "",
};

const SETTLEMENT_LABELS: Record<SettlementStatus, string> = {
  PENDING: "정산예정",
  CONFIRMED: "정산확정",
  PAID: "지급완료",
  HOLD: "보류",
};

/** 비교 관점별 판정: 이 행이 해당 두 시스템 간 이슈와 관련 있는가 */
function matchesScope(row: ReconciliationRow, scope: ComparisonScope): boolean {
  if (scope === "ALL") return true;
  if (scope === "OMS_WMS") {
    // 출고 검증: 주문↔출고 간 누락 또는 수량/금액 상이
    if (!row.oms || !row.wms) return true;
    return (
      row.oms.quantity !== row.wms.quantity ||
      row.oms.amount !== row.wms.amount
    );
  }
  // OMS_PG — 정산 검증: 주문↔PG 정산 간 누락 또는 금액 상이
  if (!row.oms || !row.pg) return true;
  return row.oms.amount !== row.pg.amount;
}

/* ------------------------------------------------------------------ */
/* 엑셀(CSV) 다운로드                                                   */
/* ------------------------------------------------------------------ */

/**
 * 현재 필터가 적용된 결과를 CSV로 내려받는다.
 * - UTF-8 BOM을 붙여 한글 Excel에서 인코딩이 깨지지 않도록 한다.
 * - 권한 마스킹은 화면과 동일하게 적용 → VIEWER가 내보내도 금액이 노출되지 않는다.
 */
function downloadCsv(rows: ReconciliationRow[], role: UserRole) {
  const header = [
    "주문번호", "채널", "거래일자",
    "OMS 금액", "WMS 금액", "PG 정산금액", "차액",
    "정산상태", "대사상태", "사유",
  ];

  const fmt = (amount: number | null | undefined) =>
    amount == null ? "" : maskAmount(String(amount), role);

  const lines = rows.map((row) =>
    [
      row.orderNo,
      row.channel,
      row.transactionDate,
      fmt(row.oms?.amount),
      fmt(row.wms?.amount),
      fmt(row.pg?.amount),
      fmt(row.amountDiff),
      SETTLEMENT_LABELS[row.settlementStatus],
      STATUS_META[row.status].label,
      row.statusReason ?? "",
    ]
      // CSV 이스케이프: 사유 문장에 쉼표/따옴표가 포함될 수 있다
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );

  // "\uFEFF" = UTF-8 BOM — 한글 Excel이 CSV를 UTF-8로 인식하게 하는 필수 처리
  const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reconciliation_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* 행 컴포넌트 (memo)                                                   */
/* ------------------------------------------------------------------ */

/** 금액 셀 — 누락(null)은 경고 텍스트로, 정상 값은 우측 정렬 숫자로 표기 */
function AmountCell({
  amount,
  role,
}: {
  amount: number | null | undefined;
  role: UserRole;
}) {
  if (amount == null) {
    return <span className="text-xs font-medium text-red-600">누락</span>;
  }
  return <span className="tabular-nums">{maskAmount(krw.format(amount), role)}</span>;
}

/**
 * 대사 결과 한 행.
 * `memo`로 감싸 필터 상태 변경 시 살아남는 행의 리렌더링을 차단한다
 * (row/role 참조가 동일하면 스킵).
 */
const ReconRowItem = memo(function ReconRowItem({
  row,
  role,
}: {
  row: ReconciliationRow;
  role: UserRole;
}) {
  const hasDiff = row.amountDiff != null && row.amountDiff !== 0;

  return (
    <tr
      className={cn(
        "border-b border-zinc-100 text-sm text-zinc-700 transition-colors hover:bg-zinc-50",
        // 상태별 행 하이라이트 — 불일치(red)/중복·누락(amber)을 즉시 인지
        STATUS_META[row.status].rowClass,
      )}
    >
      <td className="px-3 py-2.5 font-medium text-zinc-900">{row.orderNo}</td>
      <td className="px-3 py-2.5">{row.channel}</td>
      <td className="px-3 py-2.5 tabular-nums">{row.transactionDate}</td>
      <td className="px-3 py-2.5 text-right">
        <AmountCell amount={row.oms?.amount ?? null} role={role} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <AmountCell amount={row.wms?.amount ?? null} role={role} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <AmountCell amount={row.pg?.amount ?? null} role={role} />
      </td>
      <td
        className={cn(
          "px-3 py-2.5 text-right tabular-nums",
          hasDiff && "font-semibold text-red-600",
        )}
      >
        {row.amountDiff == null
          ? "—"
          : maskAmount(krw.format(row.amountDiff), role)}
      </td>
      <td className="px-3 py-2.5">
        <Badge variant={row.settlementStatus === "HOLD" ? "warning" : "outline"}>
          {SETTLEMENT_LABELS[row.settlementStatus]}
        </Badge>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={row.status} reason={row.statusReason} />
      </td>
    </tr>
  );
});

/* ------------------------------------------------------------------ */
/* 메인 테이블                                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 8;

const SELECT_CLASS =
  "h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-700 focus-visible:outline-2 focus-visible:outline-zinc-900";

export function DataTable({
  rows,
  role,
}: {
  rows: ReconciliationRow[];
  role: UserRole;
}) {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  // 검색어 입력은 즉시 반영하되, 대량 행 필터링은 지연 값으로 수행해
  // 타이핑 프레임 드랍을 막는다 (디바운싱과 동등한 UX).
  const deferredKeyword = useDeferredValue(filters.keyword);

  /** 필터 변경 핸들러 — 필터가 바뀌면 1페이지로 리셋 */
  const updateFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    [],
  );

  /** 전체 필터 파이프라인 — 의존한 입력이 바뀔 때만 재계산 */
  const filteredRows = useMemo(() => {
    const keyword = deferredKeyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.dateFrom && row.transactionDate < filters.dateFrom) return false;
      if (filters.dateTo && row.transactionDate > filters.dateTo) return false;
      if (filters.status !== "ALL" && row.status !== filters.status) return false;
      if (filters.settlement !== "ALL" && row.settlementStatus !== filters.settlement)
        return false;
      if (!matchesScope(row, filters.scope)) return false;
      if (keyword && !row.orderNo.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [rows, filters.dateFrom, filters.dateTo, filters.status, filters.settlement, filters.scope, deferredKeyword]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const pagedRows = useMemo(
    () =>
      filteredRows.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [filteredRows, currentPage],
  );

  const handleDownload = useCallback(() => {
    // 화면에 보이는 페이지가 아니라 "필터 적용된 전체"를 내보낸다 — 실무 대사 작업 단위
    downloadCsv(filteredRows, role);
  }, [filteredRows, role]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* ---------- 필터 바 ---------- */}
      <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          거래 기간
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className={SELECT_CLASS}
              aria-label="시작일"
            />
            <span className="text-zinc-400">~</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className={SELECT_CLASS}
              aria-label="종료일"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          대사 상태
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value as Filters["status"])}
            className={SELECT_CLASS}
          >
            <option value="ALL">전체</option>
            <option value="MATCH">정상</option>
            <option value="MISMATCH">불일치</option>
            <option value="DUPLICATED">중복</option>
            <option value="MISSING">누락</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          정산 상태
          <select
            value={filters.settlement}
            onChange={(e) => updateFilter("settlement", e.target.value as Filters["settlement"])}
            className={SELECT_CLASS}
          >
            <option value="ALL">전체</option>
            {Object.entries(SETTLEMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          시스템 비교
          <select
            value={filters.scope}
            onChange={(e) => updateFilter("scope", e.target.value as ComparisonScope)}
            className={SELECT_CLASS}
          >
            <option value="ALL">전체</option>
            <option value="OMS_WMS">OMS ↔ WMS (출고 검증)</option>
            <option value="OMS_PG">OMS ↔ PG (정산 검증)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          주문번호 검색
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="search"
              placeholder="ORD-..."
              value={filters.keyword}
              onChange={(e) => updateFilter("keyword", e.target.value)}
              className={cn(SELECT_CLASS, "w-44 pl-8")}
            />
          </div>
        </label>

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            엑셀 다운로드
          </Button>
        </div>
      </div>

      {/* ---------- 테이블 ---------- */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-240 border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500">
              <th className="px-3 py-2.5 font-semibold">주문번호</th>
              <th className="px-3 py-2.5 font-semibold">채널</th>
              <th className="px-3 py-2.5 font-semibold">거래일자</th>
              <th className="px-3 py-2.5 text-right font-semibold">OMS 주문금액</th>
              <th className="px-3 py-2.5 text-right font-semibold">WMS 출고금액</th>
              <th className="px-3 py-2.5 text-right font-semibold">PG 정산금액</th>
              <th className="px-3 py-2.5 text-right font-semibold">차액</th>
              <th className="px-3 py-2.5 font-semibold">정산상태</th>
              <th className="px-3 py-2.5 font-semibold">대사결과</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <ReconRowItem key={row.id} row={row} role={role} />
            ))}
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-sm text-zinc-400">
                  조건에 해당하는 대사 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- 페이지네이션 ---------- */}
      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
        <p className="text-xs text-zinc-500">
          총 <span className="font-semibold text-zinc-900">{num.format(filteredRows.length)}</span>건
          {filteredRows.length !== rows.length && (
            <span> (전체 {num.format(rows.length)}건 중 필터 적용)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="text-xs tabular-nums text-zinc-600">
            {currentPage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage >= pageCount}
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}
