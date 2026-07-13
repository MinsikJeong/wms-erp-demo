"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SessionUser } from "@/lib/types";

/** 오늘 날짜 — 서버/클라이언트가 같은 값을 렌더하도록 날짜 단위까지만 표기 */
const TODAY = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
}).format(new Date());

/**
 * 인트라넷 상단 헤더 (클라이언트 컴포넌트).
 * 모바일(<lg)에서는 햄버거 버튼으로 Sheet 내비게이션을 연다.
 * 우측에는 데모 권한 스위처 + 사용자 프로필을 상시 노출한다.
 */
export function Header({ user }: { user: SessionUser }) {
  const [navOpen, setNavOpen] = useState(false);
  // 아바타 이니셜 — 한글 이름은 마지막 글자(이름 끝 글자)가 더 자연스럽다
  const initial = user.name.trim().slice(-1) || "?";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* 모바일 내비게이션 (lg 미만) */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기">
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle>
                <Brand />
              </SheetTitle>
            </SheetHeader>
            <NavLinks role={user.role} onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* 모바일에서는 브랜드, 데스크톱에서는 오늘 날짜 */}
        <span className="text-sm font-bold tracking-tight lg:hidden">StockFlow</span>
        {/* 서버 타임존이 다르면 SSR/클라이언트 날짜가 어긋날 수 있어 경고 억제 */}
        <p suppressHydrationWarning className="hidden text-sm text-muted-foreground lg:block">
          {TODAY}
        </p>
      </div>

      <div className="flex items-center gap-2.5 md:gap-3">
        <RoleSwitcher role={user.role} />
        <Separator orientation="vertical" className="hidden h-6! sm:block" />
        <div className="flex items-center gap-2">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-indigo-700 text-xs font-semibold text-white"
            aria-hidden
          >
            {initial}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.department}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
