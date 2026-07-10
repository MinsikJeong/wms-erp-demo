import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, DatabaseZap, Scale } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCards } from "@/components/reconciliation/metric-cards";
import { getCurrentUser } from "@/lib/auth";
import { fetchReconSummary } from "@/lib/recon";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "대시보드 | NewSelect FIS",
};

/**
 * 메인 대시보드 (서버 컴포넌트).
 * 출근 직후 확인하는 "오늘의 재무 리스크 요약" 화면.
 * 요약만 필요하므로 TanStack Query 하이드레이션 없이 RSC에서 직접 조회하고,
 * 테이블 미생성 등 조회 실패 시 초기 세팅 안내로 대체한다.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  let summary = null;
  try {
    // 집계는 DB RPC가 1회 계산 — 행 전체를 서버로 가져오지 않는다
    summary = await fetchReconSummary(getSupabaseServerClient());
  } catch {
    // 조회 실패(테이블/함수 미생성 포함) — 아래에서 안내 카드로 분기
  }

  const openIssues = summary
    ? summary.mismatchCount + summary.duplicatedCount + summary.missingCount
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          대시보드
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary ? (
            <>
              {user.name}님, 오늘 확인이 필요한 대사 이슈가{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                {openIssues}건
              </span>{" "}
              있습니다.
            </>
          ) : (
            <>{user.name}님, 환영합니다.</>
          )}
        </p>
      </div>

      {summary ? (
        <MetricCards summary={summary} role={user.role} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseZap className="size-5 text-amber-500" aria-hidden />
              데이터베이스 초기화가 필요합니다
            </CardTitle>
            <CardDescription>
              Supabase Dashboard → SQL Editor에서 프로젝트의{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                supabase/seed.sql
              </code>{" "}
              내용을 1회 실행하면 대사 데이터가 준비됩니다.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-muted-foreground" aria-hidden />
            정산 대사 바로가기
          </CardTitle>
          <CardDescription>
            OMS · WMS · PG 3개 시스템의 데이터를 건별로 대조하고, 불일치 건을
            필터링해 엑셀로 내려받을 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/reconciliation"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            대사 화면으로 이동
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
