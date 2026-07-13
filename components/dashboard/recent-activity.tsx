import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/wms/status-badge";
import type { WmsOrderRow } from "@/lib/wms/types";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" → "M.D" */
function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}

/**
 * 최근 활동 피드 — 최근 등록된 입·출고 문서.
 * 행 전체가 해당 현황 목록으로 이동하는 링크다.
 */
export function RecentActivity({ orders }: { orders: WmsOrderRow[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>최근 활동</CardTitle>
        <CardDescription>최근 등록된 입·출고 문서</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Inbox className="size-6" aria-hidden />
            <p className="text-sm">아직 등록된 문서가 없습니다</p>
          </div>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {orders.map((order) => {
              const isInbound = order.direction === "IN";
              return (
                <li key={order.id}>
                  <Link
                    href={isInbound ? "/inbound" : "/outbound"}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        isInbound ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700",
                      )}
                      aria-hidden
                    >
                      {isInbound ? <ArrowDownToLine className="size-4" /> : <ArrowUpFromLine className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {order.orderNo}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {order.partner} · {order.warehouseName}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <OrderStatusBadge status={order.status} direction={order.direction} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {shortDate(order.expectedDate)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
