import { api } from "@/lib/api";

export const syncDietaryService = {
  async syncToFamily(): Promise<void> {
    await api.post("/family-profiles/sync-dietary");
  },
};
