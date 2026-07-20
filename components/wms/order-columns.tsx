"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { SortableHeader } from "@/components/wms/paged-table";
import { OrderStatusBadge } from "@/components/wms/status-badge";
import type { WmsOrderRow } from "@/lib/wms/types";
import { num } from "@/lib/utils";

/**
 * 입·출고 문서 목록 컬럼 팩토리.
 * 처리/전표 페이지는 `action` 렌더러를 넘겨 행별 액션 버튼 컬럼을 추가한다.
 */
export function buildOrderColumns(options?: {
  action?: {
    header: string;
    cell: (row: WmsOrderRow) => React.ReactNode;
  };
}): ColumnDef<WmsOrderRow>[] {
  const columns: ColumnDef<WmsOrderRow>[] = [
    {
      accessorKey: "orderNo",
      // id는 lib/wms/api.ts의 OrdersSortKey와 일치해야 서버 정렬로 매핑된다
      header: ({ column }) => <SortableHeader label="문서번호" column={column} />,
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{getValue<string>()}</span>
      ),
    },
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
    { accessorKey: "partner", header: "거래처" },
    {
      accessorKey: "expectedDate",
      header: ({ column }) => <SortableHeader label="예정일" column={column} />,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue<string>()}</span>,
    },
    {
      accessorKey: "itemKinds",
      header: () => <div className="text-right">품목수</div>,
      cell: ({ getValue }) => (
        <div className="text-right tabular-nums">{num.format(getValue<number>())}</div>
      ),
    },
    {
      accessorKey: "totalExpectedQty",
      header: ({ column }) => (
        <div className="text-right">
          <SortableHeader label="예정수량" column={column} align="right" />
        </div>
      ),
      cell: ({ getValue }) => (
        <div className="text-right tabular-nums">{num.format(getValue<number>())}</div>
      ),
    },
    {
      accessorKey: "totalProcessedQty",
      header: () => <div className="text-right">처리수량</div>,
      cell: ({ row }) => {
        const { status, totalProcessedQty, totalExpectedQty, totalPickedQty } = row.original;
        if (status === "PICKING") {
          // 아직 처리(재고 반영) 전이므로 처리수량 대신 피킹 진행률을 보여준다
          return (
            <div className="text-right text-xs tabular-nums text-amber-600">
              피킹 {num.format(totalPickedQty)}/{num.format(totalExpectedQty)}
            </div>
          );
        }
        if (status === "SCHEDULED") {
          return <div className="text-right text-muted-foreground">—</div>;
        }
        const short = totalProcessedQty < totalExpectedQty;
        return (
          <div
            className={
              short
                ? "text-right font-semibold tabular-nums text-amber-600"
                : "text-right tabular-nums"
            }
            title={short ? "예정수량 대비 부족 처리(검수 차이)" : undefined}
          >
            {num.format(totalProcessedQty)}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "상태",
      cell: ({ row }) => (
        <OrderStatusBadge status={row.original.status} direction={row.original.direction} />
      ),
    },
    {
      accessorKey: "voucherNo",
      header: "전표번호",
      cell: ({ getValue }) => {
        const voucherNo = getValue<string | null>();
        return voucherNo ? (
          <span className="tabular-nums">{voucherNo}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
  ];

  if (options?.action) {
    columns.push({
      id: "action",
      header: options.action.header,
      cell: ({ row }) => options.action!.cell(row.original),
    });
  }

  return columns;
}
