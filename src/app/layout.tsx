import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Sidebar } from "@/components/app-shell/sidebar";
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
  title: { default: "DevTrack", template: "%s · DevTrack" },
  description: "Track your development projects.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full md:flex">
        {/* The sidebar reads the pathname (a runtime value), so it renders behind Suspense. */}
        <Suspense fallback={<div className="hidden w-60 shrink-0 border-r border-line bg-surface md:block" />}>
          <Sidebar />
        </Suspense>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-10 md:py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
