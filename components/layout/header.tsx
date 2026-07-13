"use client";

import { CircleUser, Menu, Warehouse } from "lucide-react";
import { useState } from "react";
import { NavLinks } from "@/components/layout/nav-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SessionUser, UserRole } from "@/lib/types";

/** 권한별 뱃지 — 운영자가 자신의 권한을 항상 인지하도록 헤더에 상시 노출 */
const ROLE_BADGE: Record<UserRole, { label: string; variant: "default" | "warning" | "outline" }> = {
  ADMIN: { label: "관리자", variant: "default" },
  OPERATOR: { label: "운영자", variant: "warning" },
  VIEWER: { label: "조회 전용", variant: "outline" },
};

/**
 * 인트라넷 상단 헤더 (클라이언트 컴포넌트).
 * 모바일(<lg)에서는 햄버거 버튼으로 Sheet 내비게이션을 연다.
 * 링크 클릭 시 Sheet가 닫히도록 open 상태를 제어형으로 관리한다.
 */
export function Header({ user }: { user: SessionUser }) {
  const [navOpen, setNavOpen] = useState(false);
  const roleBadge = ROLE_BADGE[user.role];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        {/* 모바일 내비게이션 (lg 미만) */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기">
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <Warehouse className="size-5" aria-hidden />
                ERP
              </SheetTitle>
            </SheetHeader>
            <NavLinks role={user.role} onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* 모바일에서는 브랜드, 데스크톱에서는 설명 문구 */}
        <span className="text-sm font-semibold tracking-tight lg:hidden">ERP</span>
        <p className="hidden text-sm text-muted-foreground lg:block">
          창고관리 시스템 (WMS) — 입고 · 출고 · 재고 · ERP 연동
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
        <div className="flex items-center gap-2">
          <CircleUser className="size-6 text-muted-foreground" aria-hidden />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.department}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
