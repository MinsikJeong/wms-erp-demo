import "server-only";

import { cache } from "react";
import type { SessionUser } from "@/lib/types";

/**
 * 세션 사용자 조회 (서버 전용).
 *
 * 이 데모는 인증 없이 항상 관리자(ADMIN) 세션으로 동작한다 — 모든 메뉴·페이지
 * 가드·금액 조회가 열려 있어 전 기능을 제약 없이 사용할 수 있다.
 * 실제 환경에서는 이 함수만 IdP(SSO)/세션 스토어 연동으로 교체하면
 * 레이아웃·페이지의 RBAC 분기 로직은 그대로 재사용된다.
 *
 * React `cache()`로 감싸 한 요청 안에서 여러 번 호출해도 1회만 평가된다.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  return {
    id: "emp-20240627",
    name: "정민식",
    email: "minsik.jeong@minsigi.co.kr",
    department: "관리팀",
    role: "ADMIN",
  };
});
