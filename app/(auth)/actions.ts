"use server";

import { redirect } from "next/navigation";
import { getSupabaseAuthClient } from "@/lib/supabase/auth-server";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["ADMIN", "OPERATOR", "VIEWER"];

/** useActionState 계약 — 실패 시 화면에 노출할 에러 메시지를 담아 반환한다 */
export interface AuthState {
  error?: string;
}

/** Supabase 인증 에러 코드를 사용자 친화적인 한국어 메시지로 매핑 */
function toKoreanAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("email not confirmed"))
    return "이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해 주세요.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (m.includes("password should be at least"))
    return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("unable to validate email") || m.includes("invalid format"))
    return "이메일 형식이 올바르지 않습니다.";
  return message || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 로그인 (이메일 + 비밀번호).
 * 성공 시 세션 쿠키가 설정되고 대시보드로 redirect한다.
 * redirect()는 내부적으로 예외를 던지므로 try/catch 밖에서 호출한다.
 */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 모두 입력해 주세요." };
  }

  const supabase = await getSupabaseAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: toKoreanAuthError(error.message) };
  }

  redirect("/dashboard");
}

/**
 * 회원가입 (이메일 + 비밀번호 + 역할 선택).
 *
 * 선택한 역할·이름은 user_metadata에 저장되어 로그인 후 RBAC 분기의 기준이 된다.
 * (데모 목적 — 실서비스라면 역할은 클라이언트 입력이 아닌 서버 정책으로 부여한다.)
 *
 * Supabase에서 "Confirm email"을 꺼둔 전제 — 가입 즉시 세션이 발급되어
 * 대시보드로 진입한다. (예외적으로 세션이 없으면 로그인 화면으로 유도한다.)
 */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "").toUpperCase();
  const role: UserRole = VALID_ROLES.includes(roleInput as UserRole)
    ? (roleInput as UserRole)
    : "VIEWER";

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 모두 입력해 주세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const supabase = await getSupabaseAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, name: name || email.split("@")[0], department: "FIS팀" },
    },
  });

  if (error) {
    return { error: toKoreanAuthError(error.message) };
  }

  // 이메일 확인이 꺼져 있어 가입 즉시 세션이 발급된다 → 대시보드로.
  // 만일의 경우 세션이 없으면 로그인 화면으로 안전하게 유도한다.
  if (!data.session) {
    redirect("/login");
  }
  redirect("/dashboard");
}

/** 로그아웃 — 세션을 파기하고 로그인 화면으로 보낸다 */
export async function signOut(): Promise<void> {
  const supabase = await getSupabaseAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
