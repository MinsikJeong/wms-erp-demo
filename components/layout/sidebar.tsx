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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-border/70 px-5">
        <Brand />
      </div>
      <NavLinks role={role} />
      {/* 포트폴리오 데모임을 명시 — 채용 담당자용 안내 */}
      {/* <div className="px-4 pb-4">
        <div className="flex items-center gap-2 rounded-2xl bg-accent px-3.5 py-3">
          <Sparkles className="size-4 shrink-0 text-accent-foreground" aria-hidden />
          <p className="text-[11px] leading-snug font-medium text-accent-foreground">
            포트폴리오 데모 — 로그인 계정의 권한으로 메뉴가 노출됩니다
          </p>
        </div>
      </div> */}
    </aside>
  );
}
