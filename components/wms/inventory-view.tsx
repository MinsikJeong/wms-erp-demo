"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  FilterBar,
  FilterField,
  SearchFilter,
  SelectFilter,
} from "@/components/wms/filters";
import { ExportButton } from "@/components/wms/export-button";
import { PagedTable, SortableHeader } from "@/components/wms/paged-table";
import { SetupNotice } from "@/components/wms/setup-notice";
import { useInventoryByItemPage, useItems } from "@/hooks/use-wms";
import { exportFiltered, type ExportColumn } from "@/lib/export";
import { canViewAmounts, maskAmount } from "@/lib/rbac";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createInventoryParams,
  fetchInventoryByItemPage,
  type InventoryParams,
  type InventorySortKey,
} from "@/lib/wms/api";
import type { InventoryByItemRow } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { krw, num } from "@/lib/utils";

/** 재고 부족 기준 (전 창고 합산) — wms_summary()의 lowStockCount와 동일 기준 */
const LOW_STOCK_THRESHOLD = 30;

/**
 * 4-1. 재고현황 — 품목별 전 창고 합산 재고 (v_inventory_by_item).
 * 재고 부족 품목은 행 하이라이트 + 뱃지로 즉시 인지되도록 표시한다.
 */
export function InventoryView({ role }: { role: UserRole }) {
  const [params, setParams] = useState<InventoryParams>(createInventoryParams);
  const [keyword, setKeyword] = useState("");
  // 지연 검색어는 렌더 시점에 파라미터로 합성 (effect + setState 동기화 금지)
  const deferredKeyword = useDeferredValue(keyword);
  const queryParams = useMemo(
    () => ({ ...params, keyword: deferredKeyword }),
    [params, deferredKeyword],
  );

  /** 검색어 변경 시 페이지만 즉시 1페이지로 — 검색어 자체는 지연 값으로 반영 */
  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    setParams((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  };

  const query = useInventoryByItemPage(queryParams);
  const { data: items } = useItems();

  /** 엑셀 내보내기 — 금액 컬럼은 화면과 동일하게 VIEWER 마스킹 적용 */
  const handleExport = () => {
    const showAmounts = canViewAmounts(role);
    const exportColumns: ExportColumn<InventoryByItemRow>[] = [
      { header: "SKU", value: (r) => r.sku },
      { header: "품목명", value: (r) => r.name },
      { header: "카테고리", value: (r) => r.category },
      { header: "단위", value: (r) => r.unit },
      // 권한이 있으면 숫자 타입(합계 가능), 없으면 마스킹 문자열
      { header: "단가", value: (r) => (showAmounts ? r.unitPrice : "₩ ***,***") },
      { header: "총 재고", value: (r) => r.totalQty },
      { header: "보유창고수", value: (r) => r.warehouseCount },
      { header: "재고금액", value: (r) => (showAmounts ? r.totalValue : "₩ ***,***") },
      { header: "재고부족", value: (r) => (r.totalQty < LOW_STOCK_THRESHOLD ? "Y" : "") },
    ];
    return exportFiltered(
      (pageIndex, pageSize) =>
        fetchInventoryByItemPage(getSupabaseBrowserClient(), {
          ...queryParams,
          pageIndex,
          pageSize,
        }),
      exportColumns,
      "재고현황",
    );
  };

  /** 카테고리 옵션은 품목 마스터에서 유도 */
  const categories = useMemo(
    () => [...new Set((items ?? []).map((i) => i.category))].sort(),
    [items],
  );

  const columns = useMemo<ColumnDef<InventoryByItemRow>[]>(
    () => [
      {
        // id는 InventorySortKey와 일치 → 서버 정렬 매핑
        accessorKey: "sku",
        header: ({ column }) => <SortableHeader label="SKU" column={column} />,
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "name", header: "품목명" },
      { accessorKey: "category", header: "카테고리" },
      { accessorKey: "unit", header: "단위" },
      {
        accessorKey: "unitPrice",
        header: () => <div className="text-right">단가</div>,
        cell: ({ getValue, table }) => (
          <div className="text-right tabular-nums">
            {maskAmount(krw.format(getValue<number>()), table.options.meta!.role)}
          </div>
        ),
      },
      {
        accessorKey: "totalQty",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader label="총 재고" column={column} align="right" />
          </div>
        ),
        cell: ({ row }) => {
          const qty = row.original.totalQty;
          return (
            <div className="flex items-center justify-end gap-1.5 tabular-nums">
              {qty < LOW_STOCK_THRESHOLD && <Badge variant="warning">부족</Badge>}
              <span className={qty < LOW_STOCK_THRESHOLD ? "font-semibold text-amber-700" : undefined}>
                {num.format(qty)}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "warehouseCount",
        header: () => <div className="text-right">보유창고</div>,
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums">{num.format(getValue<number>())}곳</div>
        ),
      },
      {
        accessorKey: "totalValue",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader label="재고금액" column={column} align="right" />
          </div>
        ),
        cell: ({ getValue, table }) => (
          <div className="text-right font-medium tabular-nums">
            {maskAmount(krw.format(getValue<number>()), table.options.meta!.role)}
          </div>
        ),
      },
    ],
    [],
  );

  if (query.isError) {
    return (
      <SetupNotice
        error={query.error}
        onRetry={() => query.refetch()}
        retrying={query.isRefetching}
      />
    );
  }

  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      <FilterBar>
        <FilterField label="카테고리">
          <SelectFilter
            value={params.category}
            onChange={(category) =>
              setParams((prev) => ({ ...prev, category, pageIndex: 0 }))
            }
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </FilterField>
        <FilterField label="SKU/품목명 검색" className="col-span-2 sm:col-span-1">
          <SearchFilter value={keyword} onChange={handleKeywordChange} placeholder="SKU-1001 또는 품목명" />
        </FilterField>

        <ExportButton onExport={handleExport} className="col-span-2 sm:ml-auto" />
      </FilterBar>

      <PagedTable
        columns={columns}
        page={query.data}
        isPending={query.isPending}
        isFetching={query.isFetching}
        isPlaceholderData={query.isPlaceholderData}
        pageIndex={params.pageIndex}
        pageSize={params.pageSize}
        onPageChange={(pageIndex) => setParams((prev) => ({ ...prev, pageIndex }))}
        onPageSizeChange={(pageSize) =>
          setParams((prev) => ({ ...prev, pageSize, pageIndex: 0 }))
        }
        sort={{ sortBy: params.sortBy, sortDir: params.sortDir }}
        onSortChange={({ sortBy, sortDir }) =>
          setParams((prev) => ({
            ...prev,
            sortBy: sortBy as InventorySortKey,
            sortDir,
            pageIndex: 0,
          }))
        }
        role={role}
        getRowId={(row) => row.itemId}
        getRowClass={(row) =>
          row.totalQty < LOW_STOCK_THRESHOLD ? "bg-amber-50 hover:bg-amber-100/70" : ""
        }
        emptyMessage="재고 데이터가 없습니다."
      />
    </section>
  );
}
