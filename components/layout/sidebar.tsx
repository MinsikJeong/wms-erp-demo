"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Scale,
  PackageSearch,
  Wallet,
  Users,
  type LucideIcon,
} from "lucide-react";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 사이드바 내비게이션 (클라이언트 컴포넌트).
 *
 * - `usePathname()` 기반 활성 메뉴 하이라이트 때문에 클라이언트로 분리.
 * - 메뉴 정의는 선언적 배열 + `minRole`로 관리 → 메뉴 추가 시 이 배열만 수정.
 * - 권한 분기는 서버 레이아웃이 내려준 `role`(세션 기반)으로 판정하므로
 *   클라이언트에서 조작해도 서버 가드(페이지별 hasRole 검사)가 최종 방어선이다.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 이 메뉴를 볼 수 있는 최소 권한 */
  minRole: UserRole;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "재무",
    items: [
      { href: "/dashboard", label: "대시보드", icon: LayoutDashboard, minRole: "VIEWER" },
      { href: "/reconciliation", label: "정산 대사", icon: Scale, minRole: "VIEWER" },
      { href: "/settlements", label: "매출/정산 조회", icon: Wallet, minRole: "OPERATOR" },
    ],
  },
  {
    title: "물류",
    items: [
      { href: "/orders", label: "주문/출고 조회", icon: PackageSearch, minRole: "VIEWER" },
    ],
  },
  {
    title: "관리",
    items: [
      { href: "/management/users", label: "사용자/권한 관리", icon: Users, minRole: "ADMIN" },
    ],
  },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      {/* 브랜드 영역 */}
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-5">
        <Scale className="h-5 w-5 text-zinc-900" aria-hidden />
        <span className="text-sm font-semibold tracking-tight text-zinc-900">
          NewSelect FIS
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => {
          // 권한 미달 메뉴는 렌더링 자체를 생략 (섹션 전체가 비면 제목도 숨김)
          const visibleItems = section.items.filter((item) =>
            hasRole(role, item.minRole),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                          active
                            ? "bg-zinc-900 font-medium text-zinc-50"
                            : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900",
                        )}
                      >
                        <item.icon className="h-4 w-4" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
