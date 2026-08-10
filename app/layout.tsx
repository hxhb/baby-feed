import type { Metadata, Viewport } from "next";
import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import Image from 'next/image'
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
  title: "Baby Feed - 婴儿科学喂养与成长记录",
  description: "记录婴儿喂养、睡眠与成长数据，帮助家庭更科学地了解宝宝的日常状态",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg?v=7", type: "image/svg+xml" },
    ],
    apple: "/icons/icon-192x192.png?v=7",
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
        {/* Splash screen - hidden after React hydrates */}
        <div id="splash" className="splash-screen" suppressHydrationWarning>
          <div className="splash-brand">
            <Image className="splash-mark" src="/icon.svg" alt="" width={76} height={76} priority />
            <p className="splash-name">Baby Feed</p>
          </div>
          <span className="splash-progress" aria-hidden="true" />
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
