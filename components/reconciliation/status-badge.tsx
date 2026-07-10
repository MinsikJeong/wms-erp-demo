import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    rowClass: "bg-red-50 hover:bg-red-100/70",
  },
  DUPLICATED: {
    label: "중복",
    variant: "warning",
    icon: Copy,
    rowClass: "bg-amber-50 hover:bg-amber-100/70",
  },
  MISSING: {
    label: "누락",
    variant: "warning",
    icon: HelpCircle,
    rowClass: "bg-amber-50 hover:bg-amber-100/70",
  },
};

/**
 * 대사 상태 뱃지.
 * `reason`이 있으면 네이티브 툴팁(title)으로 구체적 사유를 노출한다.
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

  return (
    <Badge
      variant={meta.variant}
      title={reason ?? undefined}
      className={reason ? "cursor-help" : undefined}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}
