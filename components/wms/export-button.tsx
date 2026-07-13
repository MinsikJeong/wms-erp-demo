"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExportResult } from "@/lib/export";
import { cn, num } from "@/lib/utils";

/**
 * 엑셀 내보내기 버튼 (목록 화면 공용).
 *
 * onExport가 "현재 필터 조건 전체 조회 → xlsx 다운로드"를 수행한다.
 * 다중 청크 조회라 수 초 걸릴 수 있어 진행 중 스피너 + 중복 클릭 방지,
 * 완료/상한 초과/실패를 토스트로 피드백한다.
 */
export function ExportButton({
  onExport,
  className,
}: {
  onExport: () => Promise<ExportResult>;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const result = await onExport();
      if (result.exported === 0) {
        toast.info("내보낼 데이터가 없습니다. 필터 조건을 확인하세요.");
      } else if (result.truncated) {
        toast.warning(
          `상위 ${num.format(result.exported)}행만 내보냈습니다 (조건 전체 ${num.format(result.total)}행)`,
          { description: "필터로 범위를 좁혀 다시 내보내세요." },
        );
      } else {
        toast.success(`${num.format(result.exported)}행 엑셀 내보내기 완료`);
      }
    } catch (error) {
      toast.error(
        `엑셀 내보내기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className={cn("gap-1.5", className)}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <FileSpreadsheet className="text-emerald-600" aria-hidden />
      )}
      엑셀
    </Button>
  );
}
