import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Cesta — precios de supermercado en Madrid",
  description:
    "Compara precios, promociones y nutrición de Mercadona, Carrefour, Alcampo, LIDL y Froiz en Madrid, y controla tus gastos.",
  applicationName: "Cesta",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1b6b48",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@700,800&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
