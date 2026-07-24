"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { signIn, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = {};

/**
 * 로그인 폼 (이메일 + 비밀번호).
 * useActionState로 서버 액션 `signIn`을 호출 — 성공 시 액션이 대시보드로
 * redirect하고, 실패 시 error 메시지를 상태로 받아 인라인 노출한다.
 */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, INITIAL);

  return (
    <div className="rounded-3xl bg-card p-7 shadow-card">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">로그인</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          사내 계정으로 로그인하세요
        </p>
      </div>

      <form action={formAction} className="space-y-4">
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
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="h-12 text-[15px]"
          />
        </div>

        {/* 인증 실패 안내 */}
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
          {isPending ? "로그인 중…" : "로그인"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        계정이 없으신가요?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}
