import { api } from "@/lib/api";

export interface ExportResult {
  blob: Blob;
  filename: string;
}

function parseFilename(header: string | undefined): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : null;
}

/**
 * Sprint 91 GDPR DSR (data subject rights). `export` baixa ZIP multi-CSV
 * (perfil, favoritos, listas, alertas, reviews, expenses) via Blob; filename
 * vem de Content-Disposition. `deleteAccount` continua Sprint 63.
 */
export const dsrService = {
  async exportMyData(): Promise<ExportResult> {
    const res = await api.get<Blob>("/users/me/export", {
      responseType: "blob",
    });
    const filename =
      parseFilename(res.headers?.["content-disposition"] as string | undefined) ??
      `cesta-datos-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    return { blob: res.data, filename };
  },

  async deleteMyAccount(confirmation: "ELIMINAR"): Promise<void> {
    await api.delete("/users/me", { data: { confirmation } });
  },
};
