import { cookies } from "next/headers";

interface Envelope<T> {
  data: T;
}

export interface AdminProfile {
  id: string;
  email: string | null;
  roles: string[];
}

export interface SoftDeletedUser {
  id: string;
  email: string | null;
  deletedAt: string;
  graceEndsAt: string | null;
}

export interface SoftDeletedPage {
  items: SoftDeletedUser[];
  total: number;
}

const ACCESS_TOKEN_COOKIE = "cesta_access_token";

function resolveBaseUrl(): string {
  const serverOnly = process.env.API_URL;
  if (serverOnly) return serverOnly;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "API_URL env var is required in production for SSR fetches (sem NEXT_PUBLIC_ prefix).",
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
}

/**
 * Sprint 95: resolve o profile SSR pra gate de role antes de buscar a
 * lista. Retorna null se sem token ou se /users/me responde !ok — caller
 * redireciona pro login.
 */
export async function fetchAdminProfileSSR(): Promise<AdminProfile | null> {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  const res = await fetch(`${resolveBaseUrl()}/users/me`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Envelope<AdminProfile>;
  return json.data;
}

/**
 * Sprint 95: lista paginada (limit 50) de users soft-deleted. Backend
 * aplica AdminGuard — gate de role já aconteceu na page, mas o backend é
 * fonte da verdade (defense in depth). no-store garante refetch per-request
 * (user-scoped Authorization header não entra no cache key do Next).
 */
export async function fetchSoftDeletedUsersSSR(): Promise<SoftDeletedPage> {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return { items: [], total: 0 };
  const res = await fetch(
    `${resolveBaseUrl()}/admin/users?deleted=true&limit=50&offset=0`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch soft-deleted users: ${res.status}`);
  }
  const json = (await res.json()) as Envelope<SoftDeletedPage>;
  return json.data;
}
