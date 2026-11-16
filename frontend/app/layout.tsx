import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LitReview Agent",
  description:
    "LitReview Agent — literature review có evidence và human-in-the-loop: tìm kiếm, sàng lọc, tóm tắt, hỏi đáp và tạo bản nháp đã duyệt.",
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/chat", label: "Research Chat" },
  { href: "/review", label: "Review & Export" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="rounded-lg bg-zinc-900 px-2 py-1 text-xs font-bold text-white">EDU-09</span>
              LitReview Agent
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-zinc-200 bg-white py-3 text-center text-xs text-zinc-500">
          LitReview Agent · EDU-09 · P-107 — metadata và abstract từ OpenAlex, không xử lý full-text PDF
        </footer>
      </body>
    </html>
  );
}
