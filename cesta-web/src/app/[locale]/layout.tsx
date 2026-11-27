import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";
import { BodyPadding } from "@/components/body-padding";
import { BottomNav } from "@/components/bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { LayoutSkeleton } from "@/components/layout-skeleton";
import { SentryBoundary } from "@/components/sentry-boundary";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { EmailVerificationBanner } from "@/features/auth/components/email-verification-banner";
import { CookieBanner } from "@/features/consent/components/cookie-banner";
import { routing } from "@/i18n/routing";
import { BRAND_GREEN } from "@/lib/brand";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "sonner";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const OG_LOCALE_MAP: Record<string, { current: string; alternate: string[] }> = {
  es: { current: "es_ES", alternate: ["pt_BR"] },
  "pt-BR": { current: "pt_BR", alternate: ["es_ES"] },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ogLocale = OG_LOCALE_MAP[locale] ?? OG_LOCALE_MAP.es;
  const t = await getTranslations({ locale, namespace: "meta.title" });
  const tOg = await getTranslations({ locale, namespace: "meta.og" });
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://cesta-web.vercel.app";
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
    openGraph: {
      type: "website",
      locale: ogLocale.current,
      alternateLocale: ogLocale.alternate,
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
  themeColor: BRAND_GREEN,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Sprint 227 (#4 bundle 2): viewport-fit=cover habilita area segura em
  // iPhone com notch/home-indicator. Sem isso, o safe-area-inset-bottom
  // retorna 0 no CSS env() e a BottomNav fica cortada ATRAS do home
  // indicator. BottomNav ja usa paddingBottom: env(safe-area-inset-bottom,
  // 0) — faltava so cover pra ativar os valores reais.
  viewportFit: "cover",
};

// Sprint 83: route group [locale] permite <html lang={locale}> dinamico SSR
// sem quebrar cacheComponents (Next 16). Middleware next-intl resolve locale
// via cookie > Accept-Language > default, com rewrite invisivel (localePrefix
// "never"). generateStaticParams habilita prerender por locale.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

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
          <CookieBanner />
        </QueryProvider>
        <InstallPrompt />
        <WebVitalsReporter />
        <Toaster position="top-center" richColors />
      </SentryBoundary>
    </NextIntlClientProvider>
  );
}
