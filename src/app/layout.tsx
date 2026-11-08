import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { koKR } from "@clerk/localizations";
import HeaderNav from "@/components/HeaderNav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI 뉴스 수집기",
  description: "해외 AI 뉴스를 한국어로 요약해 카드로 보여줍니다.",
};

function Loading() {
  return (
    <div className="flex justify-center py-20">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider localization={koKR}>
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="font-bold text-slate-900">
                AI 뉴스 수집기
              </Link>
              <HeaderNav />
            </div>
          </header>
          {/* 사용자별 데이터(로그인 정보, DB)를 읽는 페이지는 요청 시점에 렌더링된다. */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            <Suspense fallback={<Loading />}>{children}</Suspense>
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
