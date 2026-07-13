"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileCheck2, Loader2, ReceiptText } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/wms/export-button";
import { OrdersTable } from "@/components/wms/orders-table";
import { PagedTable } from "@/components/wms/paged-table";
import { FilterBar, FilterField, SearchFilter } from "@/components/wms/filters";
import { useCreateVoucher, useVouchersPage } from "@/hooks/use-wms";
import { exportFiltered, type ExportColumn } from "@/lib/export";
import { canViewAmounts, maskAmount } from "@/lib/rbac";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createVouchersParams, fetchVouchersPage, type VouchersParams } from "@/lib/wms/api";
import type { Direction, VoucherRow } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { krw, num } from "@/lib/utils";

/**
 * ERP 전표생성 화면 (입고=매입전표 / 출고=매출전표).
 *
 * 상단: 전표 생성 대상(처리완료·전표 미발행) 문서 목록 + 행별 생성 버튼
 * 하단: 발행된 전표 목록 (서버 페이지네이션 + 검색)
 * 전표 금액은 민감 재무 정보 → VIEWER 마스킹.
 */
export function VoucherView({
  direction,
  role,
}: {
  direction: Direction;
  role: UserRole;
}) {
  const createMutation = useCreateVoucher();
  // 어떤 행의 버튼이 눌렸는지 추적해 해당 버튼만 스피너 표시
  const [creatingId, setCreatingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileCheck2 className="size-4 text-muted-foreground" aria-hidden />
          전표 생성 대상 ({direction === "IN" ? "입고" : "출고"} 처리 완료 문서)
        </h2>
        <OrdersTable
          direction={direction}
          role={role}
          lockedStatus="PROCESSED"
          action={{
            header: "전표",
            cell: (row) => (
              <Button
                size="sm"
                disabled={createMutation.isPending}
                onClick={() => {
                  setCreatingId(row.id);
                  createMutation.mutate(row.id, {
                    onSettled: () => setCreatingId(null),
                  });
                }}
              >
                {creatingId === row.id ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <ReceiptText aria-hidden />
                )}
                전표생성
              </Button>
            ),
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ReceiptText className="size-4 text-muted-foreground" aria-hidden />
          발행된 전표
        </h2>
        <VoucherList direction={direction} role={role} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 발행 전표 목록                                                       */
/* ------------------------------------------------------------------ */

function buildVoucherColumns(role: UserRole): ColumnDef<VoucherRow>[] {
  return [
    {
      accessorKey: "voucherNo",
      header: "전표번호",
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{getValue<string>()}</span>
      ),
    },
    { accessorKey: "orderNo", header: "원문서번호" },
    { accessorKey: "partner", header: "거래처" },
    { accessorKey: "warehouseName", header: "창고" },
    {
      accessorKey: "lineCount",
      header: () => <div className="text-right">품목수</div>,
      cell: ({ getValue }) => (
        <div className="text-right tabular-nums">{num.format(getValue<number>())}</div>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: () => <div className="text-right">전표금액</div>,
      cell: ({ getValue }) => (
        <div className="text-right font-medium tabular-nums">
          {maskAmount(krw.format(getValue<number>()), role)}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "발행일시",
      cell: ({ getValue }) => (
        <span className="tabular-nums">
          {new Date(getValue<string>()).toLocaleString("ko-KR")}
        </span>
      ),
    },
  ];
}

function VoucherList({ direction, role }: { direction: Direction; role: UserRole }) {
  const [params, setParams] = useState<VouchersParams>(() =>
    createVouchersParams(direction),
  );
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

  const query = useVouchersPage(queryParams);
  const columns = useMemo(() => buildVoucherColumns(role), [role]);

  /** 엑셀 내보내기 — 전표금액은 화면과 동일하게 VIEWER 마스킹 적용 */
  const handleExport = () => {
    const showAmounts = canViewAmounts(role);
    const exportColumns: ExportColumn<VoucherRow>[] = [
      { header: "전표번호", value: (r) => r.voucherNo },
      { header: "구분", value: (r) => (r.direction === "IN" ? "매입(입고)" : "매출(출고)") },
      { header: "원문서번호", value: (r) => r.orderNo },
      { header: "거래처", value: (r) => r.partner },
      { header: "창고", value: (r) => r.warehouseName },
      { header: "품목수", value: (r) => r.lineCount },
      { header: "전표금액", value: (r) => (showAmounts ? r.totalAmount : "₩ ***,***") },
      { header: "발행일시", value: (r) => new Date(r.createdAt).toLocaleString("ko-KR") },
    ];
    return exportFiltered(
      (pageIndex, pageSize) =>
        fetchVouchersPage(getSupabaseBrowserClient(), { ...queryParams, pageIndex, pageSize }),
      exportColumns,
      direction === "IN" ? "매입전표목록" : "매출전표목록",
    );
  };

  if (query.isError) {
    return (
      <p className="rounded-xl bg-card p-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
        전표 목록 조회 실패: {query.error.message}
      </p>
    );
  }

  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      <FilterBar>
        <FilterField label="전표/문서번호/거래처 검색" className="col-span-2 sm:col-span-1">
          <SearchFilter value={keyword} onChange={handleKeywordChange} placeholder="VCI-... / IB-..." />
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
        role={role}
        getRowId={(row) => row.id}
        emptyMessage="발행된 전표가 없습니다."
        pageSizeOptions={[5, 10, 20]}
      />
    </section>
  );
}
