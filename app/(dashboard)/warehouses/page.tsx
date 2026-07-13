import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, DatabaseZap, Warehouse as WarehouseIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WarehouseMapPanel } from "@/components/wms/warehouse-map-panel";
import { getCurrentUser } from "@/lib/auth";
import { fetchWarehouses } from "@/lib/wms/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Warehouse } from "@/lib/wms/types";

export const metadata: Metadata = {
  title: "창고관리 | StockFlow",
};

/**
 * 1. 창고관리 (서버 컴포넌트).
 * 창고 마스터는 소량이라 페이지네이션 없이 RSC에서 직접 조회한다.
 */
export default async function WarehousesPage() {
  const user = await getCurrentUser();
  let warehouses: Warehouse[] | null = null;
  try {
    warehouses = await fetchWarehouses(getSupabaseServerClient());
  } catch {
    // 스키마 미생성 — 아래 안내 카드로 분기
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">창고관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">물류 거점(자사·풀필먼트 센터) 마스터 정보를 관리합니다.</p>
      </div>

      {/* 전국 거점 지도 — 마커 팝업에 재고 요약 + 상세 링크 */}
      <WarehouseMapPanel role={user.role} />

      {warehouses === null ? (
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseZap className="size-5 text-amber-500" aria-hidden />
              데이터베이스 초기화가 필요합니다
            </CardTitle>
            <CardDescription>
              Supabase Dashboard → SQL Editor에서{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/wms-seed.sql</code>을 1회 실행한 뒤
              새로고침하세요.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <Table className="min-w-160">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs">창고코드</TableHead>
                <TableHead className="text-xs">창고명</TableHead>
                <TableHead className="text-xs">소재지</TableHead>
                <TableHead className="text-xs">상태</TableHead>
                <TableHead className="text-xs">재고 보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((warehouse) => (
                <TableRow key={warehouse.id}>
                  <TableCell className="font-medium text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <WarehouseIcon className="size-4 text-muted-foreground" aria-hidden />
                      {warehouse.code}
                    </span>
                  </TableCell>
                  <TableCell>{warehouse.name}</TableCell>
                  <TableCell className="text-muted-foreground">{warehouse.location}</TableCell>
                  <TableCell>
                    <Badge variant={warehouse.isActive ? "success" : "outline"}>
                      {warehouse.isActive ? "운영중" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href="/inventory/warehouse"
                      className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      창고별 재고
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
