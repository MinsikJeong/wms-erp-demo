import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PickingView } from "@/components/wms/picking-view";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "출고피킹 | WarehouseERP",
};

/** 3-2b. 출고피킹 — 출고예정 등록과 출고처리 사이 단계, OPERATOR 이상 */
export default async function OutboundPickingPage() {
  const user = await getCurrentUser();
  if (!canMutate(user.role)) redirect("/outbound");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">출고피킹</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          출고예정 문서의 품목을 존(로케이션) 동선 순서로 확인하고 실물 피킹 수량을 기록합니다. 저장한 수량은 출고처리
          확정수량의 기본값으로 이어집니다.
        </p>
      </div>
      <PickingView role={user.role} />
    </div>
  );
}
