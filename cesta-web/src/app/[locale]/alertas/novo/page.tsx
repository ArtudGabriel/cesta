import { getTranslations } from "next-intl/server";
import { AlertRuleWizard } from "@/features/alerts/components/alert-rule-wizard";

export default async function NewAlertRulePage() {
  const t = await getTranslations("alerts.rules");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-4">
      <header>
        <h1 className="text-xl font-bold" data-sentry-unmask>
          {t("newTitle")}
        </h1>
        <p className="text-sm text-muted-foreground" data-sentry-unmask>
          {t("newSubtitle")}
        </p>
      </header>
      <AlertRuleWizard />
    </div>
  );
}
