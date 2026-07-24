"use client";

import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SessionUser, UserRole } from "@/lib/types";

/** 권한 → 한국어 라벨 (헤더 역할 뱃지용) */
const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "관리자",
  OPERATOR: "운영자",
  VIEWER: "조회 전용",
};

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
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-4 backdrop-blur-md md:px-6">
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
        {/* 현재 로그인 계정의 권한 — 회원가입 시 선택한 값이 고정 표시된다 */}
        <Badge variant="default" className="hidden sm:inline-flex">
          {ROLE_LABEL[user.role]}
        </Badge>
        <Separator orientation="vertical" className="hidden h-6! sm:block" />
        <div className="flex items-center gap-2">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-[0_2px_8px_-2px] shadow-primary/40"
            aria-hidden
          >
            {initial}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.department}</p>
          </div>
        </div>
        {/* 로그아웃 — 서버 액션이 세션을 파기하고 /login으로 보낸다 */}
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="로그아웃"
            title="로그아웃"
          >
            <LogOut aria-hidden />
          </Button>
        </form>
      </div>
    </header>
  );
}
