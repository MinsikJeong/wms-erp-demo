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
  fetchWarehouses,
  fetchWmsSummary,
  processOrder,
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

/** 품목 마스터 — 등록 폼 품목 선택용 */
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
