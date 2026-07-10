import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth";

/**
 * 인트라넷 공통 레이아웃 (서버 컴포넌트, `(dashboard)` 라우트 그룹 전용).
 *
 * - 세션 조회(`getCurrentUser`)는 서버에서 수행 → 권한 정보가 소스 코드/네트워크에
 *   노출되지 않고, 클라이언트에는 판정에 필요한 `role`만 내려간다.
 * - 사이드바(활성 메뉴 하이라이트)만 클라이언트 컴포넌트로 분리해
 *   레이아웃 자체는 RSC로 유지한다.
 * - 페이지 콘텐츠 영역만 스크롤되도록 해 헤더/사이드바를 고정한다.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-100">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
