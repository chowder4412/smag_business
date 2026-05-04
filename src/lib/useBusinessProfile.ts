import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db, getCurrentUser } from "./firebase";

export type BusinessRole =
  | "driver"
  | "kitchen_staff"
  | "kitchen_owner"
  | "concierge"
  | "manager"
  | "unknown";

export type BusinessProfile = {
  uid: string;
  name: string;
  email: string;
  role: BusinessRole;
  permissions: string[];
  restaurantId?: string;
  restaurantName?: string;
  roleId?: string;
};

export function useBusinessProfile(): { profile: BusinessProfile | null; loading: boolean; error: string | null; retry: () => void } {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryCount(c => c + 1);
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { setLoading(false); return; }

    let active = true;
    const unsubs: (() => void)[] = [];

    void (async () => {
      try {
        // Check kitchen_owners first
        const kitchenOwnerSnap = await getDoc(doc(db, "kitchen_owners", user.uid));
        if (kitchenOwnerSnap.exists() && active) {
          const d = kitchenOwnerSnap.data();
          setProfile({
            uid: user.uid,
            name: String(d.name ?? user.email ?? ""),
            email: String(d.email ?? user.email ?? ""),
            role: "kitchen_owner",
            permissions: ["business_access", "business_orders", "business_menu"],
            restaurantId: String(d.restaurantId ?? ""),
            restaurantName: String(d.restaurantName ?? "")
          });
          setLoading(false);
          // Live-listen for kitchen_owner profile changes (e.g. restaurantName update)
          unsubs.push(onSnapshot(doc(db, "kitchen_owners", user.uid), (snap) => {
            if (!snap.exists() || !active) return;
            const data = snap.data();
            setProfile(prev => prev ? {
              ...prev,
              name: String(data.name ?? prev.name),
              restaurantName: String(data.restaurantName ?? prev.restaurantName ?? "")
            } : prev);
          }));
          return;
        }

        // Check employees
        let employeeDoc = await getDoc(doc(db, "employees", user.uid));
        if (!employeeDoc.exists()) {
          const { getDocs, collection, query, where } = await import("firebase/firestore");
          const empSnap = await getDocs(query(collection(db, "employees"), where("uid", "==", user.uid)));
          employeeDoc = empSnap.docs[0] ?? employeeDoc;
        }

        if (employeeDoc.exists() && active) {
          const empData = employeeDoc.data();
          if (String(empData.status ?? "active") !== "active") {
            setError("Your business app access is suspended. Contact your admin.");
            setLoading(false);
            return;
          }

          const roleId = String(empData.roleId ?? "");
          let roleName = "unknown";
          let permissions: string[] = [];
          if (roleId) {
            const roleSnap = await getDoc(doc(db, "roles", roleId));
            if (roleSnap.exists()) {
              const roleData = roleSnap.data();
              roleName = String(roleData.name ?? "").toLowerCase();
              permissions = Array.isArray(roleData.permissions) ? roleData.permissions.map(String) : [];
            }
          }

          if (!permissions.includes("business_access")) {
            setError("Your role is not assigned to the business app. Contact your admin.");
            setLoading(false);
            return;
          }

          const role = resolveRole(roleName, permissions);
          setProfile({
            uid: user.uid,
            name: String(empData.name ?? user.email ?? ""),
            email: String(empData.email ?? user.email ?? ""),
            role,
            permissions,
            roleId
          });
          setLoading(false);

          // Live-listen for suspension — kicks user out immediately if admin suspends them
          unsubs.push(onSnapshot(doc(db, "employees", employeeDoc.id), (snap) => {
            if (!snap.exists() || !active) return;
            if (snap.data().status !== "active") {
              setProfile(null);
              setError("Your business app access has been suspended. Contact your admin.");
            }
          }));
          return;
        }

        if (active) {
          setError("Your account is not linked to any employee or kitchen profile. Contact your admin.");
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          setError((err as Error).message ?? "Failed to load profile.");
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      unsubs.forEach(u => u());
    };
  }, [retryCount]);

  return { profile, loading, error, retry };
}

export function hasBusinessPermission(profile: BusinessProfile | null, permission: string): boolean {
  return Boolean(profile?.permissions.includes(permission));
}

function resolveRole(roleName: string, permissions: string[]): BusinessRole {
  const n = roleName.toLowerCase();
  if (permissions.includes("business_driver") || n.includes("driver") || n.includes("delivery")) return "driver";
  if (permissions.includes("business_menu") || (n.includes("kitchen") && n.includes("staff"))) return "kitchen_staff";
  if (permissions.includes("business_support") || n.includes("concierge") || n.includes("support")) return "concierge";
  if (permissions.includes("business_team") || n.includes("manager")) return "manager";
  if (permissions.includes("business_orders")) return "kitchen_staff";
  return "unknown";
}
