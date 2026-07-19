import type { Direction, WmsOrderStatus } from "@/lib/wms/types";

/**
 * AI 어시스턴트 공용 타입 (클라이언트/서버 공유 — 비밀 정보 없음).
 *
 * 안전 설계의 핵심: LLM의 출력은 "실행 명령"이 아니라 아래 AiPlan 하나뿐이다.
 * 화이트리스트 액션 + 필터 조건으로만 구성되고, 실제 대상 선정·권한 검증·
 * 실행은 전부 서버 코드가 수행한다.
 */

/** LLM이 선택할 수 있는 액션 화이트리스트 — 이 외의 동작은 unsupported */
export const AI_ACTIONS = [
  "query_orders",
  "cancel_orders",
  "process_orders",
  "create_vouchers",
  "unsupported",
] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export const AI_ACTION_LABELS: Record<AiAction, string> = {
  query_orders: "조회",
  cancel_orders: "예정 취소",
  process_orders: "일괄 처리 (예정 수량대로 확정)",
  create_vouchers: "ERP 전표 일괄 생성",
  unsupported: "지원하지 않는 요청",
};

/** LLM 파싱 결과 — 자연어를 구조화한 계획 (실행 아님) */
export interface AiPlan {
  action: AiAction;
  direction: Direction | "ANY";
  /** YYYY-MM-DD, 미지정이면 "" */
  dateFrom: string;
  dateTo: string;
  /** warehouses.code 정확 일치, 못 찾으면 "" */
  warehouseCode: string;
  /** 거래처(공급처/출고처) 부분 일치 검색어, 미지정 "" */
  partner: string;
  /** query_orders 전용 상태 필터 — 변경 액션은 서버가 전제 상태를 강제한다 */
  status: WmsOrderStatus | "ANY";
  /** AI가 이해한 내용 요약 (한국어) — 사용자 검토용 */
  explanation: string;
  unsupportedReason: string;
}

/** 미리보기 대상 문서 (목록 행 축약) */
export interface AiPreviewOrder {
  id: string;
  orderNo: string;
  direction: Direction;
  warehouseName: string;
  partner: string;
  expectedDate: string;
  status: WmsOrderStatus;
  itemKinds: number;
  totalExpectedQty: number;
}

/** 계획 + 대상 조회 결과 (dry-run) — 사용자가 확인 후 실행 버튼을 눌러야 한다 */
export interface AiPreview {
  plan: AiPlan;
  orders: AiPreviewOrder[];
  total: number;
  /** 실행 가능 여부 — false면 blockedReason에 사유 */
  executable: boolean;
  blockedReason: string;
}

export interface AiExecutionItem {
  orderNo: string;
  ok: boolean;
  message: string;
}

export interface AiExecutionResult {
  items: AiExecutionItem[];
  succeeded: number;
  failed: number;
}

/** 1회 실행 상한 — 대량 오조작 방지 안전장치 */
export const AI_MAX_EXECUTE = 20;
