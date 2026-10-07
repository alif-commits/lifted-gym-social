import { mediaUrl } from "@/server/storage";
import type { SessionUser } from "@/server/auth/session";
import { config } from "@/server/config";

export type UserSummaryDto = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function userSummary(u: { id: string; username: string; displayName: string; avatarKey: string | null }): UserSummaryDto {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: mediaUrl(u.avatarKey) };
}

export function meDto(u: SessionUser) {
  return {
    ...userSummary(u),
    email: u.email,
    role: u.role,
    emailVerified: u.emailVerifiedAt !== null,
    emailConfigured: Boolean(config.email.resendKey),
    settings: u.settings,
  };
}
export type MeDto = ReturnType<typeof meDto>;
