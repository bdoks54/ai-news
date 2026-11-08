"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

// 루트 레이아웃은 페이지 이동 시 다시 렌더링되지 않으므로,
// 로그인 상태 변화에 바로 반응하도록 클라이언트에서 Clerk 세션을 읽는다.
export default function HeaderNav() {
  return (
    <Show when="signed-in">
      <nav className="flex items-center gap-4 text-sm text-slate-600">
        <Link href="/" className="hover:text-slate-900">뉴스</Link>
        <Link href="/categories" className="hover:text-slate-900">카테고리</Link>
        <Link href="/settings" className="hover:text-slate-900">설정</Link>
        <UserButton />
      </nav>
    </Show>
  );
}
