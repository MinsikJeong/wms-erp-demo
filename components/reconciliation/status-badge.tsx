"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ReconStatus } from "@/lib/types";

/**
 * 대사 상태 → 시각 피드백 매핑 (단일 소스).
 *
 * AGENTS.md 2.1: 위험 요소(불일치/누락)는 Red/Yellow Color-Coding으로
 * 즉시 인지 가능해야 한다. 테이블 행 배경색(rowClass)과 뱃지가
 * 같은 팔레트를 쓰도록 이 파일에서 함께 관리한다.
 */
export const STATUS_META: Record<
  ReconStatus,
  {
    label: string;
    variant: "success" | "destructive" | "warning";
    icon: typeof CheckCircle2;
    /** DataTable 행 배경 하이라이트용 클래스 */
    rowClass: string;
  }
> = {
  MATCH: {
    label: "정상",
    variant: "success",
    icon: CheckCircle2,
    rowClass: "",
  },
  MISMATCH: {
    label: "불일치",
    variant: "destructive",
    icon: AlertTriangle,
    rowClass: "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/50",
  },
  DUPLICATED: {
    label: "중복",
    variant: "warning",
    icon: Copy,
    rowClass: "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
  },
  MISSING: {
    label: "누락",
    variant: "warning",
    icon: HelpCircle,
    rowClass: "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
  },
};

/**
 * 대사 상태 뱃지.
 * `reason`이 있으면 Tooltip으로 구체적 불일치 사유를 노출한다.
 * 예: "OMS 주문금액과 PG 정산금액 5,000원 불일치"
 */
export function StatusBadge({
  status,
  reason,
}: {
  status: ReconStatus;
  reason?: string | null;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  const badge = (
    <Badge variant={meta.variant} className={reason ? "cursor-help" : undefined}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  );

  if (!reason) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="left" className="max-w-72 text-pretty">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
