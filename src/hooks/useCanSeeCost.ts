import { useAuth } from "./useAuth";

/**
 * Returns true if the current user is allowed to see purchase/cost prices,
 * profit, and supplier-due information. Only admin / super_admin can.
 * Staff users must NEVER see these values.
 */
export function useCanSeeCost(): boolean {
  const { role } = useAuth();
  return role === "admin";
}
