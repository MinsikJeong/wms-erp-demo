import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUser } from "@/lib/auth";

/**
 * 인트라넷 공통 레이아웃 (서버 컴포넌트, `(dashboard)` 라우트 그룹 전용).
 *
 * - 세션 조회(`getCurrentUser`)는 서버에서 수행 → 클라이언트에는 판정에
 *   필요한 최소 정보(role, 프로필)만 내려간다.
 * - 반응형: lg 이상은 고정 사이드바, lg 미만은 헤더 햄버거 → Sheet 내비게이션.
 * - 페이지 콘텐츠 영역만 스크롤되도록 해 헤더/사이드바를 고정한다.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
