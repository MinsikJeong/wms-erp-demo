"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_META, StatusBadge } from "@/components/reconciliation/status-badge";
import { maskAmount } from "@/lib/rbac";
import type { ReconciliationRow, SettlementStatus, UserRole } from "@/lib/types";
import { cn, krw } from "@/lib/utils";

/**
 * TanStack Table 컬럼 정의 (서버 사이드 페이지네이션 모드).
 *
 * - 필터링/정렬/페이지네이션은 모두 서버(Supabase)로 push-down 되므로
 *   여기에는 표현(셀 렌더링)과 정렬 토글 UI만 남긴다.
 * - 권한(role)은 table.options.meta로 주입받아 셀 단위 마스킹에 사용한다.
 */

/** table.options.meta 타입 확장 — 컬럼 셀에서 권한 정보에 접근 */
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    role: UserRole;
  }
}

export const SETTLEMENT_LABELS: Record<SettlementStatus, string> = {
  PENDING: "정산예정",
  CONFIRMED: "정산확정",
  PAID: "지급완료",
  HOLD: "보류",
};

/** 정렬 토글 헤더 버튼 — 현재 정렬 방향을 아이콘으로 표시 */
function SortableHeader({
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
      className={cn("-mx-2 h-7 gap-1 px-2 text-xs font-semibold", align === "right" && "-mr-2 ml-auto flex")}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      <Icon className="size-3 text-muted-foreground" aria-hidden />
    </Button>
  );
}

/** 금액 셀 — 누락(null)은 경고 텍스트, 정상 값은 권한 마스킹 후 우측 정렬 */
function AmountCell({
  amount,
  role,
}: {
  amount: number | null | undefined;
  role: UserRole;
}) {
  if (amount == null) {
    return <span className="text-xs font-medium text-red-600 dark:text-red-400">누락</span>;
  }
  return <span className="tabular-nums">{maskAmount(krw.format(amount), role)}</span>;
}

export const reconColumns: ColumnDef<ReconciliationRow>[] = [
  {
    // id는 lib/recon.ts의 ReconSortKey와 일치해야 서버 정렬로 매핑된다
    accessorKey: "orderNo",
    header: ({ column }) => <SortableHeader label="주문번호" column={column} />,
    cell: ({ getValue }) => (
      <span className="font-medium text-foreground">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "channel",
    header: "채널",
    enableSorting: false,
  },
  {
    accessorKey: "transactionDate",
    header: ({ column }) => <SortableHeader label="거래일자" column={column} />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue<string>()}</span>,
  },
  {
    id: "omsAmount",
    accessorFn: (row) => row.oms?.amount ?? null,
    header: () => <div className="text-right">OMS 주문금액</div>,
    enableSorting: false,
    cell: ({ getValue, table }) => (
      <div className="text-right">
        <AmountCell amount={getValue<number | null>()} role={table.options.meta!.role} />
      </div>
    ),
  },
  {
    id: "wmsAmount",
    accessorFn: (row) => row.wms?.amount ?? null,
    header: () => <div className="text-right">WMS 출고금액</div>,
    enableSorting: false,
    cell: ({ getValue, table }) => (
      <div className="text-right">
        <AmountCell amount={getValue<number | null>()} role={table.options.meta!.role} />
      </div>
    ),
  },
  {
    id: "pgAmount",
    accessorFn: (row) => row.pg?.amount ?? null,
    header: () => <div className="text-right">PG 정산금액</div>,
    enableSorting: false,
    cell: ({ getValue, table }) => (
      <div className="text-right">
        <AmountCell amount={getValue<number | null>()} role={table.options.meta!.role} />
      </div>
    ),
  },
  {
    accessorKey: "amountDiff",
    header: ({ column }) => (
      <div className="text-right">
        <SortableHeader label="차액" column={column} align="right" />
      </div>
    ),
    cell: ({ getValue, table }) => {
      const diff = getValue<number | null>();
      const hasDiff = diff != null && diff !== 0;
      return (
        <div
          className={cn(
            "text-right tabular-nums",
            hasDiff && "font-semibold text-red-600 dark:text-red-400",
          )}
        >
          {diff == null ? "—" : maskAmount(krw.format(diff), table.options.meta!.role)}
        </div>
      );
    },
  },
  {
    accessorKey: "settlementStatus",
    header: "정산상태",
    enableSorting: false,
    cell: ({ getValue }) => {
      const value = getValue<SettlementStatus>();
      return (
        <Badge variant={value === "HOLD" ? "warning" : "outline"}>
          {SETTLEMENT_LABELS[value]}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "대사결과",
    enableSorting: false,
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} reason={row.original.statusReason} />
    ),
  },
];

/** 행 하이라이트 클래스 조회 (DataTable에서 사용) */
export function rowHighlightClass(row: Row<ReconciliationRow>): string {
  return STATUS_META[row.original.status].rowClass;
}
