import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CategoryShare,
  DailyFlow,
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
  itemSearch: (keyword: string) => ["wms", "item-search", keyword] as const,
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

/** 품목 검색 결과 페이지 크기 — 콤보박스는 상위 N건만 보여주고 나머지는 검색 유도 */
export const ITEM_SEARCH_LIMIT = 20;

/**
 * 품목 검색 (등록 폼 콤보박스용).
 * 품목 마스터가 수천 건으로 늘어도 전량 로드하지 않도록 SKU/품목명
 * ilike 필터를 DB로 push-down 하고 상위 N건 + 전체 건수만 가져온다.
 * 빈 검색어는 SKU 순 상위 N건(브라우즈 모드)을 반환한다.
 */
export async function searchItems(
  client: SupabaseClient,
  keyword: string,
): Promise<PageResult<Item>> {
  let q = client
    .from("items")
    .select("id, sku, name, category, unit, unit_price", { count: "exact" });

  if (keyword.trim()) {
    const kw = `%${escapeLike(keyword.trim())}%`;
    q = q.or(`sku.ilike.${kw},name.ilike.${kw}`);
  }

  const { data, error, count } = await q.order("sku").limit(ITEM_SEARCH_LIMIT);
  if (error) throwQueryError(error);

  return {
    rows: data.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      category: i.category,
      unit: i.unit,
      unitPrice: i.unit_price,
    })),
    total: count ?? 0,
  };
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
  /**
   * 빈 문자열 = 필터 미적용 (queryKey 형태 고정을 위해 undefined 대신 사용).
   * 배열을 넘기면 여러 상태를 동시에 조회한다 (예: 출고처리 대상 = SCHEDULED + PICKING).
   */
  status: WmsOrderStatus | WmsOrderStatus[] | "";
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
  total_picked_qty: number;
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
    totalPickedQty: db.total_picked_qty,
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

  if (Array.isArray(params.status)) {
    if (params.status.length > 0) q = q.in("status", params.status);
  } else if (params.status) {
    q = q.eq("status", params.status);
  }
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

/**
 * 문서 상세 라인 — 피킹/처리 다이얼로그에서 품목·존·수량 확인/확정용 (v_order_lines 뷰).
 * 존 코드(zone_code) 오름차순으로 정렬해 그대로 피킹 동선(적재 위치 순회) 순서가 되게 한다.
 */
export async function fetchOrderLines(
  client: SupabaseClient,
  orderId: string,
): Promise<WmsOrderLine[]> {
  const { data, error } = await client
    .from("v_order_lines")
    .select(
      "id, item_id, sku, item_name, unit, unit_price, expected_qty, processed_qty, picked_qty, picked_at, zone_code",
    )
    .eq("order_id", orderId)
    .order("zone_code", { ascending: true, nullsFirst: false })
    .order("id");
  if (error) throwQueryError(error);
  return data.map((line) => ({
    id: line.id,
    itemId: line.item_id,
    sku: line.sku,
    itemName: line.item_name,
    unit: line.unit,
    unitPrice: line.unit_price,
    expectedQty: line.expected_qty,
    processedQty: line.processed_qty,
    pickedQty: line.picked_qty,
    pickedAt: line.picked_at,
    zoneCode: line.zone_code,
  }));
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
/* 대시보드 차트 (서버 컴포넌트 전용 — 조회 후 JS에서 집계)               */
/* ------------------------------------------------------------------ */

/** 로컬(KST) 기준 YYYY-MM-DD — toISOString은 UTC라 날짜가 밀릴 수 있어 직접 조립 */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 최근 N일 일자별 입·출고 물동량 (예정 수량 합계).
 * 문서 건수는 시드 특성상 입·출고가 매일 동수라 계열이 겹친다 —
 * 수량 합계가 실제 '물동량'이며 차트에서도 계열이 분리된다.
 * PostgREST는 GROUP BY를 지원하지 않으므로 기간 필터만 push-down 하고
 * (데모 데이터 기준 수백 행) 집계는 서버 컴포넌트에서 수행한다.
 * 문서가 없는 날짜도 0으로 채워 차트 축이 끊기지 않게 한다.
 */
export async function fetchDailyFlows(
  client: SupabaseClient,
  days = 14,
): Promise<DailyFlow[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));

  const { data, error } = await client
    .from("v_wms_orders")
    .select("expected_date, direction, total_expected_qty")
    .gte("expected_date", toDateKey(from))
    .lte("expected_date", toDateKey(today));
  if (error) throwQueryError(error);

  const byDate = new Map<string, DailyFlow>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const key = toDateKey(d);
    byDate.set(key, { date: key, inbound: 0, outbound: 0 });
  }
  for (const row of data as {
    expected_date: string;
    direction: Direction;
    total_expected_qty: number;
  }[]) {
    const bucket = byDate.get(row.expected_date);
    if (!bucket) continue;
    if (row.direction === "IN") bucket.inbound += row.total_expected_qty;
    else bucket.outbound += row.total_expected_qty;
  }
  return [...byDate.values()];
}

/** 카테고리별 재고 구성 — 품목 마스터(소량)를 전량 조회 후 카테고리로 접는다 */
export async function fetchCategoryShares(client: SupabaseClient): Promise<CategoryShare[]> {
  const { data, error } = await client
    .from("v_inventory_by_item")
    .select("category, total_qty, total_value");
  if (error) throwQueryError(error);

  const byCategory = new Map<string, CategoryShare>();
  for (const row of data as { category: string; total_qty: number; total_value: number }[]) {
    const bucket = byCategory.get(row.category) ?? {
      category: row.category,
      itemKinds: 0,
      totalQty: 0,
      totalValue: 0,
    };
    bucket.itemKinds += 1;
    bucket.totalQty += row.total_qty;
    bucket.totalValue += row.total_value;
    byCategory.set(row.category, bucket);
  }
  return [...byCategory.values()].sort((a, b) => b.totalValue - a.totalValue);
}

/** 최근 등록 문서 — 대시보드 최근 활동 피드용 */
export async function fetchRecentOrders(
  client: SupabaseClient,
  limit = 8,
): Promise<WmsOrderRow[]> {
  const { data, error } = await client
    .from("v_wms_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throwQueryError(error);
  return (data as WmsOrderDbRow[]).map(toOrderRow);
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

/**
 * 피킹 실적 기록(출고 전용) → 문서번호 반환.
 * 재고에는 영향이 없으며, 최초 저장 시 문서 상태를 SCHEDULED→PICKING으로 전이시킨다.
 */
export async function recordPicking(
  client: SupabaseClient,
  orderId: string,
  lines: { orderItemId: string; pickedQty: number }[],
): Promise<string> {
  const { data, error } = await client.rpc("wms_record_picking", {
    p_order_id: orderId,
    p_lines: lines.map((l) => ({ order_item_id: l.orderItemId, picked_qty: l.pickedQty })),
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

/** 예정 문서 취소 (SCHEDULED 전용 — DB가 상태를 재검증) → 문서번호 반환 */
export async function cancelOrder(
  client: SupabaseClient,
  orderId: string,
): Promise<string> {
  const { data, error } = await client.rpc("wms_cancel_order", {
    p_order_id: orderId,
  });
  if (error) throwQueryError(error);
  return data as string;
}
