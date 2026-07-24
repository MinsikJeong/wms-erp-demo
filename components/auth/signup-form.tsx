"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Eye, Loader2, ShieldCheck, Wrench } from "lucide-react";
import { signUp, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserRole } from "@/lib/types";

const INITIAL: AuthState = {};

/** 데모 역할 선택지 — 가입 시 고른 권한이 계정(user_metadata)에 고정된다 */
const ROLE_OPTIONS: { value: UserRole; label: string; caption: string; icon: typeof ShieldCheck }[] = [
  { value: "ADMIN", label: "관리자", caption: "모든 메뉴 + 사용자 관리", icon: ShieldCheck },
  { value: "OPERATOR", label: "운영자", caption: "입·출고 처리 및 전표 생성", icon: Wrench },
  { value: "VIEWER", label: "조회 전용", caption: "조회만 가능 · 금액 마스킹", icon: Eye },
];

/**
 * 회원가입 폼 (이메일 + 비밀번호 + 역할 선택).
 * 역할은 native radio로 받아 서버 액션 `signUp`이 user_metadata에 저장한다 —
 * 채용 담당자가 원하는 권한으로 가입해 RBAC 화면을 체험할 수 있게 하는 데모 장치.
 */
export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signUp, INITIAL);

  return (
    <div className="rounded-3xl bg-card p-7 shadow-card">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">회원가입</h1>
        <p className="mt-1 text-sm text-muted-foreground">권한을 선택해 계정을 만드세요</p>
      </div>

      <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">
              이름 <span className="font-normal text-muted-foreground/60">(선택)</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="홍길동"
              className="h-12 text-[15px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
              이메일
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              required
              className="h-12 text-[15px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">
              비밀번호
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="6자 이상"
              minLength={6}
              required
              className="h-12 text-[15px]"
            />
          </div>

          {/* 역할 선택 (native radio + peer 스타일) */}
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">권한</legend>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option, i) => (
                <label key={option.value} className="block cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    defaultChecked={i === 0}
                    className="peer sr-only"
                  />
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors peer-checked:border-primary peer-checked:bg-accent peer-focus-visible:ring-3 peer-focus-visible:ring-ring/30">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <option.icon className="size-4.5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">{option.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{option.caption}</span>
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{state.error}</span>
            </div>
          )}

          <Button type="submit" disabled={isPending} className="h-12 w-full text-[15px]">
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isPending ? "가입 중…" : "가입하고 시작하기"}
          </Button>
        </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
