/**
 * WMS 도메인 타입 정의 (단일 소스).
 * 창고 / 품목 / 입·출고 문서 / 재고 / ERP 전표.
 */

/** 문서 구분 — IN(입고) / OUT(출고). UI와 RPC가 공용으로 사용한다 */
export type Direction = "IN" | "OUT";

/**
 * 입·출고 문서 상태: 예정 → (출고만) 피킹중 → 처리완료 → 전표생성완료.
 * PICKING은 출고(OUT) 전용 중간 상태 — 입고 문서는 SCHEDULED에서 바로 PROCESSED로 넘어간다.
 */
export const WMS_ORDER_STATUSES = ["SCHEDULED", "PICKING", "PROCESSED", "VOUCHERED"] as const;
export type WmsOrderStatus = (typeof WMS_ORDER_STATUSES)[number];

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  isActive: boolean;
  /** 지도 마커용 좌표 (WGS84) — 마이그레이션 전에는 null */
  lat: number | null;
  lng: number | null;
}

/** 지리 지도 팝업용 창고별 재고 요약 (v_warehouse_stock_summary 뷰) */
export interface WarehouseStockSummary extends Warehouse {
  itemKinds: number;
  totalQty: number;
  totalValue: number;
}

/** 평면도 히트맵용 존별 재고 집계 (v_zone_inventory 뷰) */
export interface ZoneStock {
  warehouseId: string;
  zoneCode: string;
  itemKinds: number;
  totalQty: number;
  totalValue: number;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
}

/** 입·출고 문서 목록 행 (v_wms_orders 뷰) */
export interface WmsOrderRow {
  id: string;
  orderNo: string;
  direction: Direction;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  /** IN: 공급처 / OUT: 출고처(판매채널·거래처) */
  partner: string;
  expectedDate: string;
  status: WmsOrderStatus;
  memo: string | null;
  processedAt: string | null;
  createdAt: string;
  /** 품목 종류 수 */
  itemKinds: number;
  totalExpectedQty: number;
  totalProcessedQty: number;
  /** 피킹 확정 수량 합계 — 출고 문서에서만 의미 있음(입고는 항상 0) */
  totalPickedQty: number;
  voucherNo: string | null;
}

/** 문서 상세 라인 (피킹·처리 다이얼로그·상세 표시용, v_order_lines 뷰) */
export interface WmsOrderLine {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  expectedQty: number;
  processedQty: number | null;
  /** 피킹 확정 수량 — 출고 문서에서만 존재, 미착수 시 null */
  pickedQty: number | null;
  pickedAt: string | null;
  /** 고정 로케이션(존) — 피킹 동선 정렬 기준, 재고가 없던 품목이면 null */
  zoneCode: string | null;
}

/** ERP 전표 목록 행 (v_vouchers 뷰) */
export interface VoucherRow {
  id: string;
  voucherNo: string;
  direction: Direction;
  orderNo: string;
  partner: string;
  warehouseName: string;
  totalAmount: number;
  lineCount: number;
  status: "POSTED";
  createdAt: string;
}

/** 품목별 전체 재고 행 (v_inventory_by_item 뷰) */
export interface InventoryByItemRow {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  totalQty: number;
  warehouseCount: number;
  totalValue: number;
}

/** 창고별 재고 행 (v_warehouse_inventory 뷰) */
export interface WarehouseInventoryRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  itemId: string;
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  /** 고정 로케이션(존) 코드, 예: A-03 — 마이그레이션 전에는 null */
  zoneCode: string | null;
  qty: number;
  value: number;
  updatedAt: string;
}

/** 대시보드 히어로 차트용 일자별 입·출고 물동량 (예정 수량 합계) */
export interface DailyFlow {
  /** YYYY-MM-DD */
  date: string;
  inbound: number;
  outbound: number;
}

/** 대시보드 카테고리 구성 차트용 집계 (v_inventory_by_item을 카테고리로 접음) */
export interface CategoryShare {
  category: string;
  itemKinds: number;
  totalQty: number;
  totalValue: number;
}

/** 대시보드 요약 (wms_summary RPC) */
export interface WmsSummary {
  todayInbound: number;
  todayOutbound: number;
  pendingInbound: number;
  /** 출고처리 대기 — SCHEDULED + PICKING 합계 */
  pendingOutbound: number;
  /** 피킹 진행중(PICKING) 건수 — pendingOutbound의 부분집합 */
  pickingCount: number;
  unvoucheredCount: number;
  lowStockCount: number;
  totalInventoryValue: number;
}
