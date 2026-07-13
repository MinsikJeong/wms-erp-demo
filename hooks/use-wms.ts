"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createOrder,
  createVoucher,
  fetchInventoryByItemPage,
  fetchItems,
  fetchOrderLines,
  fetchOrdersPage,
  fetchVouchersPage,
  fetchWarehouseInventoryPage,
  fetchWarehouseStockSummary,
  fetchWarehouses,
  fetchWmsSummary,
  fetchZoneInventory,
  processOrder,
  searchItems,
  wmsKeys,
  type CreateOrderInput,
  type InventoryParams,
  type OrdersParams,
  type VouchersParams,
  type WarehouseInventoryParams,
} from "@/lib/wms/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * WMS TanStack Query 훅 모음.
 *
 * - 목록 훅은 서버 사이드 페이지네이션: queryKey에 파라미터가 포함돼
 *   페이지/필터 조합별로 캐시되고, keepPreviousData로 전환 깜빡임을 없앤다.
 * - 변경 훅(useMutation)은 성공 시 관련 쿼리를 invalidate 해
 *   목록·재고·요약이 항상 최신 상태를 반영한다 (AGENTS.md 3.2).
 */

const supabase = () => getSupabaseBrowserClient();

/* ------------------------------ 조회 ------------------------------ */

export function useOrdersPage(params: OrdersParams) {
  return useQuery({
    queryKey: wmsKeys.orders(params),
    queryFn: () => fetchOrdersPage(supabase(), params),
    placeholderData: keepPreviousData,
  });
}

/** 처리 다이얼로그가 열릴 때만 라인 조회 (enabled 게이트) */
export function useOrderLines(orderId: string | null) {
  return useQuery({
    queryKey: wmsKeys.orderLines(orderId ?? ""),
    queryFn: () => fetchOrderLines(supabase(), orderId!),
    enabled: orderId !== null,
  });
}

export function useVouchersPage(params: VouchersParams) {
  return useQuery({
    queryKey: wmsKeys.vouchers(params),
    queryFn: () => fetchVouchersPage(supabase(), params),
    placeholderData: keepPreviousData,
  });
}

export function useInventoryByItemPage(params: InventoryParams) {
  return useQuery({
    queryKey: wmsKeys.inventoryByItem(params),
    queryFn: () => fetchInventoryByItemPage(supabase(), params),
    placeholderData: keepPreviousData,
  });
}

export function useWarehouseInventoryPage(params: WarehouseInventoryParams) {
  return useQuery({
    queryKey: wmsKeys.warehouseInventory(params),
    queryFn: () => fetchWarehouseInventoryPage(supabase(), params),
    placeholderData: keepPreviousData,
  });
}

/** 창고 마스터 — 필터 옵션/등록 폼 공용, 5분간 신선 취급 */
export function useWarehouses() {
  return useQuery({
    queryKey: wmsKeys.warehouses,
    queryFn: () => fetchWarehouses(supabase()),
    staleTime: 5 * 60_000,
  });
}

/** 지리 지도용: 창고별 재고 요약 (좌표 포함) */
export function useWarehouseStockSummary() {
  return useQuery({
    queryKey: wmsKeys.warehouseStockSummary,
    queryFn: () => fetchWarehouseStockSummary(supabase()),
  });
}

/** 평면도 히트맵용: 창고를 선택했을 때만 존별 집계 조회 (enabled 게이트) */
export function useZoneInventory(warehouseId: string) {
  return useQuery({
    queryKey: wmsKeys.zoneInventory(warehouseId),
    queryFn: () => fetchZoneInventory(supabase(), warehouseId),
    enabled: warehouseId !== "",
  });
}

/**
 * 품목 서버 검색 — 등록 폼 콤보박스용.
 * 콤보박스가 열려 있을 때만 조회하고(enabled 게이트), 검색어별로 캐시된다.
 * keepPreviousData로 타이핑 중 목록 깜빡임을 없앤다.
 */
export function useItemSearch(keyword: string, enabled: boolean) {
  return useQuery({
    queryKey: wmsKeys.itemSearch(keyword),
    queryFn: () => searchItems(supabase(), keyword),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** 품목 마스터 — 카테고리 필터 옵션 유도용 */
export function useItems() {
  return useQuery({
    queryKey: wmsKeys.items,
    queryFn: () => fetchItems(supabase()),
    staleTime: 5 * 60_000,
  });
}

export function useWmsSummary() {
  return useQuery({
    queryKey: wmsKeys.summary,
    queryFn: () => fetchWmsSummary(supabase()),
  });
}

/* ------------------------------ 변경 ------------------------------ */

/** 등록/처리/전표 후 영향을 받는 캐시를 일괄 무효화 */
function useInvalidateWms() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: wmsKeys.all });
}

export function useCreateOrder() {
  const invalidate = useInvalidateWms();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(supabase(), input),
    onSuccess: (orderNo) => {
      toast.success(`예정 등록 완료: ${orderNo}`);
      invalidate();
    },
    onError: (error) => toast.error(humanizeDbError(error.message)),
  });
}

export function useProcessOrder() {
  const invalidate = useInvalidateWms();
  return useMutation({
    mutationFn: (input: { orderId: string; lines: { orderItemId: string; qty: number }[] }) =>
      processOrder(supabase(), input.orderId, input.lines),
    onSuccess: (orderNo) => {
      toast.success(`처리 완료: ${orderNo} — 재고에 반영되었습니다.`);
      invalidate();
    },
    onError: (error) => toast.error(humanizeDbError(error.message)),
  });
}

export function useCreateVoucher() {
  const invalidate = useInvalidateWms();
  return useMutation({
    mutationFn: (orderId: string) => createVoucher(supabase(), orderId),
    onSuccess: (voucherNo) => {
      toast.success(`ERP 전표 생성 완료: ${voucherNo}`);
      invalidate();
    },
    onError: (error) => toast.error(humanizeDbError(error.message)),
  });
}

/** "P0001: 재고 부족: ..." 형태의 DB 예외 메시지에서 코드 접두어 제거 */
function humanizeDbError(message: string): string {
  return message.replace(/^[A-Z0-9]+:\s*/, "");
}
