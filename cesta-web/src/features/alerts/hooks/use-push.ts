"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { pushService } from "../services/alerts.service";

const SUBSCRIPTION_ID_KEY = "cesta:push-subscription-id";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | "unknown";
  subscribed: boolean;
  loading: boolean;
}

export function usePush() {
  const t = useTranslations("alerts.push");
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: "unknown",
    subscribed: false,
    loading: true,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window;
    if (!supported) {
      setState({ supported: false, permission: "unknown", subscribed: false, loading: false });
      return;
    }
    checkSubscription().then((sub) =>
      setState({
        supported: true,
        permission: Notification.permission,
        subscribed: Boolean(sub),
        loading: false,
      }),
    );
  }, []);

  async function enable(): Promise<void> {
    if (!state.supported) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("permissionDenied"));
        setState((s) => ({ ...s, permission, loading: false }));
        return;
      }
      const publicKey = await pushService.getVapidKey();
      if (!publicKey) {
        toast.error(t("serverNotConfigured"));
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });
      const payload = sub.toJSON();
      const saved = await pushService.subscribe({
        endpoint: payload.endpoint!,
        keys: {
          p256dh: payload.keys!.p256dh!,
          auth: payload.keys!.auth!,
        },
        userAgent: navigator.userAgent,
      });
      try {
        window.localStorage.setItem(SUBSCRIPTION_ID_KEY, saved.id);
      } catch {
        // storage pode falhar em modo privado; não é crítico pra o enable.
      }
      toast.success(t("activated"));
      setState({
        supported: true,
        permission: "granted",
        subscribed: true,
        loading: false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("unknownError"));
      setState((s) => ({ ...s, loading: false }));
    }
  }

  async function disable(): Promise<void> {
    setState((s) => ({ ...s, loading: true }));
    try {
      const sub = await checkSubscription();
      let savedId: string | null = null;
      try {
        savedId = window.localStorage.getItem(SUBSCRIPTION_ID_KEY);
      } catch {
        savedId = null;
      }
      if (savedId) {
        await pushService.unsubscribe(savedId);
        try {
          window.localStorage.removeItem(SUBSCRIPTION_ID_KEY);
        } catch {
          // ignore
        }
      }
      if (sub) {
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, subscribed: false, loading: false }));
      toast.success(t("deactivated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("unknownError"));
      setState((s) => ({ ...s, loading: false }));
    }
  }

  return { ...state, enable, disable };
}

async function checkSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}
