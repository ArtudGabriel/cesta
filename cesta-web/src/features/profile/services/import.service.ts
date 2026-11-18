import { api } from "@/lib/api";

export type ImportStatus =
  | "pending"
  | "parsing"
  | "ready_to_apply"
  | "applying"
  | "complete"
  | "failed";

export interface ImportSummary {
  added: {
    favoritos: number;
    listas: number;
    listaItems: number;
    alertas: number;
    reviews: number;
    expenses: number;
    expenseItems: number;
  };
  skipped: {
    favoritos: number;
    listas: number;
    alertas: number;
    reviews: number;
    productsNotFound: number;
  };
  errors: Array<{ file: string; line: number; message: string }>;
}

export interface ImportResult {
  jobId: string;
  status: ImportStatus;
  dryRun: boolean;
  errorMessage: string | null;
  summary: ImportSummary | null;
  createdAt: string;
}

/**
 * Sprint 102: CSV import GDPR Art. 20 simétrico ao export S91. Two-step:
 * create (upload multipart + dryRun=true) → poll GET até ready_to_apply →
 * apply confirma. Rate limit 1/hora servidor-side (429).
 */
export const importService = {
  async create(file: File, dryRun = true): Promise<ImportResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("dryRun", String(dryRun));
    // Content-Type omitido — axios + FormData derivam boundary multipart.
    const res = await api.post<ImportResult>("/users/me/import", form);
    return res.data;
  },

  async getStatus(jobId: string): Promise<ImportResult> {
    const res = await api.get<ImportResult>(`/users/me/import/${jobId}`);
    return res.data;
  },

  async apply(jobId: string): Promise<ImportResult> {
    const res = await api.post<ImportResult>(
      `/users/me/import/${jobId}/apply`,
      {},
    );
    return res.data;
  },
};
