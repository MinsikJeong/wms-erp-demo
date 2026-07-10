import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "매출/정산 조회 | NewSelect FIS",
};

/**
 * 매출/정산 조회 (OPERATOR 이상 전용).
 * 사이드바에서 메뉴를 숨기는 것과 별개로, URL 직접 접근을 막는
 * 서버 사이드 가드를 페이지 레벨에 둔다 (클라이언트 은닉은 방어선이 아니다).
 */
export default async function SettlementsPage() {
  const user = await getCurrentUser();
  if (!hasRole(user.role, "OPERATOR")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <Wallet className="h-10 w-10 text-zinc-300" aria-hidden />
      <h1 className="text-lg font-semibold text-zinc-900">매출/정산 조회</h1>
      <p className="max-w-md text-sm text-zinc-500">
        채널별 매출과 PG사 정산 내역을 기간·채널 축으로 조회하는 화면입니다.
        (확장 예정)
      </p>
    </div>
  );
}
