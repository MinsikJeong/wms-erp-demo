import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProcessView } from "@/components/wms/process-view";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "입고처리 | NewSelect WMS",
};

/** 2-3. 입고처리 — 재고를 변경하므로 OPERATOR 이상만 접근 */
export default async function InboundProcessPage() {
  const user = await getCurrentUser();
  if (!canMutate(user.role)) redirect("/inbound");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          입고처리
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          실물 검수 결과로 수량을 확정하면 즉시 창고 재고에 가산됩니다.
        </p>
      </div>
      <ProcessView direction="IN" role={user.role} />
    </div>
  );
}
