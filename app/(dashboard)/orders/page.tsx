import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "주문/출고 조회 | NewSelect FIS",
};

/**
 * OMS/WMS 통합 조회 (확장 예정 세그먼트).
 * 주문 상세는 `orders/[orderNo]` 동적 라우트로 확장한다.
 */
export default function OrdersPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <PackageSearch className="h-10 w-10 text-zinc-300" aria-hidden />
      <h1 className="text-lg font-semibold text-zinc-900">주문/출고 조회</h1>
      <p className="max-w-md text-sm text-zinc-500">
        OMS 주문과 WMS 출고·반품 이력을 통합 조회하는 화면입니다. (데모
        범위에서는 정산 대사 화면에 집중했습니다.)
      </p>
    </div>
  );
}
