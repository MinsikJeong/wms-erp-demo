import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { WarehouseInventoryView } from "@/components/wms/warehouse-inventory-view";
import { getCurrentUser } from "@/lib/auth";
import { createWarehouseInventoryParams, fetchWarehouseInventoryPage, fetchWarehouses, wmsKeys } from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "창고별 재고현황 | ERP",
};

/**
 * 4-2. 창고별 재고현황 — 창고 × 품목 상세 (첫 페이지 서버 프리페치).
 * 지리 지도 마커의 "재고 보기" 링크(?warehouse=<id>)로 진입하면
 * 해당 창고가 선택된 상태로 시작한다. Next.js 16: searchParams는 Promise.
 */
export default async function WarehouseInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string }>;
}) {
  const [user, { warehouse }] = await Promise.all([getCurrentUser(), searchParams]);

  const queryClient = new QueryClient();
  const supabase = getSupabaseServerClient();
  // 클라이언트 초기 상태와 동일한 파라미터로 프리페치해야 캐시가 적중한다
  const defaultParams = {
    ...createWarehouseInventoryParams(),
    warehouseId: warehouse ?? "",
  };

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: wmsKeys.warehouseInventory(defaultParams),
      queryFn: () => fetchWarehouseInventoryPage(supabase, defaultParams),
    }),
    queryClient.prefetchQuery({
      queryKey: wmsKeys.warehouses,
      queryFn: () => fetchWarehouses(supabase),
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">창고별 재고현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          창고 × 품목 단위의 상세 재고입니다. 입·출고 처리 시 실시간으로 갱신됩니다.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <WarehouseInventoryView role={user.role} initialWarehouseId={warehouse ?? ""} />
      </HydrationBoundary>
    </div>
  );
}
