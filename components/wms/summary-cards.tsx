import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  ClipboardClock,
  PackageX,
  ReceiptText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskAmount } from "@/lib/rbac";
import type { WmsSummary } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { cn, krw, num } from "@/lib/utils";

/**
 * 대시보드 요약 카드 (wms_summary RPC).
 * 위험/대기 지표는 값이 0보다 클 때만 포인트 컬러로 강조한다.
 * 반응형: 모바일 2열 → 태블릿 3열 → 데스크톱 6열.
 */
export function SummaryCards({
  summary,
  role,
}: {
  summary: WmsSummary;
  role: UserRole;
}) {
  const metrics = [
    {
      title: "오늘 입고예정",
      value: `${num.format(summary.todayInbound)}건`,
      caption: "금일 도착 예정 문서",
      icon: ArrowDownToLine,
      accent: false,
    },
    {
      title: "오늘 출고예정",
      value: `${num.format(summary.todayOutbound)}건`,
      caption: "금일 출고 예정 문서",
      icon: ArrowUpFromLine,
      accent: false,
    },
    {
      title: "미처리 입고",
      value: `${num.format(summary.pendingInbound)}건`,
      caption: "입고처리 대기",
      icon: ClipboardClock,
      accent: summary.pendingInbound > 0,
    },
    {
      title: "미처리 출고",
      value: `${num.format(summary.pendingOutbound)}건`,
      caption: "출고처리 대기",
      icon: ClipboardClock,
      accent: summary.pendingOutbound > 0,
    },
    {
      title: "전표 미생성",
      value: `${num.format(summary.unvoucheredCount)}건`,
      caption: "ERP 전표 발행 대기",
      icon: ReceiptText,
      accent: summary.unvoucheredCount > 0,
    },
    {
      title: "재고 부족 품목",
      value: `${num.format(summary.lowStockCount)}종`,
      caption: "총재고 30개 미만",
      icon: PackageX,
      accent: summary.lowStockCount > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        {metrics.map((metric) => (
          <Card
            key={metric.title}
            size="sm"
            className={cn(
              metric.accent && "bg-amber-50/50 ring-amber-200",
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                {metric.title}
                <metric.icon
                  className={cn("size-4", metric.accent ? "text-amber-500" : "text-muted-foreground")}
                  aria-hidden
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-xl font-semibold tracking-tight tabular-nums md:text-2xl",
                  metric.accent ? "text-amber-700" : "text-foreground",
                )}
              >
                {metric.value}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{metric.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 총 재고자산 — 민감 재무 금액이라 VIEWER 마스킹 */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            총 재고자산 (전 창고)
            <CircleDollarSign className="size-4 text-muted-foreground" aria-hidden />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {maskAmount(krw.format(summary.totalInventoryValue), role)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            현재고 × 품목 단가 합계 기준
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
