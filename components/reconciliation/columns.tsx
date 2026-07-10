"use client";

import type { ColumnDef, FilterFn, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_META, StatusBadge } from "@/components/reconciliation/status-badge";
import { maskAmount } from "@/lib/rbac";
import type { ReconciliationRow, SettlementStatus, UserRole } from "@/lib/types";
import { cn, krw } from "@/lib/utils";

/**
 * TanStack Table 컬럼 정의.
 *
 * - 권한(role)은 table.options.meta로 주입받아 셀 단위 마스킹에 사용한다.
 * - 커스텀 filterFn(날짜 범위, 시스템 비교)은 여기 정의해 DataTable의
 *   filterFns 등록과 컬럼이 한 파일에서 관리되게 한다.
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

/** 시스템별 비교 관점 */
export type ComparisonScope = "OMS_WMS" | "OMS_PG";

/** 이 행이 특정 두 시스템 간 이슈와 관련 있는지 판정 (대조 수식) */
export function rowScopes(row: ReconciliationRow): ComparisonScope[] {
  const scopes: ComparisonScope[] = [];
  // 출고 검증: 주문↔출고 간 누락 또는 수량/금액 상이
  if (
    !row.oms || !row.wms ||
    row.oms.quantity !== row.wms.quantity ||
    row.oms.amount !== row.wms.amount
  ) {
    scopes.push("OMS_WMS");
  }
  // 정산 검증: 주문↔PG 정산 간 누락 또는 금액 상이
  if (!row.oms || !row.pg || row.oms.amount !== row.pg.amount) {
    scopes.push("OMS_PG");
  }
  return scopes;
}

/** 날짜 범위 filterFn — filterValue: [from, to] (YYYY-MM-DD, 빈 문자열 허용) */
const dateRangeFilter: FilterFn<ReconciliationRow> = (
  row,
  columnId,
  filterValue: [string, string],
) => {
  const value = row.getValue<string>(columnId);
  const [from, to] = filterValue;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
};

/** 시스템 비교 filterFn — 해당 관점의 이슈가 있는 행만 통과 */
const scopeFilter: FilterFn<ReconciliationRow> = (
  row,
  columnId,
  filterValue: ComparisonScope,
) => row.getValue<ComparisonScope[]>(columnId).includes(filterValue);

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
    accessorKey: "orderNo",
    header: ({ column }) => <SortableHeader label="주문번호" column={column} />,
    cell: ({ getValue }) => (
      <span className="font-medium text-foreground">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "channel",
    header: "채널",
    filterFn: "equals",
  },
  {
    accessorKey: "transactionDate",
    header: ({ column }) => <SortableHeader label="거래일자" column={column} />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue<string>()}</span>,
    filterFn: dateRangeFilter,
  },
  {
    id: "omsAmount",
    accessorFn: (row) => row.oms?.amount ?? null,
    header: () => <div className="text-right">OMS 주문금액</div>,
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
    // 누락(null)은 정렬 시 항상 뒤로 보낸다
    sortUndefined: "last",
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
    filterFn: "equals",
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
    filterFn: "equals",
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} reason={row.original.statusReason} />
    ),
  },
  {
    // 화면에 표시되지 않는 필터 전용 가상 컬럼 — 시스템 비교 관점 배열
    id: "scopes",
    accessorFn: (row) => rowScopes(row),
    filterFn: scopeFilter,
    enableHiding: true,
  },
];

/** 행 하이라이트 클래스 조회 (DataTable에서 사용) */
export function rowHighlightClass(row: Row<ReconciliationRow>): string {
  return STATUS_META[row.original.status].rowClass;
}
