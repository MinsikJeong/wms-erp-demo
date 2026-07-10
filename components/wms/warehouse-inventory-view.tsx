"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  FilterBar,
  FilterField,
  SearchFilter,
  SelectFilter,
} from "@/components/wms/filters";
import { PagedTable, SortableHeader } from "@/components/wms/paged-table";
import { SetupNotice } from "@/components/wms/setup-notice";
import { useItems, useWarehouseInventoryPage, useWarehouses } from "@/hooks/use-wms";
import { maskAmount } from "@/lib/rbac";
import {
  createWarehouseInventoryParams,
  type WarehouseInventoryParams,
  type WarehouseInventorySortKey,
} from "@/lib/wms/api";
import type { WarehouseInventoryRow } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { krw, num } from "@/lib/utils";

/**
 * 4-2. 창고별 재고현황 — 창고 × 품목 상세 (v_warehouse_inventory).
 * 창고/카테고리 필터와 SKU 검색을 서버로 push-down 해 페이지 단위 조회한다.
 */
export function WarehouseInventoryView({ role }: { role: UserRole }) {
  const [params, setParams] = useState<WarehouseInventoryParams>(
    createWarehouseInventoryParams,
  );
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);

  useEffect(() => {
    setParams((prev) =>
      prev.keyword === deferredKeyword
        ? prev
        : { ...prev, keyword: deferredKeyword, pageIndex: 0 },
    );
  }, [deferredKeyword]);

  const query = useWarehouseInventoryPage(params);
  const { data: warehouses } = useWarehouses();
  const { data: items } = useItems();

  const categories = useMemo(
    () => [...new Set((items ?? []).map((i) => i.category))].sort(),
    [items],
  );

  const columns = useMemo<ColumnDef<WarehouseInventoryRow>[]>(
    () => [
      {
        accessorKey: "warehouseName",
        header: "창고",
        cell: ({ row }) => (
          <span>
            {row.original.warehouseName}
            <span className="ml-1 text-xs text-muted-foreground">
              {row.original.warehouseCode}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "sku",
        header: ({ column }) => <SortableHeader label="SKU" column={column} />,
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "itemName", header: "품목명" },
      { accessorKey: "category", header: "카테고리" },
      { accessorKey: "unit", header: "단위" },
      {
        accessorKey: "qty",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader label="수량" column={column} align="right" />
          </div>
        ),
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums">{num.format(getValue<number>())}</div>
        ),
      },
      {
        accessorKey: "value",
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
      {
        accessorKey: "updatedAt",
        header: "최종 변동",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {new Date(getValue<string>()).toLocaleString("ko-KR")}
          </span>
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
        <FilterField label="창고">
          <SelectFilter
            value={params.warehouseId}
            onChange={(warehouseId) =>
              setParams((prev) => ({ ...prev, warehouseId, pageIndex: 0 }))
            }
            options={(warehouses ?? []).map((w) => ({ value: w.id, label: w.name }))}
          />
        </FilterField>
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
          <SearchFilter value={keyword} onChange={setKeyword} placeholder="SKU-1001 또는 품목명" />
        </FilterField>
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
            sortBy: sortBy as WarehouseInventorySortKey,
            sortDir,
            pageIndex: 0,
          }))
        }
        role={role}
        getRowId={(row) => `${row.warehouseId}:${row.itemId}`}
        emptyMessage="재고 데이터가 없습니다."
      />
    </section>
  );
}
