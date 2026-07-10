import { CircleUser } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SessionUser, UserRole } from "@/lib/types";

/** 권한별 뱃지 색 — 운영자가 자신의 권한을 항상 인지하도록 헤더에 상시 노출 */
const ROLE_BADGE: Record<UserRole, { label: string; variant: "default" | "warning" | "outline" }> = {
  ADMIN: { label: "관리자", variant: "default" },
  OPERATOR: { label: "운영자", variant: "warning" },
  VIEWER: { label: "조회 전용", variant: "outline" },
};

/**
 * 인트라넷 상단 헤더 (서버 컴포넌트).
 * 인터랙션이 없으므로 서버에서 렌더링해 번들 크기를 줄인다.
 */
export function Header({ user }: { user: SessionUser }) {
  const roleBadge = ROLE_BADGE[user.role];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <p className="text-sm text-zinc-500">
        커머스 · 물류 · 재무 통합 인트라넷
      </p>

      <div className="flex items-center gap-3">
        <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
        <div className="flex items-center gap-2">
          <CircleUser className="h-6 w-6 text-zinc-400" aria-hidden />
          <div className="leading-tight">
            <p className="text-sm font-medium text-zinc-900">{user.name}</p>
            <p className="text-xs text-zinc-500">{user.department}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
