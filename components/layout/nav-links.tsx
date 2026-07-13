"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Building2,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 권한 기반 내비게이션 (데스크톱 사이드바 / 모바일 Sheet 공용).
 *
 * WMS 메뉴 트리: 창고관리 / 입고관리(예정→현황→처리→전표) /
 * 출고관리(동일 흐름) / 재고현황 / 관리.
 * 데이터 변경 메뉴(등록·처리·전표)는 OPERATOR 이상만 노출하며,
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
    title: "홈",
    items: [
      { href: "/dashboard", label: "대시보드", icon: LayoutDashboard, minRole: "VIEWER" },
    ],
  },
  {
    title: "창고관리",
    items: [
      { href: "/warehouses", label: "창고관리", icon: Warehouse, minRole: "VIEWER" },
    ],
  },
  {
    title: "입고관리",
    items: [
      { href: "/inbound/new", label: "입고예정", icon: CalendarPlus, minRole: "OPERATOR" },
      { href: "/inbound", label: "입고예정현황", icon: ClipboardList, minRole: "VIEWER" },
      { href: "/inbound/process", label: "입고처리", icon: PackageCheck, minRole: "OPERATOR" },
      { href: "/inbound/vouchers", label: "ERP 전표생성", icon: ReceiptText, minRole: "OPERATOR" },
    ],
  },
  {
    title: "출고관리",
    items: [
      { href: "/outbound/new", label: "출고예정", icon: CalendarClock, minRole: "OPERATOR" },
      { href: "/outbound", label: "출고예정현황", icon: ClipboardList, minRole: "VIEWER" },
      { href: "/outbound/process", label: "출고처리", icon: Truck, minRole: "OPERATOR" },
      { href: "/outbound/vouchers", label: "ERP 전표생성(출고)", icon: ReceiptText, minRole: "OPERATOR" },
    ],
  },
  {
    title: "재고현황",
    items: [
      { href: "/inventory", label: "재고현황", icon: Boxes, minRole: "VIEWER" },
      { href: "/inventory/warehouse", label: "창고별재고현황", icon: Building2, minRole: "VIEWER" },
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
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
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
                // 메뉴 트리에 모든 라우트가 명시돼 있으므로 정확 일치만 활성 처리
                // (startsWith를 쓰면 /inbound가 /inbound/new에서도 활성화됨)
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
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
