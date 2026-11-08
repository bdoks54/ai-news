import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">AI 뉴스 수집기</h1>
        <p className="mt-1 text-sm text-slate-500">해외 AI 뉴스를 한국어 요약으로 받아보세요.</p>
      </div>
      <SignIn />
    </div>
  );
}
