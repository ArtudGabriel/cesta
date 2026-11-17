import { api } from "@/lib/api";
import type { Alert, CreateAlertPayload } from "../types/alert.types";

interface Envelope<T> {
  data: T;
}

export const alertsService = {
  async list(): Promise<Alert[]> {
    const { data } = await api.get<Envelope<Alert[]>>("/alerts");
    return data.data;
  },

  async create(payload: CreateAlertPayload): Promise<Alert> {
    const { data } = await api.post<Envelope<Alert>>("/alerts", payload);
    return data.data;
  },

  async toggle(id: string, isActive: boolean): Promise<Alert> {
    const { data } = await api.patch<Envelope<Alert>>(`/alerts/${id}`, {
      isActive,
    });
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/alerts/${id}`);
  },
};

export const pushService = {
  async getVapidKey(): Promise<string | null> {
    const { data } = await api.get<Envelope<{ publicKey: string | null }>>(
      "/notifications/vapid-public-key",
    );
    return data.data.publicKey;
  },

  async subscribe(payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }): Promise<{ id: string; endpoint: string }> {
    const { data } = await api.post<Envelope<{ id: string; endpoint: string }>>(
      "/users/me/push-subscription",
      payload,
    );
    return data.data;
  },

  async unsubscribe(id: string): Promise<void> {
    await api.delete(`/users/me/push-subscription/${id}`);
  },
};
