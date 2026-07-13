import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryComposition } from "@/components/dashboard/category-composition";
import { HeroFlowChart } from "@/components/dashboard/hero-flow-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { WarehouseValueBars } from "@/components/dashboard/warehouse-value-bars";
import { SummaryCards } from "@/components/wms/summary-cards";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";
import {
  fetchCategoryShares,
  fetchDailyFlows,
  fetchRecentOrders,
  fetchWarehouseStockSummary,
  fetchWmsSummary,
} from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CategoryShare,
  DailyFlow,
  WarehouseStockSummary,
  WmsOrderRow,
  WmsSummary,
} from "@/lib/wms/types";

export const metadata: Metadata = {
  title: "대시보드 | StockFlow",
};

interface DashboardData {
  summary: WmsSummary;
  flows: DailyFlow[];
  categories: CategoryShare[];
  warehouses: WarehouseStockSummary[];
  recent: WmsOrderRow[];
}

/**
 * 메인 대시보드 (서버 컴포넌트).
 * 출근 직후 확인하는 "오늘의 창고 작업 현황" 화면.
 * 집계 쿼리 5종을 병렬로 실행하고, 차트는 데이터만 props로 받는
 * 클라이언트 컴포넌트에 위임한다. 스키마 미생성 시 세팅 안내로 분기.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  const client = getSupabaseServerClient();

  let data: DashboardData | null = null;
  try {
    const [summary, flows, categories, warehouses, recent] = await Promise.all([
      fetchWmsSummary(client),
      // 60일치 = 히어로 차트 최대 기간(30일) + 직전 기간 비교분.
      // 기간 전환은 클라이언트에서 슬라이스만 하므로 재요청이 없다.
      fetchDailyFlows(client, 60),
      fetchCategoryShares(client),
      fetchWarehouseStockSummary(client),
      fetchRecentOrders(client),
    ]);
    data = { summary, flows, categories, warehouses, recent };
  } catch {
    // 스키마 미생성 — 아래 안내 카드로 분기
  }

  const todayTotal = data ? data.summary.todayInbound + data.summary.todayOutbound : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? (
              <>
                {user.name}님, 오늘 처리할 입·출고 예정이{" "}
                <span className="font-semibold text-foreground">{todayTotal}건</span> 있습니다.
              </>
            ) : (
              <>{user.name}님, 환영합니다.</>
            )}
          </p>
        </div>

        {/* 빠른 처리 동선 — 데이터 변경 권한(OPERATOR 이상)에서만 노출 */}
        {canMutate(user.role) && (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/inbound/process">
                <ArrowDownToLine aria-hidden />
                입고처리
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/outbound/process">
                <ArrowUpFromLine aria-hidden />
                출고처리
              </Link>
            </Button>
          </div>
        )}
      </div>

      {data ? (
        <>
          {/* 히어로 차트 — 기간 전환·계열 토글 인터랙션 포함 */}
          <HeroFlowChart data={data.flows} />

          <SummaryCards summary={data.summary} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <WarehouseValueBars data={data.warehouses} role={user.role} />
            <CategoryComposition data={data.categories} role={user.role} />
            <RecentActivity orders={data.recent} />
          </div>
        </>
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
    </div>
  );
}
