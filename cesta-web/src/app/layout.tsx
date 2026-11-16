import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import "./globals.css";
import { BodyPadding } from "@/components/body-padding";
import { BottomNav } from "@/components/bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { LayoutSkeleton } from "@/components/layout-skeleton";
import { SentryBoundary } from "@/components/sentry-boundary";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { EmailVerificationBanner } from "@/features/auth/components/email-verification-banner";
import { CookieBanner } from "@/features/consent/components/cookie-banner";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "sonner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.title");
  const tOg = await getTranslations("meta.og");
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://cesta.vercel.app";
  const defaultTitle = `${t("home")} · Cesta`;
  const description = tOg("description");
  const ogImage = {
    url: "/og-image.png",
    width: 1200,
    height: 630,
    alt: "Cesta — Comparador de precios Comunidad de Madrid",
  };
  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: defaultTitle,
      template: "%s",
    },
    description,
    applicationName: "Cesta",
    manifest: "/manifest.webmanifest",
    formatDetection: { telephone: false },
    appleWebApp: {
      capable: true,
      title: "Cesta",
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
    },
    // Sprint 69: OG + Twitter cards pra preview em WhatsApp/Twitter/LinkedIn.
    openGraph: {
      type: "website",
      locale: "es_ES",
      alternateLocale: ["pt_BR"],
      url: baseUrl,
      siteName: "Cesta",
      title: defaultTitle,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description,
      images: [ogImage.url],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1b6b48",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Sprint 82: lang resolvido via next-intl SSR (cookie cesta:locale →
  // Accept-Language → "es"). Trade-off aceito: root agora é dynamic, /_not-found
  // deixa de prerender ao build. Benefício: crawlers/leitores de tela recebem
  // `lang` correto no HTML inicial, sem flash cliente (Sprint 52.5/66 revisadas).
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@700,800&display=swap"
        />
        {/* iOS legacy; desktop Chrome/Android usa mobile-web-app-capable (emitido pelo Next via appleWebApp) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <Suspense fallback={<LayoutSkeleton />}>
          <LocalizedShell locale={locale}>{children}</LocalizedShell>
        </Suspense>
      </body>
    </html>
  );
}

async function LocalizedShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SentryBoundary>
        <QueryProvider>
          <EmailVerificationBanner />
          <BodyPadding>{children}</BodyPadding>
          <BottomNav />
          {/* Sprint 62 GDPR: banner precisa de QueryProvider (lê useProfile). */}
          <CookieBanner />
        </QueryProvider>
        <InstallPrompt />
        {/* Sprint 76 (P5): Core Web Vitals → POST /telemetry/vitals em prod. */}
        <WebVitalsReporter />
        <Toaster position="top-center" richColors />
      </SentryBoundary>
    </NextIntlClientProvider>
  );
}
