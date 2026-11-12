"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true,
    );

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (standalone || dismissed || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setDeferred(null);
    }
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-pill bg-cesta-green pl-4 pr-2 py-2 text-white shadow-card-elevated">
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-2 text-sm font-medium cursor-pointer"
        aria-label="Instalar Cesta como app"
      >
        <Download className="h-4 w-4" />
        Instalar app
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-pill p-1 hover:bg-cesta-green-light cursor-pointer"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
