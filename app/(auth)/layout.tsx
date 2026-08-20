import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-900 text-navy-50">
      <header className="px-5 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none">
            <rect width="24" height="24" rx="5" fill="#E9AE3B" />
            <path
              d="M6 7.5l4.6 9.5L18 6"
              stroke="#051226"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-semibold">Verra</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
