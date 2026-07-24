import type { Metadata } from "next";
import { AssistantView } from "@/components/ai/assistant-view";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AI 어시스턴트 | WarehouseERP",
};

/**
 * AI 어시스턴트 — 자연어로 입·출고 문서를 조회/일괄 처리하는 전용 화면.
 * "계획(LLM) → 미리보기(dry-run) → 사용자 확인 → 실행(RPC)" 2단계 승인 흐름.
 */
export default async function AssistantPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">AI 어시스턴트</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          자연어로 명령하면 AI가 대상을 찾아 보여주고, 확인 후에만 실행합니다.
        </p>
      </div>
      <AssistantView role={user.role} />
    </div>
  );
}
