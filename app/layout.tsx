import type { Metadata, Viewport } from "next";
import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { auth } from '@/lib/auth'

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Baby Feed - 新生儿喂养记录系统",
  description: "记录新生儿的喂养状态，包括母乳、奶粉、AD服用等",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/icon-192x192.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Baby Feed",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

async function getServerSession() {
  const headerStore = await headers()
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'

  return auth(new NextRequest(`${protocol}://${host}`, { headers: headerStore }))
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession()

  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" style={{ colorScheme: 'light' }}>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Splash screen — hidden after React hydrates */}
        <div id="splash" className="splash-screen" suppressHydrationWarning>
          <div className="splash-logo">
            <svg width="80" height="80" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '20px', boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}>
              <defs>
                <linearGradient id="splash-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#3b82f6' }} />
                  <stop offset="100%" style={{ stopColor: '#f472b6' }} />
                </linearGradient>
              </defs>
              <rect width="56" height="56" rx="12" ry="12" fill="url(#splash-bg)" />
              <rect x="15" y="18" width="24" height="32" rx="8" fill="white" opacity="0.95" />
              <rect x="20" y="9" width="14" height="10" rx="5" fill="white" opacity="0.95" />
              <path d="M23 9 Q27 3.5 31 9" fill="white" opacity="0.95" stroke="white" strokeWidth="1.5" />
              <rect x="17" y="30" width="20" height="18" rx="6.5" fill="rgba(244,114,182,0.25)" />
              <path d="M27 33 C25 31 22.5 31.8 22.5 33.8 C22.5 35.8 27 38.5 27 38.5 C27 38.5 31.5 35.8 31.5 33.8 C31.5 31.8 29 31 27 33Z" fill="rgba(59,130,246,0.5)" />
            </svg>
          </div>
          <p style={{ marginTop: '20px', fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Baby Feed</p>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#475569' }}>宝宝喂养记录</p>
        </div>
        <Providers session={session}>
          {children}
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  registrations.forEach(function(registration) { registration.unregister(); });
                });
                if ('caches' in window) {
                  caches.keys().then(function(names) {
                    names.forEach(function(name) { caches.delete(name); });
                  });
                }
              } else if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('SW registered: ', registration.scope);
                    },
                    function(err) {
                      console.log('SW registration failed: ', err);
                    }
                  );
                });
              }
              // Dismiss splash screen after hydration
              requestAnimationFrame(function() {
                setTimeout(function() {
                  var splash = document.getElementById('splash');
                  if (splash) splash.classList.add('hidden');
                }, 300);
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
