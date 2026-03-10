import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Work Planner',
  description: 'Work & Vacation Planner — Canton Zurich',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}>
        <header className="bg-white border-b border-gray-200 px-4 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900 tracking-tight">Work Planner</span>
              <span className="text-xs text-gray-300 hidden sm:block">·</span>
              <span className="text-xs text-gray-400 hidden sm:block">Canton Zurich</span>
            </div>
            <nav className="flex items-center gap-3">
              <Link
                href="/projects"
                className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                Projects
              </Link>
              <SettingsPanel />
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
