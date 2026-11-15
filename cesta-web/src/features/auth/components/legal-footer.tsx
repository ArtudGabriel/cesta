import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Sprint 68: rodapé discreto em /login + /register com links pra políticas
 * legais. Pattern GDPR-friendly — user consente implicitamente ao avançar
 * no form, mas tem os links visíveis acima da ação.
 */
export async function LegalFooter() {
  const t = await getTranslations("legal");
  return (
    <footer className="mt-8 text-center text-xs text-muted">
      <Link
        href="/politica-privacidade"
        className="underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        {t("privacyLink")}
      </Link>
      <span className="mx-2">·</span>
      <Link
        href="/termos"
        className="underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        {t("termsLink")}
      </Link>
    </footer>
  );
}
