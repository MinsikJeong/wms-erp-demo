import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProcessView } from "@/components/wms/process-view";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "출고처리 | ERP",
};

/** 3-3. 출고처리 — 재고 차감이 일어나므로 OPERATOR 이상, 재고 부족 시 DB가 롤백 */
export default async function OutboundProcessPage() {
  const user = await getCurrentUser();
  if (!canMutate(user.role)) redirect("/outbound");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">출고처리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          피킹/패킹 결과로 수량을 확정하면 즉시 창고 재고에서 차감됩니다. 재고가 부족하면 처리가 거부됩니다.
        </p>
      </div>
      <ProcessView direction="OUT" role={user.role} />
    </div>
  );
}
