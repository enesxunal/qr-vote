import { Suspense } from "react";
import VotingPage from "@/components/VotingPage";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh w-full bg-[#070708] text-zinc-50">
          <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center justify-center px-4">
            <div className="h-2 w-2 rounded-full bg-[#d6be86]" />
          </div>
        </div>
      }
    >
      <VotingPage />
    </Suspense>
  );
}
