/**
 * 재무 대사(Reconciliation) 도메인 타입 정의.
 *
 * OMS(주문) · WMS(출고) · PG(정산) 3개 시스템의 데이터를 주문 번호 기준으로
 * 상호 대조한 결과를 표현한다. 모든 화면/컴포넌트는 이 타입을 단일 소스로 사용한다.
 */

/** 대사 결과 상태 — AGENTS.md 2.1 원칙에 따라 4가지 상태로 고정 */
export const RECON_STATUSES = [
  "MATCH",
  "MISMATCH",
  "DUPLICATED",
  "MISSING",
] as const;
export type ReconStatus = (typeof RECON_STATUSES)[number];

/** 대사 대상 시스템 식별자 */
export type SourceSystem = "OMS" | "WMS" | "PG";

/** 정산 진행 상태 (PG사 기준) */
export type SettlementStatus = "PENDING" | "CONFIRMED" | "PAID" | "HOLD";

/** 시스템별 스냅샷 — 해당 시스템에 레코드가 없으면(누락) null */
export interface SystemSnapshot {
  /** 시스템 내부 문서 번호 (주문번호/출고번호/거래번호) */
  documentNo: string;
  /** 금액 (OMS: 주문금액, WMS: 출고 기준 금액, PG: 실 정산금액) */
  amount: number;
  /** 수량 (PG는 결제 단위라 수량 개념이 없어 null 허용) */
  quantity: number | null;
  /** 시스템에 기록된 처리 시각 (ISO 8601) */
  recordedAt: string;
}

/** 대사 결과 한 행 = 주문 1건에 대한 3-way 비교 결과 */
export interface ReconciliationRow {
  /** 대사 엔진이 부여한 고유 키 */
  id: string;
  /** 기준 주문 번호 (3개 시스템 조인 키) */
  orderNo: string;
  /** 판매 채널 (자사몰/쿠팡/네이버 등) */
  channel: string;
  /** 거래 일자 (YYYY-MM-DD) */
  transactionDate: string;
  /** 시스템별 스냅샷 — null 이면 해당 시스템에서 레코드 누락 */
  oms: SystemSnapshot | null;
  wms: SystemSnapshot | null;
  pg: SystemSnapshot | null;
  /** 대사 엔진이 판정한 최종 상태 */
  status: ReconStatus;
  /**
   * 불일치/누락/중복의 구체적 사유.
   * 운영자가 툴팁으로 즉시 원인을 파악할 수 있도록 사람이 읽는 문장으로 기록한다.
   * 예: "OMS 주문금액과 PG 정산금액 5,000원 불일치"
   */
  statusReason: string | null;
  /** OMS 금액 - PG 정산금액 차액 (누락 시 산출 불가 → null) */
  amountDiff: number | null;
  /** PG사 정산 진행 상태 */
  settlementStatus: SettlementStatus;
}

/** 상단 Metric Card 요약 집계 */
export interface ReconciliationSummary {
  totalCount: number;
  matchCount: number;
  mismatchCount: number;
  duplicatedCount: number;
  missingCount: number;
  /** 불일치 건들의 차액 절대값 합계 — 재무 리스크 규모를 한눈에 보여준다 */
  totalDiffAmount: number;
}

/* ------------------------------------------------------------------ */
/* 인증/권한 (RBAC)                                                    */
/* ------------------------------------------------------------------ */

/** 사내 인트라넷 권한 등급 */
export const USER_ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** 세션 사용자 — 실제 환경에서는 IdP/세션 쿠키에서 복원된다 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
}
