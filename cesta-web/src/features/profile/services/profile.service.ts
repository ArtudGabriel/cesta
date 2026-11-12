import { api } from "@/lib/api";
import type { Profile, UpdateProfilePayload } from "../types/profile.types";

interface Envelope<T> {
  data: T;
}

export const profileService = {
  async me(): Promise<Profile> {
    const { data } = await api.get<Envelope<Profile>>("/users/me");
    return data.data;
  },

  async update(payload: UpdateProfilePayload): Promise<Profile> {
    const { data } = await api.patch<Envelope<Profile>>("/users/me", payload);
    return data.data;
  },
};
