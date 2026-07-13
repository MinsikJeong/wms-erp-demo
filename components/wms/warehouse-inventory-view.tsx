"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { LandPlot, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilterBar,
  FilterField,
  SearchFilter,
  SelectFilter,
} from "@/components/wms/filters";
import { FloorPlan } from "@/components/wms/floor-plan";
import { PagedTable, SortableHeader } from "@/components/wms/paged-table";
import { SetupNotice, isSetupError } from "@/components/wms/setup-notice";
import {
  useItems,
  useWarehouseInventoryPage,
  useWarehouses,
  useZoneInventory,
} from "@/hooks/use-wms";
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
 *
 * 상단: 창고 선택 시 SVG 평면도(존 히트맵) 표시,
 *       존 클릭 → 아래 재고 테이블이 해당 존으로 필터링(서버 push-down).
 * 하단: 서버 사이드 페이지네이션 테이블.
 */
export function WarehouseInventoryView({
  role,
  initialWarehouseId = "",
}: {
  role: UserRole;
  /** 지리 지도 팝업 링크(?warehouse=...) 진입 시 초기 창고 필터 */
  initialWarehouseId?: string;
}) {
  const [params, setParams] = useState<WarehouseInventoryParams>(() => ({
    ...createWarehouseInventoryParams(),
    warehouseId: initialWarehouseId,
  }));
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

  const selectedWarehouse = (warehouses ?? []).find(
    (w) => w.id === params.warehouseId,
  );

  /** 창고 변경 시 존 필터도 함께 초기화 (존은 창고에 종속) */
  const setWarehouse = (warehouseId: string) =>
    setParams((prev) => ({ ...prev, warehouseId, zone: "", pageIndex: 0 }));

  const setZone = (zone: string) =>
    setParams((prev) => ({ ...prev, zone, pageIndex: 0 }));

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
        accessorKey: "zoneCode",
        header: "존",
        cell: ({ getValue }) => {
          const zone = getValue<string | null>();
          return zone ? (
            <Badge variant="outline" className="tabular-nums">{zone}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
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
    <div className="space-y-6">
      {/* ---------- 창고 평면도 (존 히트맵) ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <LandPlot className="size-4 text-muted-foreground" aria-hidden />
            창고 평면도
            {selectedWarehouse && (
              <span className="text-muted-foreground">
                — {selectedWarehouse.name}
              </span>
            )}
            {params.zone && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setZone("")}
                aria-label={`존 ${params.zone} 필터 해제`}
              >
                존 {params.zone}
                <X aria-hidden />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {params.warehouseId ? (
            <FloorPlanSection
              warehouseId={params.warehouseId}
              selectedZone={params.zone}
              onSelectZone={setZone}
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg bg-muted/40 text-sm text-muted-foreground">
              창고를 선택하면 존별 적재 현황 평면도가 표시됩니다.
              <div className="flex flex-wrap justify-center gap-2">
                {(warehouses ?? []).map((w) => (
                  <Button
                    key={w.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setWarehouse(w.id)}
                  >
                    {w.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- 재고 테이블 ---------- */}
      <section className="rounded-xl bg-card ring-1 ring-foreground/10">
        <FilterBar>
          <FilterField label="창고">
            <SelectFilter
              value={params.warehouseId}
              onChange={setWarehouse}
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
          emptyMessage={
            params.zone
              ? `존 ${params.zone}에 적재된 재고가 없습니다.`
              : "재고 데이터가 없습니다."
          }
        />
      </section>
    </div>
  );
}

/** 평면도 데이터 로딩/에러를 캡슐화한 섹션 */
function FloorPlanSection({
  warehouseId,
  selectedZone,
  onSelectZone,
}: {
  warehouseId: string;
  selectedZone: string;
  onSelectZone: (zone: string) => void;
}) {
  const { data: zones, isPending, isError, error } = useZoneInventory(warehouseId);

  if (isError) {
    return (
      <p className="flex h-40 items-center justify-center rounded-lg bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        {isSetupError(error.message) ? (
          <>
            평면도 데이터가 없습니다 —{" "}
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
              supabase/02-warehouse-map.sql
            </code>
            을 SQL Editor에서 실행해 주세요.
          </>
        ) : (
          `존 데이터 조회 실패: ${error.message}`
        )}
      </p>
    );
  }

  if (isPending) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  return (
    <FloorPlan
      zones={zones}
      selectedZone={selectedZone}
      onSelectZone={onSelectZone}
    />
  );
}
