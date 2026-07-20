import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardClock,
  ListChecks,
  PackageX,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { WmsSummary } from "@/lib/wms/types";
import { cn, num } from "@/lib/utils";

interface Metric {
  title: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  href: string;
  /** 조치가 필요한 지표 — 0보다 클 때만 경고색으로 강조 */
  accent: boolean;
}

/**
 * 대시보드 KPI 카드 (wms_summary RPC).
 * 각 카드는 해당 업무 화면으로 이동하는 링크 — '지표 확인 → 바로 처리' 동선.
 * 위험/대기 지표는 값이 0보다 클 때만 경고색(amber)으로 강조한다.
 */
export function SummaryCards({ summary }: { summary: WmsSummary }) {
  const metrics: Metric[] = [
    {
      title: "오늘 입고예정",
      value: `${num.format(summary.todayInbound)}건`,
      caption: "금일 도착 예정",
      icon: ArrowDownToLine,
      href: "/inbound",
      accent: false,
    },
    {
      title: "오늘 출고예정",
      value: `${num.format(summary.todayOutbound)}건`,
      caption: "금일 출고 예정",
      icon: ArrowUpFromLine,
      href: "/outbound",
      accent: false,
    },
    {
      title: "미처리 입고",
      value: `${num.format(summary.pendingInbound)}건`,
      caption: "입고처리 대기",
      icon: ClipboardClock,
      href: "/inbound/process",
      accent: summary.pendingInbound > 0,
    },
    {
      title: "미처리 출고",
      value: `${num.format(summary.pendingOutbound)}건`,
      caption: "출고처리 대기(피킹 포함)",
      icon: ClipboardClock,
      href: "/outbound/process",
      accent: summary.pendingOutbound > 0,
    },
    {
      title: "피킹 진행중",
      value: `${num.format(summary.pickingCount)}건`,
      caption: "출고 피킹 작업중",
      icon: ListChecks,
      href: "/outbound/picking",
      accent: false,
    },
    {
      title: "전표 미생성",
      value: `${num.format(summary.unvoucheredCount)}건`,
      caption: "ERP 전표 발행 대기",
      icon: ReceiptText,
      href: "/inbound/vouchers",
      accent: summary.unvoucheredCount > 0,
    },
    {
      title: "재고 부족 품목",
      value: `${num.format(summary.lowStockCount)}종`,
      caption: "총재고 30개 미만",
      icon: PackageX,
      href: "/inventory",
      accent: summary.lowStockCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-7">
      {metrics.map((metric) => (
        <Link key={metric.title} href={metric.href} className="group focus-visible:outline-none">
          <Card
            size="sm"
            className={cn(
              "h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring",
              metric.accent && "bg-amber-50/60 ring-amber-200",
            )}
          >
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-muted-foreground">{metric.title}</p>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    metric.accent ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary",
                  )}
                  aria-hidden
                >
                  <metric.icon className="size-4" />
                </span>
              </div>
              <div>
                <p
                  className={cn(
                    "text-xl font-semibold tracking-tight tabular-nums md:text-2xl",
                    metric.accent ? "text-amber-700" : "text-foreground",
                  )}
                >
                  {metric.value}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{metric.caption}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
