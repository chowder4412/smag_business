import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { subscribeAuthState } from "@/lib/firebase";
import { registerForPushNotifications, addNotificationListener } from "@/lib/notifications";
import { useBusinessStore } from "@/lib/store";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const ROLE_ROUTES: Record<string, string> = {
  driver: "/(app)/driver",
  kitchen_staff: "/(app)/kitchen-staff",
  kitchen_owner: "/(app)/kitchen-owner",
  concierge: "/(app)/concierge",
  manager: "/(app)/manager",
};

export default function RootLayout() {
  const router = useRouter() as { replace: (href: string) => void; push: (href: string) => void };
  const segments = useSegments();
  const [authReady, setAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const cachedRoleRef = useRef<string | null>(null);

  const stopOrderSubscriptions = useBusinessStore((s) => s.stopOrderSubscriptions);

  useEffect(() => {
    return subscribeAuthState((user) => {
      setIsSignedIn(!!user);
      setAuthReady(true);
      if (user) {
        void registerForPushNotifications();
      } else {
        cachedRoleRef.current = null;
        stopOrderSubscriptions();
      }
    });
  }, [stopOrderSubscriptions]);

  useEffect(() => {
    return addNotificationListener(
      () => {}, // foreground — handled by setNotificationHandler
      (response) => {
        const data = response.notification.request.content.data as Record<string, string>;
        if (!data?.orderId) return;
        // Route to the role-specific screen, falling back to home
        const role = cachedRoleRef.current;
        const target = (role && ROLE_ROUTES[role]) ?? "/(app)/home";
        router.replace(target as never);
      }
    );
  }, [router]);

  // Cache the user's role so notification taps can route correctly without re-fetching
  useEffect(() => {
    if (!isSignedIn) return;
    void (async () => {
      try {
        const { auth } = await import("@/lib/firebase");
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        // Try kitchen_owner first
        const koSnap = await getDoc(doc(db, "kitchen_owners", uid));
        if (koSnap.exists()) { cachedRoleRef.current = "kitchen_owner"; return; }
        // Try employee
        const empSnap = await getDoc(doc(db, "employees", uid));
        if (empSnap.exists()) {
          const roleId = String(empSnap.data().roleId ?? "");
          if (roleId) {
            const roleSnap = await getDoc(doc(db, "roles", roleId));
            if (roleSnap.exists()) {
              const perms: string[] = Array.isArray(roleSnap.data().permissions) ? roleSnap.data().permissions : [];
              if (perms.includes("business_driver")) cachedRoleRef.current = "driver";
              else if (perms.includes("business_team")) cachedRoleRef.current = "manager";
              else if (perms.includes("business_support")) cachedRoleRef.current = "concierge";
              else if (perms.includes("business_orders")) cachedRoleRef.current = "kitchen_staff";
            }
          }
        }
      } catch { /* non-fatal */ }
    })();
  }, [isSignedIn]);

  // Handle deep links — setup email links to smag-business://setup?oobCode=...
  useEffect(() => {
    void Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    const sub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  function handleDeepLink(url: string) {
    const parsed = Linking.parse(url);
    if (parsed.path === "setup" || parsed.hostname === "setup") {
      const oobCode = parsed.queryParams?.oobCode as string | undefined;
      if (oobCode) router.replace(`/(auth)/setup?oobCode=${encodeURIComponent(oobCode)}` as never);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    const inAuth = segments[0] === "(auth)";
    if (!isSignedIn && !inAuth) router.replace("/(auth)/login");
    if (isSignedIn && inAuth) router.replace("/(app)/home");
  }, [authReady, isSignedIn, segments, router]);

  if (!authReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: "#1a0d06", justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#ff7941" size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#1a0d06" }, animation: "slide_from_right" }} />
    </SafeAreaProvider>
  );
}
