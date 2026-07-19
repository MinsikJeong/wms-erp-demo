"use server";

import { parseCommandWithGemini } from "@/lib/ai/gemini";
import {
  AI_MAX_EXECUTE,
  type AiAction,
  type AiExecutionItem,
  type AiExecutionResult,
  type AiPlan,
  type AiPreview,
  type AiPreviewOrder,
} from "@/lib/ai/types";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  cancelOrder,
  createVoucher,
  fetchOrderLines,
  fetchWarehouses,
  processOrder,
} from "@/lib/wms/api";
import type { Direction, WmsOrderStatus } from "@/lib/wms/types";

/**
 * AI 어시스턴트 Server Actions.
 *
 * 안전장치 (모두 서버에서 강제 — 클라이언트/LLM은 우회 불가):
 * 1. LLM은 계획(AiPlan)만 만든다 — 실행 권한이 아예 없다.
 * 2. planAiCommand = dry-run: 계획대로 "조회"만 하고 대상 목록을 돌려준다.
 * 3. executeAiPlan은 사용자가 미리보기를 확인한 뒤에만 호출되며,
 *    권한(OPERATOR+)·건수 상한(20)·문서별 전제 상태를 다시 검증한다.
 * 4. 실제 변경은 기존 security definer RPC만 통과 — DB가 최종 정합성을 지킨다.
 */

/** 변경 액션별 전제 상태 — 이 상태의 문서만 대상이 된다 */
const ACTION_PRECONDITION: Partial<Record<AiAction, WmsOrderStatus>> = {
  cancel_orders: "SCHEDULED",
  process_orders: "SCHEDULED",
  create_vouchers: "PROCESSED",
};

const MUTATING_ACTIONS: AiAction[] = ["cancel_orders", "process_orders", "create_vouchers"];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PreviewDbRow {
  id: string;
  order_no: string;
  direction: Direction;
  warehouse_name: string;
  partner: string;
  expected_date: string;
  status: WmsOrderStatus;
  item_kinds: number;
  total_expected_qty: number;
}

/** 계획의 필터를 v_wms_orders 쿼리로 변환해 대상을 조회 (dry-run) */
async function queryPlanTargets(
  plan: AiPlan,
): Promise<{ orders: AiPreviewOrder[]; total: number }> {
  const client = getSupabaseServerClient();

  // 변경 액션은 전제 상태를 강제 — LLM이 status를 뭐라 했든 서버가 덮어쓴다
  const forcedStatus = ACTION_PRECONDITION[plan.action];
  const status = forcedStatus ?? (plan.status === "ANY" ? "" : plan.status);

  let q = client
    .from("v_wms_orders")
    .select(
      "id, order_no, direction, warehouse_name, partner, expected_date, status, item_kinds, total_expected_qty",
      { count: "exact" },
    );

  if (plan.direction !== "ANY") q = q.eq("direction", plan.direction);
  if (status) q = q.eq("status", status);
  if (plan.dateFrom) q = q.gte("expected_date", plan.dateFrom);
  if (plan.dateTo) q = q.lte("expected_date", plan.dateTo);
  if (plan.warehouseCode) q = q.eq("warehouse_code", plan.warehouseCode);
  if (plan.partner) {
    const kw = plan.partner.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    q = q.ilike("partner", `%${kw}%`);
  }

  const { data, error, count } = await q
    .order("expected_date", { ascending: false })
    .order("order_no", { ascending: false })
    .limit(AI_MAX_EXECUTE);
  if (error) throw new Error(error.message);

  return {
    orders: (data as PreviewDbRow[]).map((r) => ({
      id: r.id,
      orderNo: r.order_no,
      direction: r.direction,
      warehouseName: r.warehouse_name,
      partner: r.partner,
      expectedDate: r.expected_date,
      status: r.status,
      itemKinds: r.item_kinds,
      totalExpectedQty: r.total_expected_qty,
    })),
    total: count ?? 0,
  };
}

/** 1단계: 자연어 명령 → 계획 + 대상 미리보기 (아무것도 변경하지 않는다) */
export async function planAiCommand(command: string): Promise<AiPreview | { error: string }> {
  const user = await getCurrentUser();

  const trimmed = command.trim();
  if (!trimmed) return { error: "명령을 입력해 주세요." };
  if (trimmed.length > 300) return { error: "명령이 너무 깁니다 (300자 이내)." };

  let plan: AiPlan;
  try {
    const warehouses = await fetchWarehouses(getSupabaseServerClient());
    plan = await parseCommandWithGemini(trimmed, warehouses, todayKey());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "명령 해석에 실패했습니다." };
  }

  if (plan.action === "unsupported") {
    return {
      plan,
      orders: [],
      total: 0,
      executable: false,
      blockedReason:
        plan.unsupportedReason ||
        "지원하지 않는 요청입니다. 조회·예정 취소·일괄 처리·전표 생성만 가능합니다.",
    };
  }

  let targets: { orders: AiPreviewOrder[]; total: number };
  try {
    targets = await queryPlanTargets(plan);
  } catch (error) {
    return { error: `대상 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}` };
  }

  // 실행 가능 여부 판정 — 사유는 그대로 사용자에게 보여준다
  let blockedReason = "";
  if (plan.action === "query_orders") {
    blockedReason = ""; // 조회는 실행 단계가 없다
  } else if (!canMutate(user.role)) {
    blockedReason = "조회 전용 권한으로는 실행할 수 없습니다. 우측 상단에서 권한을 전환해 보세요.";
  } else if (targets.total === 0) {
    blockedReason = "조건에 해당하는 문서가 없습니다.";
  } else if (targets.total > AI_MAX_EXECUTE) {
    blockedReason = `대상이 ${targets.total}건으로 1회 상한(${AI_MAX_EXECUTE}건)을 초과합니다. 기간·창고·거래처 조건을 좁혀 주세요.`;
  }

  return {
    plan,
    orders: targets.orders,
    total: targets.total,
    executable: MUTATING_ACTIONS.includes(plan.action) && blockedReason === "",
    blockedReason,
  };
}

/**
 * 2단계: 사용자가 미리보기를 확인한 뒤 실행.
 * 미리보기의 문서 id 목록을 받아 문서별로 전제 상태를 "다시" 확인하고
 * (미리보기 이후 다른 사용자가 처리했을 수 있다) 기존 RPC로 순차 실행한다.
 */
export async function executeAiPlan(
  action: AiAction,
  orderIds: string[],
): Promise<AiExecutionResult | { error: string }> {
  const user = await getCurrentUser();
  if (!canMutate(user.role)) return { error: "실행 권한이 없습니다 (OPERATOR 이상)." };

  const precondition = ACTION_PRECONDITION[action];
  if (!precondition) return { error: "실행할 수 없는 액션입니다." };
  if (orderIds.length === 0) return { error: "실행 대상이 없습니다." };
  if (orderIds.length > AI_MAX_EXECUTE) {
    return { error: `1회 실행 상한(${AI_MAX_EXECUTE}건)을 초과했습니다.` };
  }

  const client = getSupabaseServerClient();

  // 실행 직전 최신 상태 재조회 — 미리보기 시점과 달라진 문서는 건너뛴다
  const { data, error } = await client
    .from("v_wms_orders")
    .select("id, order_no, status")
    .in("id", orderIds);
  if (error) return { error: `대상 재조회 실패: ${error.message}` };

  const byId = new Map(
    (data as { id: string; order_no: string; status: WmsOrderStatus }[]).map((r) => [r.id, r]),
  );

  const items: AiExecutionItem[] = [];
  for (const orderId of orderIds) {
    const row = byId.get(orderId);
    if (!row) {
      items.push({ orderNo: orderId.slice(0, 8), ok: false, message: "문서를 찾을 수 없습니다" });
      continue;
    }
    if (row.status !== precondition) {
      items.push({
        orderNo: row.order_no,
        ok: false,
        message: `상태가 변경되어 건너뜀 (현재: ${row.status})`,
      });
      continue;
    }

    try {
      if (action === "cancel_orders") {
        await cancelOrder(client, orderId);
        items.push({ orderNo: row.order_no, ok: true, message: "취소 완료" });
      } else if (action === "process_orders") {
        // 예정 수량 그대로 확정 — 수량 조정이 필요하면 처리 화면을 쓰도록 안내
        const lines = await fetchOrderLines(client, orderId);
        await processOrder(
          client,
          orderId,
          lines.map((l) => ({ orderItemId: l.id, qty: l.expectedQty })),
        );
        items.push({ orderNo: row.order_no, ok: true, message: "처리 완료 (재고 반영)" });
      } else {
        const voucherNo = await createVoucher(client, orderId);
        items.push({ orderNo: row.order_no, ok: true, message: `전표 생성: ${voucherNo}` });
      }
    } catch (err) {
      // 개별 실패(재고 부족 등)는 전체를 중단하지 않고 건별로 보고한다
      const msg = err instanceof Error ? err.message.replace(/^[A-Z0-9]+:\s*/, "") : "실패";
      items.push({ orderNo: row.order_no, ok: false, message: msg });
    }
  }

  return {
    items,
    succeeded: items.filter((i) => i.ok).length,
    failed: items.filter((i) => !i.ok).length,
  };
}
