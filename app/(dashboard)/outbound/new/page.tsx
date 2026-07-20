import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrderForm } from "@/components/wms/order-form";
import { getCurrentUser } from "@/lib/auth";
import { canMutate } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "출고예정 등록 | StockFlow",
};

/** 3-1. 출고예정 등록 — OPERATOR 이상 */
export default async function OutboundNewPage() {
  const user = await getCurrentUser();
  if (!canMutate(user.role)) redirect("/outbound");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">출고예정 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          출고될 상품과 수량을 사전 등록합니다. 등록 후에는 출고피킹 메뉴에서 존별
          동선에 맞춰 실물 피킹을 진행하세요.
        </p>
      </div>
      <OrderForm direction="OUT" role={user.role} />
    </div>
  );
}
