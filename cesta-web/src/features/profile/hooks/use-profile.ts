"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { profileService } from "../services/profile.service";
import type { Profile, UpdateProfilePayload } from "../types/profile.types";
import { useAuthStore } from "@/stores/auth.store";

export const PROFILE_KEY = ["profile", "me"] as const;

export function useProfile() {
  // Sempre tenta — 401 é tratado pelo axios interceptor (que limpa sessão)
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: profileService.me,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const t = useTranslations("toast");
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileService.update(payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: PROFILE_KEY });
      const prev = qc.getQueryData<Profile>(PROFILE_KEY);
      if (prev) {
        qc.setQueryData<Profile>(PROFILE_KEY, { ...prev, ...payload });
      }
      return { prev };
    },
    onError: (err: Error, _payload, ctx) => {
      if (ctx?.prev) qc.setQueryData(PROFILE_KEY, ctx.prev);
      toast.error(err.message || t("error.profileUpdate"));
    },
    onSuccess: (profile) => {
      qc.setQueryData(PROFILE_KEY, profile);
      // Sync Zustand store (afeta UI que lê do store, ex. header)
      updateUser({
        id: profile.id,
        email: profile.email,
        phone: profile.phone,
        name: profile.name,
        locale: profile.locale,
        roles: profile.roles,
        createdAt: profile.createdAt,
      });
      toast.success(t("success.profileUpdated"));
    },
  });
}
