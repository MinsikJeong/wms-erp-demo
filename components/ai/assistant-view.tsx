"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CornerDownLeft,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { executeAiPlan, planAiCommand } from "@/app/ai/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/wms/status-badge";
import {
  AI_ACTION_LABELS,
  AI_MAX_EXECUTE,
  type AiExecutionResult,
  type AiPreview,
} from "@/lib/ai/types";
import { wmsKeys } from "@/lib/wms/api";
import type { UserRole } from "@/lib/types";
import { cn, num } from "@/lib/utils";

/** 채용 담당자가 바로 눌러볼 수 있는 예시 명령 */
const EXAMPLES = [
  "오늘 입고예정 중 부산 남부센터의 골드서플라이 건 취소해줘",
  "이번 주 출고예정 건 보여줘",
  "처리 완료된 입고 건 전표 일괄 생성해줘",
  "인천 제1물류센터 오늘 입고예정 전부 처리해줘",
];

/**
 * AI 어시스턴트 화면 (클라이언트).
 *
 * 2단계 승인 흐름 — ① 명령 → 계획+대상 미리보기(dry-run, 변경 없음)
 * ② 사용자가 [실행] 버튼을 눌러야 서버가 권한·상태를 재검증 후 RPC 실행.
 * 실행 후에는 TanStack Query 캐시를 무효화해 모든 목록·대시보드가 갱신된다.
 */
export function AssistantView({ role }: { role: UserRole }) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("");
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [result, setResult] = useState<AiExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPlanning, startPlanning] = useTransition();
  const [isExecuting, startExecuting] = useTransition();

  const submitCommand = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isPlanning) return;
    setPreview(null);
    setResult(null);
    setErrorMsg("");
    startPlanning(async () => {
      const res = await planAiCommand(trimmed);
      if ("error" in res) setErrorMsg(res.error);
      else setPreview(res);
    });
  };

  const runPlan = () => {
    if (!preview || !preview.executable || isExecuting) return;
    startExecuting(async () => {
      const res = await executeAiPlan(
        preview.plan.action,
        preview.orders.map((o) => o.id),
      );
      if ("error" in res) {
        setErrorMsg(res.error);
        return;
      }
      setResult(res);
      setPreview(null);
      // 취소/처리/전표로 목록·재고·대시보드가 모두 변했을 수 있다
      queryClient.invalidateQueries({ queryKey: wmsKeys.all });
      if (res.failed === 0) toast.success(`${res.succeeded}건 실행 완료`);
      else toast.warning(`${res.succeeded}건 성공 · ${res.failed}건 실패/건너뜀`);
    });
  };

  const conditionChips = preview
    ? [
        preview.plan.direction !== "ANY" && (preview.plan.direction === "IN" ? "입고" : "출고"),
        preview.plan.dateFrom &&
          (preview.plan.dateFrom === preview.plan.dateTo
            ? preview.plan.dateFrom
            : `${preview.plan.dateFrom} ~ ${preview.plan.dateTo || ""}`),
        preview.plan.warehouseCode && `창고 ${preview.plan.warehouseCode}`,
        preview.plan.partner && `거래처 "${preview.plan.partner}"`,
      ].filter((c): c is string => Boolean(c))
    : [];

  return (
    <div className="max-w-4xl space-y-4">
      {/* ---------- 명령 입력 ---------- */}
      <Card>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCommand(command);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Sparkles
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary"
                aria-hidden
              />
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="예: 오늘 입고예정 중 부산 남부센터의 골드서플라이 건 취소해줘"
                className="h-10 pl-9"
                maxLength={300}
                aria-label="AI 명령 입력"
              />
            </div>
            <Button type="submit" disabled={isPlanning || !command.trim()} className="h-10">
              {isPlanning ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <CornerDownLeft aria-hidden />
              )}
              분석
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setCommand(example);
                  submitCommand(example);
                }}
                className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {errorMsg && (
        <Card className="ring-red-200">
          <CardContent className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="size-4 shrink-0" aria-hidden />
            {errorMsg}
          </CardContent>
        </Card>
      )}

      {/* ---------- 미리보기 (dry-run) ---------- */}
      {preview && (
        <Card className={cn(preview.executable && "ring-primary/40")}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>{AI_ACTION_LABELS[preview.plan.action]}</Badge>
              대상 {num.format(preview.total)}건
            </CardTitle>
            <CardDescription>{preview.plan.explanation}</CardDescription>
            {conditionChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {conditionChips.map((chip) => (
                  <Badge key={chip} variant="outline">
                    {chip}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.orders.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-140">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs">문서번호</TableHead>
                      <TableHead className="text-xs">창고</TableHead>
                      <TableHead className="text-xs">거래처</TableHead>
                      <TableHead className="text-xs">예정일</TableHead>
                      <TableHead className="text-right text-xs">수량</TableHead>
                      <TableHead className="text-xs">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-foreground">
                          {order.orderNo}
                        </TableCell>
                        <TableCell>{order.warehouseName}</TableCell>
                        <TableCell>{order.partner}</TableCell>
                        <TableCell className="tabular-nums">{order.expectedDate}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {num.format(order.totalExpectedQty)}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} direction={order.direction} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {preview.blockedReason ? (
              <p className="text-sm text-amber-700">{preview.blockedReason}</p>
            ) : preview.executable ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  위 목록을 확인하세요. 실행 전에는 아무것도 변경되지 않습니다.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPreview(null)} disabled={isExecuting}>
                    취소
                  </Button>
                  <Button onClick={runPlan} disabled={isExecuting}>
                    {isExecuting && <Loader2 className="animate-spin" aria-hidden />}
                    {AI_ACTION_LABELS[preview.plan.action]} 실행 ({preview.orders.length}건)
                  </Button>
                </div>
              </div>
            ) : (
              // query_orders — 조회 결과 자체가 답
              <p className="text-xs text-muted-foreground">
                조회 결과입니다. 처리·취소가 필요하면 명령에 동작을 포함해 보세요.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------- 실행 결과 ---------- */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              실행 결과 — 성공 {result.succeeded}건
              {result.failed > 0 && ` · 실패/건너뜀 ${result.failed}건`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {result.items.map((item) => (
                <li key={`${item.orderNo}-${item.message}`} className="flex items-center gap-2 text-sm">
                  {item.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" aria-hidden />
                  )}
                  <span className="font-medium text-foreground">{item.orderNo}</span>
                  <span className="text-muted-foreground">{item.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ---------- 안전장치 안내 ---------- */}
      <Card size="sm" className="bg-muted/30">
        <CardContent className="flex gap-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-foreground">안전장치</p>
            <p>
              AI는 명령을 해석해 계획만 세웁니다 — 실제 변경은 미리보기를 확인하고 실행 버튼을
              누른 뒤에만, 검증된 DB 프로시저를 통해 수행됩니다. 실행 시점에 권한(운영자 이상)과
              문서 상태를 다시 확인하며, 1회 최대 {AI_MAX_EXECUTE}건까지만 처리합니다.
              {role === "VIEWER" && " 현재 조회 전용 권한이라 조회 명령만 사용할 수 있습니다."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
