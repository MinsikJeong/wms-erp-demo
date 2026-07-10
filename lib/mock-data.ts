import "server-only";

import type {
  ReconciliationRow,
  ReconciliationSummary,
} from "@/lib/types";

/**
 * 대사 결과 Mock 데이터 (서버 전용).
 *
 * 실제 환경에서는 이 모듈이 "대사 엔진 API (OMS·WMS·PG 3-way 조인 결과)" 호출로
 * 교체된다. 화면 컴포넌트는 `ReconciliationRow[]` 계약에만 의존하므로
 * 데이터 소스 교체 시 UI 수정이 필요 없다.
 *
 * 4가지 상태(MATCH/MISMATCH/DUPLICATED/MISSING)와 채널·정산 상태 조합을
 * 모두 포함해 하이라이트·필터·집계 로직을 검증할 수 있게 구성했다.
 */
const MOCK_ROWS: ReconciliationRow[] = [
  {
    id: "recon-0001",
    orderNo: "ORD-20260701-1042",
    channel: "자사몰",
    transactionDate: "2026-07-01",
    oms: { documentNo: "OMS-88231", amount: 129000, quantity: 2, recordedAt: "2026-07-01T10:12:33+09:00" },
    wms: { documentNo: "WMS-55102", amount: 129000, quantity: 2, recordedAt: "2026-07-01T15:40:02+09:00" },
    pg:  { documentNo: "PG-77281039", amount: 129000, quantity: null, recordedAt: "2026-07-02T04:00:00+09:00" },
    status: "MATCH",
    statusReason: null,
    amountDiff: 0,
    settlementStatus: "PAID",
  },
  {
    id: "recon-0002",
    orderNo: "ORD-20260701-1187",
    channel: "쿠팡",
    transactionDate: "2026-07-01",
    oms: { documentNo: "OMS-88307", amount: 254000, quantity: 4, recordedAt: "2026-07-01T11:05:19+09:00" },
    wms: { documentNo: "WMS-55210", amount: 254000, quantity: 4, recordedAt: "2026-07-01T17:22:45+09:00" },
    pg:  { documentNo: "PG-77281440", amount: 249000, quantity: null, recordedAt: "2026-07-02T04:00:00+09:00" },
    status: "MISMATCH",
    // 대조 수식: |OMS.amount - PG.amount| > 0 → MISMATCH. 사유는 운영자용 문장으로 기록.
    statusReason: "OMS 주문금액(254,000원)과 PG 정산금액(249,000원) 5,000원 불일치 — 부분 취소 미반영 의심",
    amountDiff: 5000,
    settlementStatus: "HOLD",
  },
  {
    id: "recon-0003",
    orderNo: "ORD-20260702-0091",
    channel: "네이버",
    transactionDate: "2026-07-02",
    oms: { documentNo: "OMS-88412", amount: 78000, quantity: 1, recordedAt: "2026-07-02T09:31:02+09:00" },
    wms: null,
    pg:  { documentNo: "PG-77282019", amount: 78000, quantity: null, recordedAt: "2026-07-03T04:00:00+09:00" },
    status: "MISSING",
    statusReason: "WMS 출고 레코드 누락 — 주문·정산은 존재하나 출고 지시가 확인되지 않음 (미출고 과금 위험)",
    amountDiff: 0,
    settlementStatus: "CONFIRMED",
  },
  {
    id: "recon-0004",
    orderNo: "ORD-20260702-0233",
    channel: "자사몰",
    transactionDate: "2026-07-02",
    oms: { documentNo: "OMS-88459", amount: 46000, quantity: 1, recordedAt: "2026-07-02T13:44:51+09:00" },
    wms: { documentNo: "WMS-55388", amount: 46000, quantity: 1, recordedAt: "2026-07-02T18:02:10+09:00" },
    pg:  { documentNo: "PG-77282215", amount: 92000, quantity: null, recordedAt: "2026-07-03T04:00:00+09:00" },
    status: "DUPLICATED",
    statusReason: "PG 정산 레코드 2건 중복 집계 — 동일 주문번호로 92,000원(2배) 정산됨, PG사 이중 청구 확인 필요",
    amountDiff: -46000,
    settlementStatus: "HOLD",
  },
  {
    id: "recon-0005",
    orderNo: "ORD-20260703-0412",
    channel: "카카오",
    transactionDate: "2026-07-03",
    oms: null,
    wms: { documentNo: "WMS-55461", amount: 187000, quantity: 3, recordedAt: "2026-07-03T10:15:33+09:00" },
    pg:  { documentNo: "PG-77283001", amount: 187000, quantity: null, recordedAt: "2026-07-04T04:00:00+09:00" },
    status: "MISSING",
    statusReason: "OMS 주문 레코드 누락 — 출고·정산만 존재, 채널 주문 수집 배치 실패 구간(07-03 09~11시) 재수집 필요",
    amountDiff: null,
    settlementStatus: "PENDING",
  },
  {
    id: "recon-0006",
    orderNo: "ORD-20260703-0518",
    channel: "쿠팡",
    transactionDate: "2026-07-03",
    oms: { documentNo: "OMS-88602", amount: 315000, quantity: 5, recordedAt: "2026-07-03T14:20:08+09:00" },
    wms: { documentNo: "WMS-55519", amount: 315000, quantity: 5, recordedAt: "2026-07-03T19:55:41+09:00" },
    pg:  { documentNo: "PG-77283388", amount: 315000, quantity: null, recordedAt: "2026-07-04T04:00:00+09:00" },
    status: "MATCH",
    statusReason: null,
    amountDiff: 0,
    settlementStatus: "PAID",
  },
  {
    id: "recon-0007",
    orderNo: "ORD-20260704-0077",
    channel: "네이버",
    transactionDate: "2026-07-04",
    oms: { documentNo: "OMS-88710", amount: 59000, quantity: 1, recordedAt: "2026-07-04T08:47:12+09:00" },
    wms: { documentNo: "WMS-55602", amount: 59000, quantity: 2, recordedAt: "2026-07-04T13:11:29+09:00" },
    pg:  { documentNo: "PG-77284102", amount: 59000, quantity: null, recordedAt: "2026-07-05T04:00:00+09:00" },
    status: "MISMATCH",
    statusReason: "OMS 주문수량(1)과 WMS 출고수량(2) 불일치 — 과출고 재고 손실 위험, 반품 여부 확인 필요",
    amountDiff: 0,
    settlementStatus: "CONFIRMED",
  },
  {
    id: "recon-0008",
    orderNo: "ORD-20260704-0154",
    channel: "자사몰",
    transactionDate: "2026-07-04",
    oms: { documentNo: "OMS-88755", amount: 430000, quantity: 2, recordedAt: "2026-07-04T11:30:55+09:00" },
    wms: { documentNo: "WMS-55648", amount: 430000, quantity: 2, recordedAt: "2026-07-04T16:44:03+09:00" },
    pg:  null,
    status: "MISSING",
    statusReason: "PG 정산 레코드 누락 — 출고 완료 후 3영업일 경과에도 정산 미접수, 미수금 430,000원 발생",
    amountDiff: null,
    settlementStatus: "PENDING",
  },
  {
    id: "recon-0009",
    orderNo: "ORD-20260705-0201",
    channel: "카카오",
    transactionDate: "2026-07-05",
    oms: { documentNo: "OMS-88820", amount: 22000, quantity: 1, recordedAt: "2026-07-05T09:02:44+09:00" },
    wms: { documentNo: "WMS-55701", amount: 22000, quantity: 1, recordedAt: "2026-07-05T14:38:17+09:00" },
    pg:  { documentNo: "PG-77285230", amount: 22000, quantity: null, recordedAt: "2026-07-06T04:00:00+09:00" },
    status: "MATCH",
    statusReason: null,
    amountDiff: 0,
    settlementStatus: "PAID",
  },
  {
    id: "recon-0010",
    orderNo: "ORD-20260705-0342",
    channel: "쿠팡",
    transactionDate: "2026-07-05",
    oms: { documentNo: "OMS-88871", amount: 168000, quantity: 2, recordedAt: "2026-07-05T15:19:26+09:00" },
    wms: { documentNo: "WMS-55749", amount: 168000, quantity: 2, recordedAt: "2026-07-05T20:03:58+09:00" },
    pg:  { documentNo: "PG-77285512", amount: 151200, quantity: null, recordedAt: "2026-07-06T04:00:00+09:00" },
    status: "MISMATCH",
    statusReason: "OMS 주문금액(168,000원)과 PG 정산금액(151,200원) 16,800원 불일치 — 채널 수수료(10%) 차감 전/후 기준 상이 의심",
    amountDiff: 16800,
    settlementStatus: "HOLD",
  },
  {
    id: "recon-0011",
    orderNo: "ORD-20260706-0018",
    channel: "자사몰",
    transactionDate: "2026-07-06",
    oms: { documentNo: "OMS-88930", amount: 96000, quantity: 2, recordedAt: "2026-07-06T10:41:09+09:00" },
    wms: { documentNo: "WMS-55803", amount: 96000, quantity: 2, recordedAt: "2026-07-06T15:27:36+09:00" },
    pg:  { documentNo: "PG-77286077", amount: 96000, quantity: null, recordedAt: "2026-07-07T04:00:00+09:00" },
    status: "MATCH",
    statusReason: null,
    amountDiff: 0,
    settlementStatus: "CONFIRMED",
  },
  {
    id: "recon-0012",
    orderNo: "ORD-20260706-0290",
    channel: "네이버",
    transactionDate: "2026-07-06",
    oms: { documentNo: "OMS-88988", amount: 74000, quantity: 1, recordedAt: "2026-07-06T17:55:48+09:00" },
    wms: { documentNo: "WMS-55861", amount: 74000, quantity: 1, recordedAt: "2026-07-06T21:12:20+09:00" },
    pg:  { documentNo: "PG-77286391", amount: 148000, quantity: null, recordedAt: "2026-07-07T04:00:00+09:00" },
    status: "DUPLICATED",
    statusReason: "OMS 주문 이벤트 중복 발행으로 PG 이중 결제 148,000원 — 1건 취소 처리 필요",
    amountDiff: -74000,
    settlementStatus: "HOLD",
  },
];

/**
 * 대사 결과 조회.
 * 실제 API 연동 시 이 함수만 fetch 호출로 교체한다. 응답이 느려지는 경우에는
 * 같은 세그먼트의 loading.tsx 스켈레톤이 자동으로 노출된다.
 */
export async function fetchReconciliationRows(): Promise<ReconciliationRow[]> {
  return MOCK_ROWS;
}

/**
 * Metric Card용 요약 집계.
 * 서버에서 1회 계산해 내려보내므로 클라이언트는 렌더링만 담당한다.
 */
export function summarize(rows: ReconciliationRow[]): ReconciliationSummary {
  return rows.reduce<ReconciliationSummary>(
    (acc, row) => {
      acc.totalCount += 1;
      if (row.status === "MATCH") acc.matchCount += 1;
      if (row.status === "MISMATCH") acc.mismatchCount += 1;
      if (row.status === "DUPLICATED") acc.duplicatedCount += 1;
      if (row.status === "MISSING") acc.missingCount += 1;
      // 차액 리스크 = 불일치/중복 건 차액의 절대값 합 (누락 건은 금액 산출 불가)
      if (row.status !== "MATCH" && row.amountDiff !== null) {
        acc.totalDiffAmount += Math.abs(row.amountDiff);
      }
      return acc;
    },
    {
      totalCount: 0,
      matchCount: 0,
      mismatchCount: 0,
      duplicatedCount: 0,
      missingCount: 0,
      totalDiffAmount: 0,
    },
  );
}
