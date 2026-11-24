import { api } from "@/lib/api";
import type {
  Alert,
  AlertRule,
  AlertRuleType,
  BundleRulePayload,
  ComboRulePayload,
  CreateAlertPayload,
  TrendRulePayload,
} from "../types/alert.types";

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

  // Sprint 105 — alert rules compostas
  async listRules(type?: AlertRuleType): Promise<AlertRule[]> {
    const { data } = await api.get<Envelope<AlertRule[]>>("/alerts/rules", {
      params: type ? { type } : undefined,
    });
    return data.data;
  },

  async createCombo(payload: ComboRulePayload): Promise<AlertRule> {
    const { data } = await api.post<Envelope<AlertRule>>(
      "/alerts/combo",
      payload,
    );
    return data.data;
  },

  async createTrend(payload: TrendRulePayload): Promise<AlertRule> {
    const { data } = await api.post<Envelope<AlertRule>>(
      "/alerts/trend",
      payload,
    );
    return data.data;
  },

  async createBundle(payload: BundleRulePayload): Promise<AlertRule> {
    const { data } = await api.post<Envelope<AlertRule>>(
      "/alerts/bundle",
      payload,
    );
    return data.data;
  },

  // Sprint 160 — rule card inline actions
  async toggleRule(id: string, isActive: boolean): Promise<AlertRule> {
    const { data } = await api.patch<Envelope<AlertRule>>(
      `/alerts/rules/${id}`,
      { isActive },
    );
    return data.data;
  },

  async removeRule(id: string): Promise<void> {
    await api.delete(`/alerts/rules/${id}`);
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
