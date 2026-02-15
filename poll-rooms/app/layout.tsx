import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PollRooms — Real-Time Voting',
  description:
    'Create polls, share links, see results update live. No sign-up required.',
  keywords: ['poll', 'real-time', 'voting', 'websocket', 'live'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-neutral-950 text-gray-100`}>
        <ThemeProvider>
          {/* ── Global Grid Background ── */}
          <div className="fixed inset-0 -z-10 bg-neutral-950">
            <div className="absolute inset-0 grid-bg grid-mask" />
          </div>

          {children}

          <Toaster
            position="top-center"
            richColors
            closeButton
            theme="dark"
            toastOptions={{
              duration: 4000,
              className: 'text-sm',
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
