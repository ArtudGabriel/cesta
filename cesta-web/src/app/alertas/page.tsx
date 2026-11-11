"use client";

import {
  ArrowLeft,
  Bell,
  BellOff,
  Loader2,
  Tag,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  useAlerts,
  useDeleteAlert,
  useToggleAlert,
} from "@/features/alerts/hooks/use-alerts";
import { usePush } from "@/features/alerts/hooks/use-push";
import type { Alert } from "@/features/alerts/types/alert.types";
import { cn, formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

export default function AlertsPage() {
  const user = useAuthStore((s) => s.user);
  const alerts = useAlerts();
  const push = usePush();

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-muted">Inicia sesión para gestionar alertas.</p>
        <Button asChild size="sm">
          <Link href="/login">Entrar</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-bold text-ink">Mis alertas</h1>
      </header>

      <section className="px-4 py-4">
        <div className="rounded-card bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-bold text-ink">
                Notificaciones push
              </p>
              <p className="text-xs text-muted">
                {!push.supported
                  ? "Tu navegador no soporta push."
                  : push.subscribed
                    ? "Activadas. Recibirás alertas al instante."
                    : "Activa para recibir alertas al momento."}
              </p>
            </div>
            {push.supported && (
              <Button
                size="sm"
                variant={push.subscribed ? "ghost" : "primary"}
                onClick={() =>
                  push.subscribed ? push.disable() : push.enable()
                }
                disabled={push.loading}
              >
                {push.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : push.subscribed ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                {push.subscribed ? "Desactivar" : "Activar"}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="px-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Alertas activas
        </h2>
        {alerts.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
          </div>
        ) : !alerts.data || alerts.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Aún no tienes alertas. Añade una desde la página de producto.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.data.map((alert) => (
              <li key={alert.id}>
                <AlertCard alert={alert} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const toggle = useToggleAlert();
  const remove = useDeleteAlert();

  const label = describeType(alert);

  return (
    <div
      className={cn(
        "rounded-card bg-white p-4 shadow-card",
        !alert.isActive && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/produto/${alert.productId}`}
            className="line-clamp-1 text-sm font-medium text-ink hover:text-cesta-green"
          >
            {alert.productName}
          </Link>
          <p className="mt-1 text-xs text-muted">
            {alert.supermarketName ?? "Cualquier supermercado"}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-[10px] font-medium text-ink">
            {label.icon}
            {label.text}
          </p>
          {alert.lastTriggeredAt && (
            <p className="mt-2 text-[11px] text-muted">
              Última alerta:{" "}
              {new Date(alert.lastTriggeredAt).toLocaleDateString("es-ES")}
            </p>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={alert.isActive ? "Desactivar" : "Activar"}
            onClick={() =>
              toggle.mutate({ id: alert.id, isActive: !alert.isActive })
            }
          >
            {alert.isActive ? (
              <Bell className="h-4 w-4 text-cesta-green" />
            ) : (
              <BellOff className="h-4 w-4 text-muted" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Eliminar"
            onClick={() => {
              if (confirm("¿Eliminar esta alerta?")) remove.mutate(alert.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-coral" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function describeType(alert: Alert): { icon: React.ReactNode; text: string } {
  switch (alert.type) {
    case "promotion":
      return { icon: <Tag className="h-3 w-3" />, text: "En promoción" };
    case "target_price":
      return {
        icon: <Target className="h-3 w-3" />,
        text: `Precio ≤ ${alert.targetPrice ? formatPrice(alert.targetPrice) : "?"}`,
      };
    case "promotion_ending":
      return { icon: <Tag className="h-3 w-3" />, text: "Promoción terminando" };
    case "back_in_stock":
      return { icon: <Bell className="h-3 w-3" />, text: "Vuelve a stock" };
    default:
      return { icon: <Bell className="h-3 w-3" />, text: alert.type };
  }
}
