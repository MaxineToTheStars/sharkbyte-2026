import Link from "next/link";

export default function SiteHeader({ mode }: { mode: "public" | "app" }) {
  return (
    <header className="border-b-2 border-ink">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="focus-ring rounded-md">
          <span className="text-lg font-extrabold tracking-tight">Majorly Lost</span>
        </Link>
        {mode === "public" ? (
          <a
            href="/auth/login?returnTo=/dashboard"
            className="focus-ring text-sm font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </a>
        ) : (
          <a
            href="/auth/logout"
            className="focus-ring text-sm font-medium underline-offset-4 hover:underline"
          >
            Sign out
          </a>
        )}
      </div>
    </header>
  );
}
