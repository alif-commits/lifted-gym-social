import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <h1 className="display text-6xl">404</h1>
      <p className="text-muted">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <ButtonLink href="/feed">Back to the feed</ButtonLink>
    </main>
  );
}
