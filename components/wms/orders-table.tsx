"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  DateRangeFilter,
  FilterBar,
  FilterField,
  SearchFilter,
  SelectFilter,
} from "@/components/wms/filters";
import { buildOrderColumns } from "@/components/wms/order-columns";
import { PagedTable } from "@/components/wms/paged-table";
import { SetupNotice } from "@/components/wms/setup-notice";
import { orderStatusLabel } from "@/components/wms/status-badge";
import { useOrdersPage, useWarehouses } from "@/hooks/use-wms";
import type { OrdersParams, OrdersSortKey } from "@/lib/wms/api";
import { createOrdersParams } from "@/lib/wms/api";
import type { Direction, WmsOrderRow, WmsOrderStatus } from "@/lib/wms/types";
import { WMS_ORDER_STATUSES } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";

/**
 * 입·출고 문서 목록 (현황/처리/전표 페이지 공용).
 *
 * - direction: IN(입고) / OUT(출고)
 * - lockedStatus: 지정 시 해당 상태만 조회하고 상태 필터를 숨긴다
 *   (입고처리 → SCHEDULED, 전표생성 → PROCESSED)
 * - action: 행별 액션 버튼 렌더러 (처리하기 / 전표생성)
 *
 * 페이지·필터·정렬 변경 시 서버(Supabase)에서 해당 페이지만 다시 가져온다.
 */
export function OrdersTable({
  direction,
  role,
  lockedStatus,
  action,
}: {
  direction: Direction;
  role: UserRole;
  lockedStatus?: WmsOrderStatus;
  action?: {
    header: string;
    cell: (row: WmsOrderRow) => React.ReactNode;
  };
}) {
  const [params, setParams] = useState<OrdersParams>(() =>
    createOrdersParams(direction, lockedStatus ? { status: lockedStatus } : {}),
  );
  const [keyword, setKeyword] = useState("");
  // 타이핑마다 서버 요청이 나가지 않도록 지연 값이 확정된 뒤에만 파라미터에 반영
  const deferredKeyword = useDeferredValue(keyword);
  useEffect(() => {
    setParams((prev) =>
      prev.keyword === deferredKeyword
        ? prev
        : { ...prev, keyword: deferredKeyword, pageIndex: 0 },
    );
  }, [deferredKeyword]);

  const query = useOrdersPage(params);
  const { data: warehouses } = useWarehouses();

  const columns = useMemo(() => buildOrderColumns({ action }), [action]);

  /** 필터류 변경 공통 처리 — 조건이 바뀌면 항상 1페이지부터 */
  const updateFilter = (patch: Partial<OrdersParams>) =>
    setParams((prev) => ({ ...prev, ...patch, pageIndex: 0 }));

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
        <FilterField label="예정일" className="col-span-2 sm:col-span-1">
          <DateRangeFilter
            from={params.dateFrom}
            to={params.dateTo}
            onChange={(dateFrom, dateTo) => updateFilter({ dateFrom, dateTo })}
          />
        </FilterField>

        {!lockedStatus && (
          <FilterField label="상태">
            <SelectFilter
              value={params.status}
              onChange={(status) =>
                updateFilter({ status: status as OrdersParams["status"] })
              }
              options={WMS_ORDER_STATUSES.map((status) => ({
                value: status,
                label: orderStatusLabel(status, direction),
              }))}
            />
          </FilterField>
        )}

        <FilterField label="창고">
          <SelectFilter
            value={params.warehouseId}
            onChange={(warehouseId) => updateFilter({ warehouseId })}
            options={(warehouses ?? []).map((w) => ({ value: w.id, label: w.name }))}
          />
        </FilterField>

        <FilterField label="문서번호/거래처 검색" className="col-span-2 sm:col-span-1">
          <SearchFilter
            value={keyword}
            onChange={setKeyword}
            placeholder={direction === "IN" ? "IB-... 또는 공급처" : "OB-... 또는 출고처"}
          />
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
          updateFilter({ sortBy: sortBy as OrdersSortKey, sortDir })
        }
        role={role}
        getRowId={(row) => row.id}
        emptyMessage={
          lockedStatus === "SCHEDULED"
            ? "처리 대기 중인 문서가 없습니다."
            : lockedStatus === "PROCESSED"
              ? "전표 생성 대상 문서가 없습니다."
              : "조건에 해당하는 문서가 없습니다."
        }
        minWidthClass="min-w-240"
      />
    </section>
  );
}
