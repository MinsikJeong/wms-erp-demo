import { Badge } from "@/components/ui/badge";
import type { Direction, WmsOrderStatus } from "@/lib/wms/types";

/**
 * 입·출고 문서 상태 뱃지 (단일 소스).
 * 진행 단계가 시각적으로 구분되도록: 예정(outline) → 피킹중(warning) → 완료(success) → 전표(default).
 */
const STATUS_VARIANT: Record<WmsOrderStatus, "outline" | "warning" | "success" | "default"> = {
  SCHEDULED: "outline",
  PICKING: "warning",
  PROCESSED: "success",
  VOUCHERED: "default",
};

/** 방향에 따라 라벨이 달라진다 (입고예정/출고예정 등). PICKING은 출고 전용이라 접두어가 없다 */
export function orderStatusLabel(status: WmsOrderStatus, direction: Direction): string {
  const prefix = direction === "IN" ? "입고" : "출고";
  switch (status) {
    case "SCHEDULED":
      return `${prefix}예정`;
    case "PICKING":
      return "피킹중";
    case "PROCESSED":
      return `${prefix}완료`;
    case "VOUCHERED":
      return "전표완료";
  }
}

export function OrderStatusBadge({
  status,
  direction,
}: {
  status: WmsOrderStatus;
  direction: Direction;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {orderStatusLabel(status, direction)}
    </Badge>
  );
}
