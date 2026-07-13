import { Warehouse } from "lucide-react";
import { NavLinks } from "@/components/layout/nav-links";
import type { UserRole } from "@/lib/types";

/**
 * 데스크톱 사이드바 (lg 이상에서만 표시).
 * 모바일에서는 Header의 햄버거 버튼 → Sheet(mobile-nav)로 대체된다.
 */
export function Sidebar({ role }: { role: UserRole }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <Warehouse className="size-5" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">ERP</span>
      </div>
      <NavLinks role={role} />
    </aside>
  );
}
