/**
 * WMS 도메인 타입 정의 (단일 소스).
 * 창고 / 품목 / 입·출고 문서 / 재고 / ERP 전표.
 */

/** 문서 구분 — IN(입고) / OUT(출고). UI와 RPC가 공용으로 사용한다 */
export type Direction = "IN" | "OUT";

/** 입·출고 문서 상태: 예정 → 처리완료 → 전표생성완료 */
export const WMS_ORDER_STATUSES = ["SCHEDULED", "PROCESSED", "VOUCHERED"] as const;
export type WmsOrderStatus = (typeof WMS_ORDER_STATUSES)[number];

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  isActive: boolean;
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
  voucherNo: string | null;
}

/** 문서 상세 라인 (처리 다이얼로그·상세 표시용) */
export interface WmsOrderLine {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  expectedQty: number;
  processedQty: number | null;
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
  qty: number;
  value: number;
  updatedAt: string;
}

/** 대시보드 요약 (wms_summary RPC) */
export interface WmsSummary {
  todayInbound: number;
  todayOutbound: number;
  pendingInbound: number;
  pendingOutbound: number;
  unvoucheredCount: number;
  lowStockCount: number;
  totalInventoryValue: number;
}
