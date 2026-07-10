import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCards } from "@/components/reconciliation/metric-cards";
import { getCurrentUser } from "@/lib/auth";
import { fetchReconciliationRows, summarize } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "대시보드 | NewSelect FIS",
};

/**
 * 메인 대시보드 (서버 컴포넌트).
 * 출근 직후 확인하는 "오늘의 재무 리스크 요약" 화면.
 * 대사 요약 지표를 재사용(MetricCards)하고 상세 화면으로 유도한다.
 */
export default async function DashboardPage() {
  const [user, rows] = await Promise.all([
    getCurrentUser(),
    fetchReconciliationRows(),
  ]);
  const summary = summarize(rows);
  const openIssues =
    summary.mismatchCount + summary.duplicatedCount + summary.missingCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          대시보드
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {user.name}님, 오늘 확인이 필요한 대사 이슈가{" "}
          <span className="font-semibold text-red-600">{openIssues}건</span>{" "}
          있습니다.
        </p>
      </div>

      <MetricCards summary={summary} role={user.role} />

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Scale className="h-4 w-4 text-zinc-400" aria-hidden />
          <CardTitle>정산 대사 바로가기</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600">
            OMS · WMS · PG 3개 시스템의 데이터를 건별로 대조하고, 불일치
            건을 필터링해 엑셀로 내려받을 수 있습니다.
          </p>
          <Link
            href="/reconciliation"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-900 underline-offset-4 hover:underline"
          >
            대사 화면으로 이동
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
