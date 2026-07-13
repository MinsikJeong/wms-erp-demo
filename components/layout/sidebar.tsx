import { Sparkles } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import type { UserRole } from "@/lib/types";

/**
 * 데스크톱 사이드바 (lg 이상에서만 표시).
 * 모바일에서는 Header의 햄버거 버튼 → Sheet(mobile-nav)로 대체된다.
 */
export function Sidebar({ role }: { role: UserRole }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <Brand />
      </div>
      <NavLinks role={role} />
      {/* 포트폴리오 데모임을 명시 — 채용 담당자용 안내 */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg bg-accent/60 px-3 py-2">
          <Sparkles className="size-3.5 shrink-0 text-accent-foreground" aria-hidden />
          <p className="text-[11px] leading-snug text-accent-foreground">
            포트폴리오 데모 — 우측 상단에서 권한을 바꿔보세요
          </p>
        </div>
      </div>
    </aside>
  );
}
