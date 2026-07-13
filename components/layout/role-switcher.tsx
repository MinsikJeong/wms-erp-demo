"use client";

import { Eye, ShieldCheck, Wrench } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { setDemoRole } from "@/app/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: { value: UserRole; label: string; caption: string; icon: typeof ShieldCheck }[] = [
  { value: "ADMIN", label: "관리자", caption: "모든 메뉴 + 사용자 관리", icon: ShieldCheck },
  { value: "OPERATOR", label: "운영자", caption: "입·출고 처리 및 전표 생성", icon: Wrench },
  { value: "VIEWER", label: "조회 전용", caption: "조회만 가능 · 금액 마스킹", icon: Eye },
];

/**
 * 데모 권한 스위처 (클라이언트 컴포넌트).
 *
 * 채용 담당자가 RBAC 동작(메뉴 노출·금액 마스킹·페이지 가드)을 즉석에서
 * 체험할 수 있도록 헤더에 상시 노출한다. 선택 시 Server Action이 쿠키를
 * 교체하고 현재 라우트가 자동 리렌더된다 — transition pending 동안은
 * 트리거를 흐리게 처리해 전환 중임을 알린다.
 */
export function RoleSwitcher({ role }: { role: UserRole }) {
  const [isPending, startTransition] = useTransition();
  const current = ROLE_OPTIONS.find((o) => o.value === role) ?? ROLE_OPTIONS[0];

  const handleChange = (next: string) => {
    if (next === role) return;
    startTransition(async () => {
      await setDemoRole(next);
      const selected = ROLE_OPTIONS.find((o) => o.value === next);
      toast.success(`${selected?.label ?? next} 권한으로 전환했습니다`, {
        description: selected?.caption,
      });
    });
  };

  return (
    <Select value={role} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        aria-label="데모 권한 전환"
        className={cn("bg-card transition-opacity", isPending && "pointer-events-none opacity-60")}
      >
        {/* 트리거에는 아이콘+라벨만 — 설명(caption)은 드롭다운 목록에서만 보인다 */}
        <SelectValue>
          <current.icon className="size-4 text-primary" aria-hidden />
          <span className="font-medium">{current.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {ROLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <option.icon className="size-4 text-muted-foreground" aria-hidden />
            <span className="font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.caption}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
