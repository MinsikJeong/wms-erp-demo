"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PackageSearch,
  Scale,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 권한 기반 내비게이션 링크 목록 (데스크톱 사이드바 / 모바일 Sheet 공용).
 *
 * 메뉴는 선언적 배열 + minRole로 관리한다. 클라이언트 필터링은 UX용이며,
 * 최종 방어선은 각 페이지의 서버 사이드 권한 가드다.
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

export function NavLinks({
  role,
  onNavigate,
}: {
  role: UserRole;
  /** 모바일 Sheet에서 링크 클릭 시 시트를 닫기 위한 콜백 */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV_SECTIONS.map((section) => {
        // 권한 미달 메뉴는 렌더링 자체를 생략 (섹션 전체가 비면 제목도 숨김)
        const visibleItems = section.items.filter((item) =>
          hasRole(role, item.minRole),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title}>
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary font-medium text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4" aria-hidden />
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
  );
}
