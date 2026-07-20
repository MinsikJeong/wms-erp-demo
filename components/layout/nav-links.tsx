"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import {
  Boxes,
  Building2,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Loader2,
  PackageCheck,
  ReceiptText,
  Sparkles,
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
 * 출고관리(예정→현황→피킹→처리→전표, 피킹 단계만 출고 전용) / 재고현황 / 관리.
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
    title: "AI",
    items: [
      // 조회는 VIEWER도 가능 — 변경 실행은 서버 액션이 OPERATOR 이상을 강제
      { href: "/assistant", label: "AI 어시스턴트", icon: Sparkles, minRole: "VIEWER" },
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
      { href: "/outbound/picking", label: "출고피킹", icon: ListChecks, minRole: "OPERATOR" },
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
  const router = useRouter();
  // 낙관적 활성 경로 — 클릭 즉시 하이라이트를 옮기고, 내비게이션 트랜지션이
  // 끝나면(실제 pathname 반영) 자동으로 실제 값으로 되돌아간다.
  const [optimisticPath, setOptimisticPath] = useOptimistic(pathname);
  const [isPending, startTransition] = useTransition();

  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // 새 탭/수정키 클릭은 브라우저 기본 동작 유지
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate?.();
    if (href === pathname) return;
    startTransition(() => {
      setOptimisticPath(href);
      router.push(href);
    });
  };

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
                // (startsWith를 쓰면 /inbound가 /inbound/new에서도 활성화됨).
                // 낙관적 경로 기준이라 클릭 즉시 하이라이트가 이동한다.
                const active = optimisticPath === item.href;
                const showSpinner = isPending && active;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={(e) => handleNavigate(e, item.href)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {/* 활성 메뉴 좌측 인디케이터 바 */}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                        />
                      )}
                      <item.icon
                        className={cn("size-4", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")}
                        aria-hidden
                      />
                      {item.label}
                      {/* 전환 중 표시 — 낙관적으로 이동한 항목에만 */}
                      {showSpinner && (
                        <Loader2 className="ml-auto size-3.5 animate-spin text-primary/70" aria-hidden />
                      )}
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
