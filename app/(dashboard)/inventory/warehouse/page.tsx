import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { WarehouseInventoryView } from "@/components/wms/warehouse-inventory-view";
import { getCurrentUser } from "@/lib/auth";
import {
  createWarehouseInventoryParams,
  fetchWarehouseInventoryPage,
  fetchWarehouses,
  wmsKeys,
} from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "창고별 재고현황 | NewSelect WMS",
};

/** 4-2. 창고별 재고현황 — 창고 × 품목 상세 (첫 페이지 서버 프리페치) */
export default async function WarehouseInventoryPage() {
  const user = await getCurrentUser();

  const queryClient = new QueryClient();
  const supabase = getSupabaseServerClient();
  const defaultParams = createWarehouseInventoryParams();

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
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          창고별 재고현황
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          창고 × 품목 단위의 상세 재고입니다. 입·출고 처리 시 실시간으로
          갱신됩니다.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <WarehouseInventoryView role={user.role} />
      </HydrationBoundary>
    </div>
  );
}
