import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-5 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight">Budet</span>
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-20 pt-6">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="7.5" fill="#1d1d1f" />
      <path
        d="M9 19V9.6c0-.3.3-.6.6-.6h4.6a3 3 0 0 1 0 6H11"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.4 15 4.6 4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
