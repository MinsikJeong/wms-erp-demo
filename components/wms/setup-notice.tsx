"use client";

import { DatabaseZap, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** 테이블/뷰/함수 미생성 계열의 에러인지 판별 */
export function isSetupError(message: string): boolean {
  return /PGRST205|PGRST202|42P01|42703/.test(message);
}

/**
 * DB 미초기화 안내 카드.
 * WMS 스키마(supabase/wms-seed.sql)가 아직 실행되지 않았을 때 모든 목록
 * 화면에서 동일한 안내를 보여준다.
 */
export function SetupNotice({
  error,
  onRetry,
  retrying,
}: {
  error: Error;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const setup = isSetupError(error.message);
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="size-5 text-amber-500" aria-hidden />
          {setup ? "데이터베이스 초기화가 필요합니다" : "데이터 조회 실패"}
        </CardTitle>
        <CardDescription>
          {setup ? (
            <>
              <span className="font-medium text-foreground">
                Supabase Dashboard → SQL Editor
              </span>
              에서 프로젝트의{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                supabase/wms-seed.sql
              </code>{" "}
              내용을 붙여넣고 1회 실행한 뒤 아래 버튼으로 다시 불러오세요.
            </>
          ) : (
            `조회 중 오류가 발생했습니다: ${error.message}`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          <RefreshCcw className={retrying ? "animate-spin" : undefined} aria-hidden />
          다시 불러오기
        </Button>
      </CardContent>
    </Card>
  );
}
