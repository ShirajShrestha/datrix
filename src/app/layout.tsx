import type { Metadata, Viewport } from "next";
import { Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import Onboarding from "@/components/Onboarding";
import MobileHeader from "@/components/MobileHeader";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PushSync from "@/components/PushSync";
import { ThemeProvider } from "@/components/ThemeProvider";
import { StoryModalProvider } from "@/components/StoryModalProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Datrix - AI-Powered News Intelligence",
  description: "Stay informed with AI-powered news that matters.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Datrix", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0B0C0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <StoryModalProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0 pb-24 lg:pb-0">
              <MobileHeader />
              {children}
            </main>
            <MobileNav />
            <Onboarding />
            <ServiceWorkerRegister />
            <PushSync />
          </div>
          </StoryModalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
