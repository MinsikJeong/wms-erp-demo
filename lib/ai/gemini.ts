import "server-only";

import { AI_ACTIONS, type AiPlan } from "@/lib/ai/types";
import type { Warehouse } from "@/lib/wms/types";

/**
 * 자연어 명령 → AiPlan 파서 (Gemini, 서버 전용).
 *
 * - API 키는 서버 환경 변수(GEMINI_API_KEY)로만 접근 — 클라이언트 노출 금지.
 * - responseSchema로 구조화 출력(JSON)을 강제하고, 응답을 그대로 믿지 않고
 *   서버에서 화이트리스트/형식 검증을 한 번 더 거친다 (LLM 출력도 외부 입력이다).
 * - LLM은 여기서 "계획 수립"까지만 담당한다. 실행은 app/ai/actions.ts가
 *   권한·상태를 재검증한 뒤 기존 RPC로만 수행한다.
 */

const GEMINI_MODEL = "gemini-2.5-flash";

/** Gemini 구조화 출력 스키마 (OpenAPI subset) */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: [...AI_ACTIONS] },
    direction: { type: "STRING", enum: ["IN", "OUT", "ANY"] },
    dateFrom: { type: "STRING", description: "YYYY-MM-DD 또는 빈 문자열" },
    dateTo: { type: "STRING", description: "YYYY-MM-DD 또는 빈 문자열" },
    warehouseCode: { type: "STRING", description: "창고 코드 정확 일치 또는 빈 문자열" },
    partner: { type: "STRING", description: "거래처 검색어 또는 빈 문자열" },
    status: { type: "STRING", enum: ["SCHEDULED", "PROCESSED", "VOUCHERED", "ANY"] },
    explanation: { type: "STRING", description: "이해한 내용 한 문장 요약 (한국어)" },
    unsupportedReason: { type: "STRING", description: "action이 unsupported일 때만 사유" },
  },
  required: ["action", "direction", "status", "explanation"],
} as const;

function buildPrompt(command: string, warehouses: Warehouse[], today: string): string {
  const warehouseList = warehouses
    .map((w) => `- ${w.code}: ${w.name} (${w.location})`)
    .join("\n");

  return `너는 창고관리 시스템(WMS)의 명령 해석기다. 사용자의 한국어 명령을 구조화된 계획(JSON)으로 변환만 한다. 절대 실행하지 않는다.

오늘 날짜: ${today}

## 창고 목록 (warehouseCode는 반드시 이 코드 중 하나이거나 빈 문자열)
${warehouseList}

## 액션 정의
- query_orders: 입·출고 문서를 조회/확인 ("보여줘", "몇 건이야", "찾아줘")
- cancel_orders: 예정(SCHEDULED) 상태 문서 취소 ("취소해줘", "삭제해줘")
- process_orders: 예정 문서를 예정 수량 그대로 일괄 처리 확정 ("처리해줘", "확정해줘")
- create_vouchers: 처리완료(PROCESSED) 문서의 ERP 전표 일괄 생성 ("전표 만들어줘", "전표 발행해줘")
- unsupported: 위 4개로 표현 불가한 요청 (예: 수량 수정, 신규 등록, 재고 조정, 창고 추가, 시스템 설정)

## 규칙
- direction: 입고=IN, 출고=OUT, 언급 없으면 ANY
- 날짜 표현은 오늘 날짜 기준 YYYY-MM-DD 범위로 변환 (예: "오늘" → dateFrom=dateTo=오늘, "이번 주" → 월요일~일요일, "어제" → 어제 하루). 언급 없으면 둘 다 빈 문자열
- warehouseCode: 창고 이름·지역이 언급되면 목록에서 코드를 고른다. 애매하면 빈 문자열
- partner: 거래처/공급처/출고처 상호가 언급되면 그대로 (부분 일치 검색에 쓰임). 없으면 빈 문자열
- status: query_orders에서만 의미 있음 ("예정"=SCHEDULED, "처리완료"=PROCESSED, "전표완료"=VOUCHERED). 언급 없거나 변경 액션이면 ANY
- explanation: 이해한 조건을 한국어 한 문장으로. 사용자가 이걸 보고 실행 여부를 판단한다
- 조건이 하나도 없는 전체 취소/전체 처리 요청도 그대로 변환한다 (건수 상한은 시스템이 막는다)

## 사용자 명령
"${command}"`;
}

/** 서버측 재검증 — LLM 출력도 외부 입력으로 취급한다 */
function sanitizePlan(raw: unknown): AiPlan {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  const action = AI_ACTIONS.includes(str(obj.action) as AiPlan["action"])
    ? (str(obj.action) as AiPlan["action"])
    : "unsupported";
  const direction = ["IN", "OUT", "ANY"].includes(str(obj.direction))
    ? (str(obj.direction) as AiPlan["direction"])
    : "ANY";
  const status = ["SCHEDULED", "PROCESSED", "VOUCHERED", "ANY"].includes(str(obj.status))
    ? (str(obj.status) as AiPlan["status"])
    : "ANY";
  const dateFrom = dateRe.test(str(obj.dateFrom)) ? str(obj.dateFrom) : "";
  const dateTo = dateRe.test(str(obj.dateTo)) ? str(obj.dateTo) : "";

  return {
    action,
    direction,
    status,
    dateFrom,
    dateTo,
    warehouseCode: str(obj.warehouseCode).slice(0, 32),
    partner: str(obj.partner).slice(0, 64),
    explanation: str(obj.explanation).slice(0, 300) || "명령을 해석했습니다.",
    unsupportedReason: str(obj.unsupportedReason).slice(0, 300),
  };
}

export async function parseCommandWithGemini(
  command: string,
  warehouses: Warehouse[],
  today: string,
): Promise<AiPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다 (.env.local).");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(command, warehouses, today) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      }),
      // 어시스턴트 응답은 실시간 UX — 지나친 대기 방지
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API 오류 (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini 응답을 JSON으로 해석할 수 없습니다.");
  }
  return sanitizePlan(parsed);
}
