"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PageResult } from "@/lib/wms/api";
import type { UserRole } from "@/lib/types";
import { cn, num } from "@/lib/utils";

/**
 * 범용 서버 사이드 페이지네이션 테이블 (WMS 전 목록 화면 공용).
 *
 * - 데이터는 항상 "현재 페이지"만 받는다 — 필터/정렬/페이지는 부모가
 *   파라미터 상태로 관리하고 서버(Supabase)가 수행한다.
 * - TanStack Table은 manual 모드로 상태 관리와 렌더링만 담당.
 * - keepPreviousData 전환 중(isPlaceholderData)에는 이전 데이터를 흐리게 유지.
 */

export interface SortInput {
  sortBy: string;
  sortDir: "asc" | "desc";
}

interface PagedTableProps<T> {
  columns: ColumnDef<T>[];
  page: PageResult<T> | undefined;
  isPending: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** 정렬 미지원 테이블은 생략 */
  sort?: SortInput;
  onSortChange?: (sort: SortInput) => void;
  /** 금액 마스킹 등 셀에서 권한 참조 시 사용 */
  role: UserRole;
  getRowId: (row: T) => string;
  getRowClass?: (row: T) => string;
  emptyMessage?: string;
  /** 테이블 최소 폭 (가로 스크롤 기준) */
  minWidthClass?: string;
  pageSizeOptions?: number[];
}

export function PagedTable<T>({
  columns,
  page,
  isPending,
  isFetching,
  isPlaceholderData,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  role,
  getRowId,
  getRowClass,
  emptyMessage = "조건에 해당하는 데이터가 없습니다.",
  minWidthClass = "min-w-200",
  pageSizeOptions = [10, 20, 50],
}: PagedTableProps<T>) {
  const rows = page?.rows ?? [];
  const total = page?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const sorting = useMemo<SortingState>(
    () => (sort ? [{ id: sort.sortBy, desc: sort.sortDir === "desc" }] : []),
    [sort],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: (updater: Updater<SortingState>) => {
      if (!sort || !onSortChange) return;
      const next =
        typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      // 정렬 해제 시에도 서버 쿼리 안정성을 위해 기존 컬럼 유지
      onSortChange({
        sortBy: first?.id ?? sort.sortBy,
        sortDir: first ? (first.desc ? "desc" : "asc") : "desc",
      });
    },
    onPaginationChange: (updater) => {
      const current = { pageIndex, pageSize };
      const next = typeof updater === "function" ? updater(current) : updater;
      if (next.pageSize !== pageSize) onPageSizeChange(next.pageSize);
      else onPageChange(next.pageIndex);
    },
    meta: { role },
  });

  return (
    <>
      <div className="overflow-x-auto">
        <Table
          className={cn(
            "transition-opacity",
            minWidthClass,
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
              Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length} className="py-2.5">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={getRowClass?.(row.original)}>
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
              value={String(pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-17">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
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
              {pageIndex + 1} / {pageCount}
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
    </>
  );
}

/** 정렬 토글 헤더 버튼 — 컬럼 정의에서 사용 */
export function SortableHeader({
  label,
  column,
  align = "left",
}: {
  label: string;
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  };
  align?: "left" | "right";
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-mx-2 h-7 gap-1 px-2 text-xs font-semibold",
        align === "right" && "-mr-2 ml-auto flex",
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      <Icon className="size-3 text-muted-foreground" aria-hidden />
    </Button>
  );
}
