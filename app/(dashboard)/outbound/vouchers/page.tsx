import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VoucherView } from "@/components/wms/voucher-view";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "ERP 전표생성(출고) | StockFlow",
};

/** 3-4. ERP 전표생성(출고=매출) — OPERATOR 이상 */
export default async function OutboundVouchersPage() {
  const user = await getCurrentUser();
  if (!canMutate(user.role)) redirect("/outbound");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">ERP 전표생성 (출고)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          출고 처리 완료 문서의 매출 금액을 집계해 ERP 회계 전표를 발행합니다.
        </p>
      </div>
      <VoucherView direction="OUT" role={user.role} />
    </div>
  );
}
