import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrderForm } from "@/components/wms/order-form";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "입고예정 등록 | StockFlow",
};

/** 2-1. 입고예정 등록 — 데이터 변경 화면이므로 OPERATOR 이상만 접근 */
export default async function InboundNewPage() {
  const user = await getCurrentUser();
  if (!canMutate(user.role)) redirect("/inbound");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">입고예정 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">입고될 상품과 수량을 사전 등록해 창고 작업을 준비합니다.</p>
      </div>
      <OrderForm direction="IN" role={user.role} />
    </div>
  );
}
