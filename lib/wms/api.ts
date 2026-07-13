import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Direction,
  InventoryByItemRow,
  Item,
  VoucherRow,
  Warehouse,
  WarehouseInventoryRow,
  WarehouseStockSummary,
  WmsOrderLine,
  WmsOrderRow,
  WmsOrderStatus,
  WmsSummary,
  ZoneStock,
} from "@/lib/wms/types";

/**
 * WMS 데이터 액세스 레이어 (서버 사이드 페이지네이션).
 *
 * - 목록 조회는 항상 "현재 페이지 + 현재 필터"만 가져온다 (.range + 필터 push-down).
 * - 변경(등록/처리/전표)은 security definer RPC만 호출한다 — 테이블 직접 쓰기는
 *   RLS가 차단하므로 재고 정합성이 DB에서 보장된다.
 * - Supabase(snake_case) ↔ 도메인 타입(camelCase) 변환을 이 파일에 격리한다.
 * - queryKey 팩토리를 함께 정의해 서버 프리페치와 클라이언트 useQuery가
 *   동일한 캐시 계약을 공유한다.
 */

/* ------------------------------------------------------------------ */
/* 공통 페이지 파라미터                                                 */
/* ------------------------------------------------------------------ */

export interface PageResult<T> {
  rows: T[];
  /** 필터 적용 후 전체 건수 (count=exact) */
  total: number;
}

/** ilike 패턴 이스케이프 — 사용자 입력의 %/_가 와일드카드로 동작하지 않게 한다 */
function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function throwQueryError(error: { code?: string | null; message: string }): never {
  // PGRST205/42P01=테이블·뷰 없음, PGRST202=함수 없음 → 화면에서 세팅 안내로 분기
  throw new Error(`${error.code ?? "UNKNOWN"}: ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* Query Key 팩토리                                                     */
/* ------------------------------------------------------------------ */

export const wmsKeys = {
  all: ["wms"] as const,
  orders: (params: OrdersParams) => ["wms", "orders", params] as const,
  orderLines: (orderId: string) => ["wms", "order-lines", orderId] as const,
  vouchers: (params: VouchersParams) => ["wms", "vouchers", params] as const,
  inventoryByItem: (params: InventoryParams) => ["wms", "inventory-item", params] as const,
  warehouseInventory: (params: WarehouseInventoryParams) =>
    ["wms", "inventory-warehouse", params] as const,
  warehouses: ["wms", "warehouses"] as const,
  warehouseStockSummary: ["wms", "warehouse-stock-summary"] as const,
  zoneInventory: (warehouseId: string) => ["wms", "zone-inventory", warehouseId] as const,
  items: ["wms", "items"] as const,
  summary: ["wms", "summary"] as const,
};

/* ------------------------------------------------------------------ */
/* 마스터: 창고 / 품목 (소량 — 페이지네이션 없이 전체)                    */
/* ------------------------------------------------------------------ */

export async function fetchWarehouses(client: SupabaseClient): Promise<Warehouse[]> {
  const { data, error } = await client
    .from("warehouses")
    // lat/lng는 02-warehouse-map.sql 이후에만 존재 — 컬럼 명시 대신 * 로
    // 조회해 마이그레이션 전에도 창고 필터가 동작하게 한다
    .select("*")
    .order("code");
  if (error) throwQueryError(error);
  return data.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    location: w.location,
    isActive: w.is_active,
    lat: w.lat ?? null,
    lng: w.lng ?? null,
  }));
}

/** 지리 지도용: 창고별 재고 요약 (좌표 포함) */
export async function fetchWarehouseStockSummary(
  client: SupabaseClient,
): Promise<WarehouseStockSummary[]> {
  const { data, error } = await client
    .from("v_warehouse_stock_summary")
    .select("*")
    .order("code");
  if (error) throwQueryError(error);
  return data.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    location: w.location,
    isActive: w.is_active,
    lat: w.lat ?? null,
    lng: w.lng ?? null,
    itemKinds: w.item_kinds,
    totalQty: w.total_qty,
    totalValue: w.total_value,
  }));
}

/** 평면도 히트맵용: 특정 창고의 존별 재고 집계 */
export async function fetchZoneInventory(
  client: SupabaseClient,
  warehouseId: string,
): Promise<ZoneStock[]> {
  const { data, error } = await client
    .from("v_zone_inventory")
    .select("*")
    .eq("warehouse_id", warehouseId)
    .order("zone_code");
  if (error) throwQueryError(error);
  return data.map((z) => ({
    warehouseId: z.warehouse_id,
    zoneCode: z.zone_code,
    itemKinds: z.item_kinds,
    totalQty: z.total_qty,
    totalValue: z.total_value,
  }));
}

export async function fetchItems(client: SupabaseClient): Promise<Item[]> {
  const { data, error } = await client
    .from("items")
    .select("id, sku, name, category, unit, unit_price")
    .order("sku");
  if (error) throwQueryError(error);
  return data.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    category: i.category,
    unit: i.unit,
    unitPrice: i.unit_price,
  }));
}

/* ------------------------------------------------------------------ */
/* 입·출고 문서 목록 (v_wms_orders)                                     */
/* ------------------------------------------------------------------ */

export type OrdersSortKey = "orderNo" | "expectedDate" | "totalExpectedQty";

export interface OrdersParams {
  direction: Direction;
  pageIndex: number;
  pageSize: number;
  sortBy: OrdersSortKey;
  sortDir: "asc" | "desc";
  /** 빈 문자열 = 필터 미적용 (queryKey 형태 고정을 위해 undefined 대신 사용) */
  status: WmsOrderStatus | "";
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  keyword: string;
}

export function createOrdersParams(
  direction: Direction,
  overrides: Partial<OrdersParams> = {},
): OrdersParams {
  return {
    direction,
    pageIndex: 0,
    pageSize: 10,
    sortBy: "expectedDate",
    sortDir: "desc",
    status: "",
    warehouseId: "",
    dateFrom: "",
    dateTo: "",
    keyword: "",
    ...overrides,
  };
}

const ORDERS_SORT_COLUMNS: Record<OrdersSortKey, string> = {
  orderNo: "order_no",
  expectedDate: "expected_date",
  totalExpectedQty: "total_expected_qty",
};

interface WmsOrderDbRow {
  id: string;
  order_no: string;
  direction: Direction;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  partner: string;
  expected_date: string;
  status: WmsOrderStatus;
  memo: string | null;
  processed_at: string | null;
  created_at: string;
  item_kinds: number;
  total_expected_qty: number;
  total_processed_qty: number;
  voucher_no: string | null;
}

function toOrderRow(db: WmsOrderDbRow): WmsOrderRow {
  return {
    id: db.id,
    orderNo: db.order_no,
    direction: db.direction,
    warehouseId: db.warehouse_id,
    warehouseCode: db.warehouse_code,
    warehouseName: db.warehouse_name,
    partner: db.partner,
    expectedDate: db.expected_date,
    status: db.status,
    memo: db.memo,
    processedAt: db.processed_at,
    createdAt: db.created_at,
    itemKinds: db.item_kinds,
    totalExpectedQty: db.total_expected_qty,
    totalProcessedQty: db.total_processed_qty,
    voucherNo: db.voucher_no,
  };
}

export async function fetchOrdersPage(
  client: SupabaseClient,
  params: OrdersParams,
): Promise<PageResult<WmsOrderRow>> {
  let q = client
    .from("v_wms_orders")
    .select("*", { count: "exact" })
    .eq("direction", params.direction);

  if (params.status) q = q.eq("status", params.status);
  if (params.warehouseId) q = q.eq("warehouse_id", params.warehouseId);
  if (params.dateFrom) q = q.gte("expected_date", params.dateFrom);
  if (params.dateTo) q = q.lte("expected_date", params.dateTo);
  if (params.keyword.trim()) {
    const kw = `%${escapeLike(params.keyword.trim())}%`;
    // 문서번호 또는 거래처로 검색
    q = q.or(`order_no.ilike.${kw},partner.ilike.${kw}`);
  }

  const sortColumn = ORDERS_SORT_COLUMNS[params.sortBy];
  q = q.order(sortColumn, { ascending: params.sortDir === "asc" });
  if (sortColumn !== "order_no") q = q.order("order_no", { ascending: false });

  const from = params.pageIndex * params.pageSize;
  const { data, error, count } = await q.range(from, from + params.pageSize - 1);
  if (error) throwQueryError(error);
  return { rows: (data as WmsOrderDbRow[]).map(toOrderRow), total: count ?? 0 };
}

/** 문서 상세 라인 — 처리 다이얼로그에서 품목·수량 확인/확정용 */
export async function fetchOrderLines(
  client: SupabaseClient,
  orderId: string,
): Promise<WmsOrderLine[]> {
  const { data, error } = await client
    .from("wms_order_items")
    .select("id, expected_qty, processed_qty, item:items(id, sku, name, unit, unit_price)")
    .eq("order_id", orderId)
    .order("id");
  if (error) throwQueryError(error);
  return data.map((line) => {
    // PostgREST 임베드는 단일 관계여도 타입상 배열일 수 있어 방어적으로 정규화
    const item = Array.isArray(line.item) ? line.item[0] : line.item;
    return {
      id: line.id,
      itemId: item.id,
      sku: item.sku,
      itemName: item.name,
      unit: item.unit,
      unitPrice: item.unit_price,
      expectedQty: line.expected_qty,
      processedQty: line.processed_qty,
    };
  });
}

/* ------------------------------------------------------------------ */
/* ERP 전표 목록 (v_vouchers)                                           */
/* ------------------------------------------------------------------ */

export interface VouchersParams {
  direction: Direction;
  pageIndex: number;
  pageSize: number;
  keyword: string;
}

export function createVouchersParams(direction: Direction): VouchersParams {
  return { direction, pageIndex: 0, pageSize: 5, keyword: "" };
}

export async function fetchVouchersPage(
  client: SupabaseClient,
  params: VouchersParams,
): Promise<PageResult<VoucherRow>> {
  let q = client
    .from("v_vouchers")
    .select("*", { count: "exact" })
    .eq("direction", params.direction);

  if (params.keyword.trim()) {
    const kw = `%${escapeLike(params.keyword.trim())}%`;
    q = q.or(`voucher_no.ilike.${kw},order_no.ilike.${kw},partner.ilike.${kw}`);
  }

  const from = params.pageIndex * params.pageSize;
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, from + params.pageSize - 1);
  if (error) throwQueryError(error);

  return {
    rows: data.map((v) => ({
      id: v.id,
      voucherNo: v.voucher_no,
      direction: v.direction,
      orderNo: v.order_no,
      partner: v.partner,
      warehouseName: v.warehouse_name,
      totalAmount: v.total_amount,
      lineCount: v.line_count,
      status: v.status,
      createdAt: v.created_at,
    })),
    total: count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* 재고 현황                                                            */
/* ------------------------------------------------------------------ */

export type InventorySortKey = "sku" | "totalQty" | "totalValue";

export interface InventoryParams {
  pageIndex: number;
  pageSize: number;
  sortBy: InventorySortKey;
  sortDir: "asc" | "desc";
  category: string;
  keyword: string;
}

export function createInventoryParams(): InventoryParams {
  return { pageIndex: 0, pageSize: 10, sortBy: "sku", sortDir: "asc", category: "", keyword: "" };
}

const INVENTORY_SORT_COLUMNS: Record<InventorySortKey, string> = {
  sku: "sku",
  totalQty: "total_qty",
  totalValue: "total_value",
};

export async function fetchInventoryByItemPage(
  client: SupabaseClient,
  params: InventoryParams,
): Promise<PageResult<InventoryByItemRow>> {
  let q = client.from("v_inventory_by_item").select("*", { count: "exact" });
  if (params.category) q = q.eq("category", params.category);
  if (params.keyword.trim()) {
    const kw = `%${escapeLike(params.keyword.trim())}%`;
    q = q.or(`sku.ilike.${kw},name.ilike.${kw}`);
  }

  const from = params.pageIndex * params.pageSize;
  const { data, error, count } = await q
    .order(INVENTORY_SORT_COLUMNS[params.sortBy], { ascending: params.sortDir === "asc" })
    .order("sku")
    .range(from, from + params.pageSize - 1);
  if (error) throwQueryError(error);

  return {
    rows: data.map((r) => ({
      itemId: r.item_id,
      sku: r.sku,
      name: r.name,
      category: r.category,
      unit: r.unit,
      unitPrice: r.unit_price,
      totalQty: r.total_qty,
      warehouseCount: r.warehouse_count,
      totalValue: r.total_value,
    })),
    total: count ?? 0,
  };
}

export type WarehouseInventorySortKey = "sku" | "qty" | "value";

export interface WarehouseInventoryParams {
  pageIndex: number;
  pageSize: number;
  sortBy: WarehouseInventorySortKey;
  sortDir: "asc" | "desc";
  warehouseId: string;
  /** 존(로케이션) 필터 — 평면도 존 클릭으로 설정된다 */
  zone: string;
  category: string;
  keyword: string;
}

export function createWarehouseInventoryParams(): WarehouseInventoryParams {
  return {
    pageIndex: 0,
    pageSize: 10,
    sortBy: "sku",
    sortDir: "asc",
    warehouseId: "",
    zone: "",
    category: "",
    keyword: "",
  };
}

export async function fetchWarehouseInventoryPage(
  client: SupabaseClient,
  params: WarehouseInventoryParams,
): Promise<PageResult<WarehouseInventoryRow>> {
  let q = client.from("v_warehouse_inventory").select("*", { count: "exact" });
  if (params.warehouseId) q = q.eq("warehouse_id", params.warehouseId);
  if (params.zone) q = q.eq("zone_code", params.zone);
  if (params.category) q = q.eq("category", params.category);
  if (params.keyword.trim()) {
    const kw = `%${escapeLike(params.keyword.trim())}%`;
    q = q.or(`sku.ilike.${kw},item_name.ilike.${kw}`);
  }

  const from = params.pageIndex * params.pageSize;
  const { data, error, count } = await q
    .order(params.sortBy === "sku" ? "sku" : params.sortBy, {
      ascending: params.sortDir === "asc",
    })
    .order("warehouse_code")
    .range(from, from + params.pageSize - 1);
  if (error) throwQueryError(error);

  return {
    rows: data.map((r) => ({
      warehouseId: r.warehouse_id,
      warehouseCode: r.warehouse_code,
      warehouseName: r.warehouse_name,
      itemId: r.item_id,
      sku: r.sku,
      itemName: r.item_name,
      category: r.category,
      unit: r.unit,
      zoneCode: r.zone_code ?? null,
      qty: r.qty,
      value: r.value,
      updatedAt: r.updated_at,
    })),
    total: count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* 대시보드 요약                                                        */
/* ------------------------------------------------------------------ */

export async function fetchWmsSummary(client: SupabaseClient): Promise<WmsSummary> {
  const { data, error } = await client.rpc("wms_summary");
  if (error) throwQueryError(error);
  return data as WmsSummary;
}

/* ------------------------------------------------------------------ */
/* 변경 RPC — 등록 / 처리 / 전표 생성                                    */
/* ------------------------------------------------------------------ */

export interface CreateOrderInput {
  direction: Direction;
  warehouseId: string;
  partner: string;
  expectedDate: string;
  memo: string;
  lines: { itemId: string; qty: number }[];
}

/** 입·출고 예정 등록 → 생성된 문서번호 반환 */
export async function createOrder(
  client: SupabaseClient,
  input: CreateOrderInput,
): Promise<string> {
  const { data, error } = await client.rpc("wms_create_order", {
    p_direction: input.direction,
    p_warehouse_id: input.warehouseId,
    p_partner: input.partner,
    p_expected_date: input.expectedDate,
    p_memo: input.memo,
    p_items: input.lines.map((l) => ({ item_id: l.itemId, qty: l.qty })),
  });
  if (error) throwQueryError(error);
  return data as string;
}

/** 입·출고 처리(실물 수량 확정 + 재고 반영) → 문서번호 반환 */
export async function processOrder(
  client: SupabaseClient,
  orderId: string,
  lines: { orderItemId: string; qty: number }[],
): Promise<string> {
  const { data, error } = await client.rpc("wms_process_order", {
    p_order_id: orderId,
    p_lines: lines.map((l) => ({ order_item_id: l.orderItemId, qty: l.qty })),
  });
  if (error) throwQueryError(error);
  return data as string;
}

/** ERP 전표 생성 → 전표번호 반환 */
export async function createVoucher(
  client: SupabaseClient,
  orderId: string,
): Promise<string> {
  const { data, error } = await client.rpc("wms_create_voucher", {
    p_order_id: orderId,
  });
  if (error) throwQueryError(error);
  return data as string;
}
