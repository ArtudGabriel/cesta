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
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "sonner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.title");
  return {
    title: {
      default: `${t("home")} · Cesta`,
      template: "%s",
    },
    description:
      "Compara precios, promociones y nutrición de Mercadona, Carrefour, Alcampo, LIDL y Froiz en Madrid, y controla tus gastos.",
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
  };
}

export const viewport: Viewport = {
  themeColor: "#1b6b48",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // `lang` fica fixo em "es" (locale padrão do Cesta por `cesta.md` 5.1).
  // Locale real é aplicado dentro do <LocalizedShell> suspenso; sem Suspense
  // boundary, `cacheComponents: true` quebra prerender do /_not-found porque
  // getLocale/getMessages leem cookies/headers top-level.
  return (
    <html lang="es" className="h-full antialiased">
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
          <LocalizedShell>{children}</LocalizedShell>
        </Suspense>
      </body>
    </html>
  );
}

async function LocalizedShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SentryBoundary>
        <QueryProvider>
          <BodyPadding>{children}</BodyPadding>
          <BottomNav />
        </QueryProvider>
        <InstallPrompt />
        <Toaster position="top-center" richColors />
      </SentryBoundary>
    </NextIntlClientProvider>
  );
}
