import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Boxes, DatabaseZap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCards } from "@/components/wms/summary-cards";
import { getCurrentUser } from "@/lib/auth";
import { fetchWmsSummary } from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { WmsSummary } from "@/lib/wms/types";

export const metadata: Metadata = {
  title: "대시보드 | ERP",
};

const QUICK_LINKS = [
  {
    href: "/inbound/process",
    title: "입고처리 바로가기",
    description: "도착한 상품의 수량을 확정하고 재고에 반영합니다.",
    icon: ArrowDownToLine,
  },
  {
    href: "/outbound/process",
    title: "출고처리 바로가기",
    description: "피킹/패킹 완료 건을 확정하고 재고에서 차감합니다.",
    icon: ArrowUpFromLine,
  },
  {
    href: "/inventory",
    title: "재고현황 바로가기",
    description: "품목별·창고별 현재고와 재고 부족 품목을 확인합니다.",
    icon: Boxes,
  },
];

/**
 * 메인 대시보드 (서버 컴포넌트).
 * 출근 직후 확인하는 "오늘의 창고 작업 현황" 화면.
 * 집계는 wms_summary RPC가 DB에서 1회 계산한다.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  let summary: WmsSummary | null = null;
  try {
    summary = await fetchWmsSummary(getSupabaseServerClient());
  } catch {
    // 스키마 미생성 — 아래 안내 카드로 분기
  }

  const todayTotal = summary ? summary.todayInbound + summary.todayOutbound : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary ? (
            <>
              {user.name}님, 오늘 처리할 입·출고 예정이{" "}
              <span className="font-semibold text-foreground">{todayTotal}건</span> 있습니다.
            </>
          ) : (
            <>{user.name}님, 환영합니다.</>
          )}
        </p>
      </div>

      {summary ? (
        <SummaryCards summary={summary} role={user.role} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseZap className="size-5 text-amber-500" aria-hidden />
              데이터베이스 초기화가 필요합니다
            </CardTitle>
            <CardDescription>
              Supabase Dashboard → SQL Editor에서 프로젝트의{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/wms-seed.sql</code> 내용을 1회 실행하면
              WMS 데이터가 준비됩니다.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Card key={link.href} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <link.icon className="size-4 text-muted-foreground" aria-hidden />
                {link.title}
              </CardTitle>
              <CardDescription>{link.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={link.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                이동
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
