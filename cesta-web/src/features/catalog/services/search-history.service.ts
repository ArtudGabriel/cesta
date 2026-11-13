import { api } from "@/lib/api";

interface Envelope<T> {
  data: T;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  createdAt: string;
}

export const searchHistoryService = {
  async list(): Promise<SearchHistoryItem[]> {
    const { data } = await api.get<Envelope<{ history: SearchHistoryItem[] }>>(
      "/search-history",
    );
    return data.data.history;
  },

  async add(query: string): Promise<SearchHistoryItem> {
    const { data } = await api.post<Envelope<SearchHistoryItem>>(
      "/search-history",
      { query },
    );
    return data.data;
  },

  async remove(query: string): Promise<void> {
    await api.delete(`/search-history/${encodeURIComponent(query)}`);
  },

  async clear(): Promise<void> {
    await api.delete("/search-history");
  },
};
