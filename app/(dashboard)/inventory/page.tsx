import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { InventoryView } from "@/components/wms/inventory-view";
import { getCurrentUser } from "@/lib/auth";
import { createInventoryParams, fetchInventoryByItemPage, fetchItems, wmsKeys } from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "재고현황 | ERP",
};

/** 4-1. 재고현황 — 품목별 전 창고 합산 (첫 페이지 서버 프리페치) */
export default async function InventoryPage() {
  const user = await getCurrentUser();

  const queryClient = new QueryClient();
  const supabase = getSupabaseServerClient();
  const defaultParams = createInventoryParams();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: wmsKeys.inventoryByItem(defaultParams),
      queryFn: () => fetchInventoryByItemPage(supabase, defaultParams),
    }),
    queryClient.prefetchQuery({
      queryKey: wmsKeys.items,
      queryFn: () => fetchItems(supabase),
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">재고현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          품목별 전 창고 합산 재고입니다. 총재고 30개 미만 품목은 부족으로 표시됩니다.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <InventoryView role={user.role} />
      </HydrationBoundary>
    </div>
  );
}
