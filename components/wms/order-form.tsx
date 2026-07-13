"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ItemCombobox } from "@/components/wms/item-combobox";
import { useCreateOrder, useWarehouses } from "@/hooks/use-wms";
import { maskAmount } from "@/lib/rbac";
import type { Direction, Item } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { krw, num } from "@/lib/utils";

/**
 * 입고예정 / 출고예정 등록 폼.
 *
 * 창고·거래처·예정일 + 품목 라인(품목 선택, 수량)을 입력해
 * wms_create_order RPC로 등록한다. 성공 시 현황 화면으로 이동.
 * 검증(수량>0, 라인≥1, 거래처 필수)은 클라이언트와 DB 양쪽에서 수행한다.
 *
 * 품목은 서버 검색 콤보박스로 선택한다 — 마스터 전량을 로드하지 않으므로
 * 단가·요약 계산에 필요한 품목 정보는 선택 시점에 라인에 함께 보관한다.
 */

interface FormLine {
  /** React key용 로컬 id */
  key: number;
  /** 콤보박스에서 선택된 품목 전체 (단가·요약 계산용, null = 미선택) */
  item: Item | null;
  qty: string;
}

let lineKeySeq = 0;
const newLine = (): FormLine => ({ key: ++lineKeySeq, item: null, qty: "" });

export function OrderForm({
  direction,
  role,
}: {
  direction: Direction;
  role: UserRole;
}) {
  const router = useRouter();
  const { data: warehouses } = useWarehouses();
  const createMutation = useCreateOrder();

  const isIn = direction === "IN";
  const [warehouseId, setWarehouseId] = useState("");
  const [partner, setPartner] = useState("");
  const [expectedDate, setExpectedDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<FormLine[]>([newLine()]);

  const updateLine = (key: number, patch: Partial<FormLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const parsedLines = lines
    .filter((l): l is FormLine & { item: Item } => l.item !== null)
    .map((l) => ({ item: l.item, qty: Number.parseInt(l.qty, 10) }));
  const linesValid =
    parsedLines.length > 0 &&
    parsedLines.every((l) => Number.isInteger(l.qty) && l.qty > 0);
  const formValid =
    warehouseId !== "" && partner.trim() !== "" && expectedDate !== "" && linesValid;

  /** 예상 금액 합계 — 참고용 (확정 금액은 처리 수량 기준으로 전표에서 계산) */
  const estimatedTotal = parsedLines.reduce(
    (sum, l) => sum + (Number.isInteger(l.qty) ? l.item.unitPrice * l.qty : 0),
    0,
  );

  const handleSubmit = () => {
    if (!formValid) return;
    createMutation.mutate(
      {
        direction,
        warehouseId,
        partner,
        expectedDate,
        memo,
        lines: parsedLines.map((l) => ({ itemId: l.item.id, qty: l.qty })),
      },
      { onSuccess: () => router.push(isIn ? "/inbound" : "/outbound") },
    );
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{isIn ? "입고예정 등록" : "출고예정 등록"}</CardTitle>
        <CardDescription>
          {isIn
            ? "공급처로부터 입고될 상품과 수량을 사전 등록합니다. 실물 도착 후 입고처리에서 수량을 확정하세요."
            : "출고처(판매채널·거래처)로 나갈 상품과 수량을 사전 등록합니다. 피킹/패킹 완료 후 출고처리에서 수량을 확정하세요."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ---------- 기본 정보 ---------- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>창고 *</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="창고 선택" />
              </SelectTrigger>
              <SelectContent>
                {(warehouses ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="partner">{isIn ? "공급처 *" : "출고처 *"}</Label>
            <Input
              id="partner"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder={isIn ? "예: (주)한빛유통" : "예: 쿠팡"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expected-date">{isIn ? "입고 예정일 *" : "출고 예정일 *"}</Label>
            <Input
              id="expected-date"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">메모</Label>
            <Input
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="선택 입력"
            />
          </div>
        </div>

        {/* ---------- 품목 라인 ---------- */}
        <div className="space-y-2">
          <Label>품목 *</Label>
          <div className="space-y-2">
            {lines.map((line) => {
              const item = line.item;
              return (
                <div key={line.key} className="flex flex-wrap items-center gap-2">
                  <ItemCombobox
                    selected={line.item}
                    onSelect={(picked) => updateLine(line.key, { item: picked })}
                  />
                  <Input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                    placeholder="수량"
                    className="w-24 text-right tabular-nums"
                    aria-label="수량"
                  />
                  {/* 단가는 민감 정보 → VIEWER 마스킹 (등록 자체는 OPERATOR 이상) */}
                  <span className="w-28 text-right text-xs tabular-nums text-muted-foreground">
                    {item ? maskAmount(krw.format(item.unitPrice), role) : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setLines((prev) =>
                        prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev,
                      )
                    }
                    disabled={lines.length <= 1}
                    aria-label="라인 삭제"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLines((prev) => [...prev, newLine()])}
          >
            <Plus aria-hidden />
            품목 추가
          </Button>
        </div>

        {/* ---------- 요약 + 제출 ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            총 {num.format(parsedLines.length)}개 품목 · 예상 금액{" "}
            <span className="font-semibold text-foreground">
              {maskAmount(krw.format(estimatedTotal), role)}
            </span>
          </p>
          <Button onClick={handleSubmit} disabled={!formValid || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {isIn ? "입고예정 등록" : "출고예정 등록"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
