export const ACCESS_COOKIE_NAME = "sbp_paid_access";
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const STRIPE_CONNECT_COOKIE_NAME = "sbp_connected_account";

export function hasPaidAccess(cookieValue?: string | null): boolean {
  return cookieValue === "active";
}
