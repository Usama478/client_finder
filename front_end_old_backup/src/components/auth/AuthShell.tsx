import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Moon, ShieldCheck, Sparkles, Sun } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useTheme } from "../../app/theme";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  helper?: ReactNode;
}

const productHighlights = [
  "Guide businesses from search to validation with a single workflow.",
  "Keep saved clients, contexts, and pipeline history in one place.",
  "Ship frontend-first SaaS surfaces now while backend contracts catch up.",
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  helper,
}: AuthShellProps) {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_48%,_#f8fafc_100%)] px-6 py-8 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,_#09090b_0%,_#111827_48%,_#09090b_100%)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col rounded-[32px] border border-white/70 bg-white/80 shadow-2xl shadow-blue-100/30 backdrop-blur dark:border-white/10 dark:bg-zinc-950/80 dark:shadow-black/30 lg:grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden overflow-hidden rounded-l-[32px] bg-slate-950 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.32),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.3),_transparent_28%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-100">
              <Sparkles className="h-4 w-4" />
              Frontend migration, Phase 4A
            </div>
            <h1 className="mt-8 max-w-xl font-brand text-5xl leading-tight text-white">
              Client Finder is becoming a fuller SaaS product.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              These auth screens are ready for real backend wiring later. For now,
              they give the product a complete entry point without blocking the rest
              of the migration.
            </p>
          </div>

          <div className="relative space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                <div className="text-sm text-slate-300">Workflow coverage</div>
                <div className="mt-2 text-3xl font-semibold text-white">5 stages</div>
                <div className="mt-2 text-sm text-slate-400">
                  Search to business detail review stays intact.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                <div className="text-sm text-slate-300">Migration approach</div>
                <div className="mt-2 text-3xl font-semibold text-white">Frontend first</div>
                <div className="mt-2 text-sm text-slate-400">
                  UI ships now, backend contracts plug in later.
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                What this screen set is optimized for
              </div>
              <div className="space-y-3">
                {productHighlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="flex items-start gap-3 text-sm leading-6 text-slate-300"
                  >
                    <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-cyan-300" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-1 flex-col px-6 py-6 sm:px-10 sm:py-8">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="text-lg font-semibold text-gray-900 dark:text-white">
              Client Finder
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDarkMode ? "Light" : "Dark"}
            </Button>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <div className="mb-6">
              <div className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
                {eyebrow}
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-zinc-400">
                {description}
              </p>
            </div>

            <div
              className={cn(
                "rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
                helper && "pb-5",
              )}
            >
              {children}
              {helper ? <div className="mt-5">{helper}</div> : null}
            </div>

            <div className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
              {footer}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
