"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { pushService } from "../services/alerts.service";

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
        toast.error("Permiso denegado");
        setState((s) => ({ ...s, permission, loading: false }));
        return;
      }
      const publicKey = await pushService.getVapidKey();
      if (!publicKey) {
        toast.error("Push no está configurado en el servidor");
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
      await pushService.subscribe({
        endpoint: payload.endpoint!,
        keys: {
          p256dh: payload.keys!.p256dh!,
          auth: payload.keys!.auth!,
        },
        userAgent: navigator.userAgent,
      });
      toast.success("Notificaciones activadas");
      setState({
        supported: true,
        permission: "granted",
        subscribed: true,
        loading: false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error desconocido");
      setState((s) => ({ ...s, loading: false }));
    }
  }

  async function disable(): Promise<void> {
    setState((s) => ({ ...s, loading: true }));
    try {
      const sub = await checkSubscription();
      if (sub) {
        await pushService.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, subscribed: false, loading: false }));
      toast.success("Notificaciones desactivadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error desconocido");
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
