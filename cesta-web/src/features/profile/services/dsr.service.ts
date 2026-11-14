import { api } from "@/lib/api";

/**
 * Sprint 63 GDPR DSR (data subject rights). `export` baixa um Blob JSON com
 * todos os dados pessoais; `deleteAccount` dispara o soft-delete backend +
 * revoga refresh tokens.
 */
export const dsrService = {
  async exportMyData(): Promise<Blob> {
    const res = await api.get<unknown>("/users/me/export", {
      responseType: "blob",
    });
    return res.data as Blob;
  },

  async deleteMyAccount(confirmation: "ELIMINAR"): Promise<void> {
    await api.delete("/users/me", { data: { confirmation } });
  },
};
