import { Activity, Camera, Dumbbell, LineChart, Share2, Trophy, Utensils } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button";

const FEATURES = [
  { icon: Dumbbell, title: "Log every rep", text: "Fast set entry, rest timer, previous-performance hints and autosave that survives a dead battery." },
  { icon: Trophy, title: "Catch every PR", text: "Max weight, estimated 1RM, volume and reps. Detected automatically, celebrated loudly." },
  { icon: Share2, title: "Share the grind", text: "Publish sessions with photos to followers or the world. You choose exactly what is visible." },
  { icon: Camera, title: "Scan your meal", text: "Snap a photo, review the AI's guess, correct it, and log macros in seconds." },
  { icon: Utensils, title: "Calories that make sense", text: "Mifflin-St Jeor targets, macro splits and daily progress rings that follow your timezone." },
  { icon: LineChart, title: "See the trend", text: "Strength curves, weekly volume, body weight and progress photos kept private by default." },
];

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[640px]" aria-hidden />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Join free
          </ButtonLink>
        </nav>
      </header>

      <main id="main" className="relative mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-12 pb-20 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> The social workout log
            </p>
            <h1 className="display mt-5 text-[clamp(3.5rem,11vw,8rem)]">
              Train hard.
              <br />
              <span className="text-accent">Log smart.</span>
              <br />
              Get lifted.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">Track your lifts, detect personal records, scan your meals with AI and share sessions with a community that actually trains.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register" size="lg">
                Start lifting, it&apos;s free
              </ButtonLink>
              <ButtonLink href="/explore" variant="outline" size="lg">
                Browse the community
              </ButtonLink>
            </div>
          </div>

          {/* Product preview card (decorative) */}
          <div aria-hidden className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-accent/10 blur-3xl" />
            <div className="relative rotate-1 rounded-3xl border border-line bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 font-bold">MR</span>
                <div>
                  <p className="font-semibold">Maya Rahman</p>
                  <p className="text-xs text-subtle">2h ago · Push day</p>
                </div>
                <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">2 PRs</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[["58m", "Time"], ["9.4k", "Volume kg"], ["24", "Sets"]].map(([v, l]) => (
                  <div key={l} className="rounded-xl bg-surface-2 py-3">
                    <p className="display text-3xl">{v}</p>
                    <p className="text-[11px] uppercase tracking-wider text-subtle">{l}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[["Barbell Bench Press", "100 kg × 5"], ["Incline Dumbbell Press", "34 kg × 10"], ["Cable Crossover", "20 kg × 15"]].map(([n, s]) => (
                  <li key={n} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                    <span>{n}</span>
                    <span className="num text-muted">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="features" className="pb-24">
          <h2 id="features" className="display text-5xl sm:text-6xl">
            Everything between <span className="text-accent">warm-up</span> and cool-down
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="display mt-4 text-2xl">{title}</h3>
                <p className="mt-2 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-20 rounded-3xl bg-accent px-8 py-14 text-center text-accent-fg">
          <Activity className="mx-auto h-10 w-10" aria-hidden />
          <h2 className="display mt-3 text-5xl sm:text-6xl">Your next PR starts today</h2>
          <div className="mt-8 flex justify-center">
            <Link href="/register" className="inline-flex h-12 items-center rounded-xl bg-bg px-7 font-semibold text-fg">
              Create your free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-line py-8 text-center text-sm text-subtle">© {new Date().getFullYear()} Lifted. Train responsibly.</footer>
    </div>
  );
}
