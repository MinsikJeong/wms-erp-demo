import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { OrdersTable } from "@/components/wms/orders-table";
import { getCurrentUser } from "@/lib/auth";
import { createOrdersParams, fetchOrdersPage, fetchWarehouses, wmsKeys } from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "입고예정현황 | ERP",
};

/**
 * 2-2. 입고예정현황 (서버 컴포넌트).
 * 첫 페이지(기본 파라미터)와 창고 목록을 서버에서 프리페치해
 * 초기 화면을 재요청 없이 그린다. 이후 페이지/필터 변경은 클라이언트가
 * 해당 조합만 서버에 요청한다.
 */
export default async function InboundListPage() {
  const user = await getCurrentUser();

  const queryClient = new QueryClient();
  const supabase = getSupabaseServerClient();
  const defaultParams = createOrdersParams("IN");

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
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">입고예정현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          공급처로부터 입고 예정·완료된 문서를 조회합니다. 실물 처리는 입고처리 메뉴에서 진행하세요.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OrdersTable direction="IN" role={user.role} />
      </HydrationBoundary>
    </div>
  );
}
