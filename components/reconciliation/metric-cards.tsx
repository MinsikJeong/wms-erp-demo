import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  Copy,
  FileQuestion,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskAmount } from "@/lib/rbac";
import type { ReconciliationSummary, UserRole } from "@/lib/types";
import { cn, krw, num } from "@/lib/utils";

/**
 * 대사 요약 Metric Cards (서버 컴포넌트).
 *
 * 운영자가 화면 진입 즉시 "오늘 처리해야 할 리스크 규모"를 파악하는 영역.
 * 집계는 서버(summarize)에서 끝난 값을 받아 표시만 담당한다.
 * 위험 지표(불일치/누락)는 값이 0보다 클 때만 포인트 컬러로 강조해
 * 무채색 테마 안에서 시선이 자연스럽게 위험으로 향하게 한다.
 */
export function MetricCards({
  summary,
  role,
}: {
  summary: ReconciliationSummary;
  role: UserRole;
}) {
  const metrics = [
    {
      title: "대사 대상",
      value: `${num.format(summary.totalCount)}건`,
      caption: `정상 ${num.format(summary.matchCount)}건 포함`,
      icon: BadgeCheck,
      accent: false,
      iconClass: "text-zinc-400",
    },
    {
      title: "금액 불일치",
      value: `${num.format(summary.mismatchCount)}건`,
      caption: "OMS ↔ PG 정산금액 상이",
      icon: AlertTriangle,
      accent: summary.mismatchCount > 0,
      iconClass: "text-red-500",
    },
    {
      title: "중복 정산",
      value: `${num.format(summary.duplicatedCount)}건`,
      caption: "이중 청구/결제 의심",
      icon: Copy,
      accent: summary.duplicatedCount > 0,
      iconClass: "text-amber-500",
    },
    {
      title: "레코드 누락",
      value: `${num.format(summary.missingCount)}건`,
      caption: "시스템 간 미수집 데이터",
      icon: FileQuestion,
      accent: summary.missingCount > 0,
      iconClass: "text-amber-500",
    },
    {
      title: "차액 리스크",
      // 민감 재무 금액 — VIEWER 권한은 마스킹 (AGENTS.md 2.3)
      value: maskAmount(krw.format(summary.totalDiffAmount), role),
      caption: "불일치·중복 건 차액 합계",
      icon: CircleDollarSign,
      accent: summary.totalDiffAmount > 0,
      iconClass: "text-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className={cn(metric.accent && "border-red-200 bg-red-50/40")}
        >
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{metric.title}</CardTitle>
            <metric.icon
              className={cn("h-4 w-4", metric.iconClass)}
              aria-hidden
            />
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-semibold tracking-tight tabular-nums",
                metric.accent ? "text-red-700" : "text-zinc-900",
              )}
            >
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{metric.caption}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
