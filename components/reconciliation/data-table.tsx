"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SETTLEMENT_LABELS,
  reconColumns,
  rowHighlightClass,
} from "@/components/reconciliation/columns";
import { STATUS_META } from "@/components/reconciliation/status-badge";
import { useReconciliationPage } from "@/hooks/use-reconciliations";
import { maskAmount } from "@/lib/rbac";
import {
  createDefaultParams,
  fetchAllFiltered,
  type ComparisonScope,
  type ReconPageParams,
  type ReconSortKey,
} from "@/lib/recon";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { RECON_STATUSES, type ReconciliationRow, type UserRole } from "@/lib/types";
import { cn, num } from "@/lib/utils";

/**
 * 재무 대사 DataTable (TanStack Table + 서버 사이드 페이지네이션).
 *
 * 데이터 전략 (AGENTS.md 2.2 — 대량 데이터 핸들링):
 * - 항상 "현재 페이지 1개"만 Supabase에서 가져온다 (.range).
 *   페이지 이동·필터·검색·정렬 변경 시 해당 조합의 쿼리만 재실행되고,
 *   필터/정렬은 전부 DB로 push-down 되어 인덱스를 탄다.
 * - TanStack Table은 manual 모드(manualPagination/Sorting/Filtering)로
 *   상태 관리와 렌더링만 담당한다.
 * - TanStack Query가 파라미터 조합별로 캐시 → 방문한 페이지 재진입 시 무요청.
 * - keepPreviousData로 페이지 전환 중 이전 행을 유지해 깜빡임을 제거한다.
 * - 검색어는 useDeferredValue로 지연시켜 타이핑 중 요청 폭주를 막는다.
 */

const ALL = "ALL" as const;

/** 필터 셀렉트 공통 폭 — 모바일에서는 그리드 셀을 꽉 채운다 */
const FILTER_TRIGGER_CLASS = "w-full min-w-32 sm:w-auto";

/**
 * CSV 다운로드 — 현재 필터의 "전체" 행을 서버에서 별도 조회해 내보낸다.
 * UTF-8 BOM(\uFEFF)으로 한글 Excel 인코딩 깨짐을 방지하고,
 * 권한 마스킹을 화면과 동일하게 적용해 내보내기 우회를 차단한다.
 */
function buildCsv(rows: ReconciliationRow[], role: UserRole): Blob {
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
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );

  return new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataTable({
  role,
  channels,
}: {
  role: UserRole;
  /** 채널 필터 옵션 — recon_summary RPC가 내려준 전체 채널 목록 */
  channels: string[];
}) {
  const [params, setParams] = useState<ReconPageParams>(createDefaultParams);
  const [keyword, setKeyword] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // 검색어 타이핑마다 서버 요청이 나가지 않도록 지연 값으로 쿼리를 구성한다
  const deferredKeyword = useDeferredValue(keyword);
  const queryParams = useMemo<ReconPageParams>(
    () => ({ ...params, keyword: deferredKeyword }),
    [params, deferredKeyword],
  );

  const { data, isPending, isError, error, isPlaceholderData, isFetching } =
    useReconciliationPage(queryParams);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / params.pageSize));

  /** 필터류 변경 공통 처리 — 조건이 바뀌면 항상 1페이지부터 다시 본다 */
  const updateFilter = useCallback((patch: Partial<ReconPageParams>) => {
    setParams((prev) => ({ ...prev, ...patch, pageIndex: 0 }));
  }, []);

  // 검색어 변경도 1페이지로 리셋 (검색 결과가 현재 페이지보다 적을 수 있다)
  useEffect(() => {
    setParams((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [deferredKeyword]);

  // 필터 축소로 현재 페이지가 범위를 벗어나면 마지막 페이지로 보정
  useEffect(() => {
    if (data && !isPlaceholderData && params.pageIndex >= pageCount) {
      setParams((prev) => ({ ...prev, pageIndex: pageCount - 1 }));
    }
  }, [data, isPlaceholderData, params.pageIndex, pageCount]);

  /** TanStack Table 정렬 상태 ↔ 서버 파라미터 변환 */
  const sorting = useMemo<SortingState>(
    () => [{ id: params.sortBy, desc: params.sortDir === "desc" }],
    [params.sortBy, params.sortDir],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      setParams((prev) => {
        const current: SortingState = [
          { id: prev.sortBy, desc: prev.sortDir === "desc" },
        ];
        const next = typeof updater === "function" ? updater(current) : updater;
        const first = next[0];
        const fallback = createDefaultParams();
        return {
          ...prev,
          pageIndex: 0,
          sortBy: (first?.id as ReconSortKey) ?? fallback.sortBy,
          sortDir: first ? (first.desc ? "desc" : "asc") : fallback.sortDir,
        };
      });
    },
    [],
  );

  const table = useReactTable({
    data: rows,
    columns: reconColumns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    // 서버가 필터/정렬/페이지네이션을 수행 — 테이블은 현재 페이지 표현만 담당
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    state: {
      sorting,
      pagination: { pageIndex: params.pageIndex, pageSize: params.pageSize },
    },
    onSortingChange,
    onPaginationChange: (updater) => {
      setParams((prev) => {
        const current = { pageIndex: prev.pageIndex, pageSize: prev.pageSize };
        const next = typeof updater === "function" ? updater(current) : updater;
        return {
          ...prev,
          pageIndex: next.pageSize !== prev.pageSize ? 0 : next.pageIndex,
          pageSize: next.pageSize,
        };
      });
    },
    meta: { role },
  });

  const handleDownload = useCallback(async () => {
    // 보이는 페이지가 아니라 "현재 필터의 전체"를 서버에서 받아 내보낸다
    setIsExporting(true);
    try {
      const allRows = await fetchAllFiltered(getSupabaseBrowserClient(), queryParams);
      saveBlob(
        buildCsv(allRows, role),
        `reconciliation_${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } finally {
      setIsExporting(false);
    }
  }, [queryParams, role]);

  if (isError) {
    return (
      <section className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        데이터 조회 중 오류가 발생했습니다: {error.message}
        {error.message.includes("42703") && (
          <p className="mt-2">
            → <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/02-server-paging.sql</code>
            을 SQL Editor에서 실행해 주세요.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      {/* ---------- 필터 바 (반응형: 모바일 2열 그리드 → 데스크톱 인라인) ---------- */}
      <div className="grid grid-cols-2 items-end gap-3 border-b p-4 sm:flex sm:flex-wrap">
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <Label className="text-xs text-muted-foreground">거래 기간</Label>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={params.dateFrom}
              onChange={(e) => updateFilter({ dateFrom: e.target.value })}
              aria-label="시작일"
              className="h-8"
            />
            <span className="text-muted-foreground">~</span>
            <Input
              type="date"
              value={params.dateTo}
              onChange={(e) => updateFilter({ dateTo: e.target.value })}
              aria-label="종료일"
              className="h-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">대사 상태</Label>
          <Select
            value={params.status || ALL}
            onValueChange={(v) =>
              updateFilter({ status: v === ALL ? "" : (v as ReconPageParams["status"]) })
            }
          >
            <SelectTrigger size="sm" className={FILTER_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체</SelectItem>
              {RECON_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_META[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">정산 상태</Label>
          <Select
            value={params.settlement || ALL}
            onValueChange={(v) =>
              updateFilter({ settlement: v === ALL ? "" : (v as ReconPageParams["settlement"]) })
            }
          >
            <SelectTrigger size="sm" className={FILTER_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체</SelectItem>
              {Object.entries(SETTLEMENT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">채널</Label>
          <Select
            value={params.channel || ALL}
            onValueChange={(v) => updateFilter({ channel: v === ALL ? "" : v })}
          >
            <SelectTrigger size="sm" className={FILTER_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체</SelectItem>
              {channels.map((channel) => (
                <SelectItem key={channel} value={channel}>{channel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">시스템 비교</Label>
          <Select
            value={params.scope || ALL}
            onValueChange={(v) =>
              updateFilter({ scope: v === ALL ? "" : (v as ComparisonScope) })
            }
          >
            <SelectTrigger size="sm" className={FILTER_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체</SelectItem>
              <SelectItem value="OMS_WMS">OMS ↔ WMS (출고 검증)</SelectItem>
              <SelectItem value="OMS_PG">OMS ↔ PG (정산 검증)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">주문번호 검색</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="ORD-..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-8 w-full pl-8 sm:w-40"
            />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleDownload}
            disabled={isExporting || total === 0}
          >
            {isExporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            엑셀 다운로드
          </Button>
        </div>
      </div>

      {/* ---------- 테이블 (모바일: 가로 스크롤) ---------- */}
      <div className="overflow-x-auto">
        {/* 페이지 전환 중에는 이전 데이터를 흐리게 유지해 깜빡임을 없앤다 */}
        <Table
          className={cn(
            "min-w-240 transition-opacity",
            isPlaceholderData && isFetching && "opacity-50",
          )}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isPending ? (
              // 최초 로딩 스켈레톤 — 행 높이를 실제와 맞춰 CLS 방지
              Array.from({ length: params.pageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={reconColumns.length} className="py-2.5">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={reconColumns.length}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  조건에 해당하는 대사 데이터가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={cn(rowHighlightClass(row))}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---------- 페이지네이션 ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">
          총 <span className="font-semibold text-foreground">{num.format(total)}</span>건
          {isFetching && !isPending && (
            <Loader2 className="ml-1.5 inline size-3 animate-spin align-[-2px]" aria-label="불러오는 중" />
          )}
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">표시 행</Label>
            <Select
              value={String(params.pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-17">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="이전 페이지"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {params.pageIndex + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="다음 페이지"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
