import type { ReactNode } from "react";
import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 py-8">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" aria-hidden />
      <Logo className="mb-8" />
      <main id="main" className="w-full max-w-md">
        {children}
      </main>
      <p className="mt-8 text-center text-xs text-subtle">By continuing you agree to train responsibly and be kind to other lifters.</p>
    </div>
  );
}
