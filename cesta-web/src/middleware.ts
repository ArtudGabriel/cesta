import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Sprint 83: substitui middleware customizado por next-intl createMiddleware.
// Responsabilidade:
// - Detectar locale (cookie cesta:locale > Accept-Language > default "es")
// - Reescrever URL bare → /[locale]/... internamente (invisivel pro user)
// - Sincronizar cookie automaticamente
// Auth guard permanece client-side (useMe/useAuthStore), decisao Sprint 2.
export default createMiddleware(routing);

export const config = {
  // Exclui API routes, _next, _vercel, e arquivos estaticos (com extensao).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
