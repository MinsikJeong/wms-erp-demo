import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { OrdersTable } from "@/components/wms/orders-table";
import { getCurrentUser } from "@/lib/auth";
import { createOrdersParams, fetchOrdersPage, fetchWarehouses, wmsKeys } from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "출고예정현황 | WarehouseERP",
};

/** 3-2. 출고예정현황 — 첫 페이지 서버 프리페치 (입고예정현황과 동일 패턴) */
export default async function OutboundListPage() {
  const user = await getCurrentUser();

  const queryClient = new QueryClient();
  const supabase = getSupabaseServerClient();
  const defaultParams = createOrdersParams("OUT");

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: wmsKeys.orders(defaultParams),
      queryFn: () => fetchOrdersPage(supabase, defaultParams),
    }),
    queryClient.prefetchQuery({
      queryKey: wmsKeys.warehouses,
      queryFn: () => fetchWarehouses(supabase),
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">출고예정현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          판매채널·거래처로 출고 예정·완료된 문서를 조회합니다. 실물 피킹은 출고피킹, 처리는 출고처리 메뉴에서
          진행하세요.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OrdersTable direction="OUT" role={user.role} />
      </HydrationBoundary>
    </div>
  );
}
