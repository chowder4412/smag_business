import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { subscribeAuthState } from "@/lib/firebase";
import { registerForPushNotifications, addNotificationListener } from "@/lib/notifications";
import { useBusinessStore } from "@/lib/store";

export default function RootLayout() {
  const router = useRouter() as { replace: (href: string) => void };
  const segments = useSegments();
  const [authReady, setAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const stopOrderSubscriptions = useBusinessStore((s) => s.stopOrderSubscriptions);

  useEffect(() => {
    return subscribeAuthState((user) => {
      setIsSignedIn(!!user);
      setAuthReady(true);
      if (user) {
        void registerForPushNotifications();
      } else {
        stopOrderSubscriptions();
      }
    });
  }, [stopOrderSubscriptions]);

  useEffect(() => {
    return addNotificationListener(
      () => {}, // foreground notification received — handled by setNotificationHandler
      (response) => {
        const data = response.notification.request.content.data as Record<string, string>;
        if (data?.orderId) {
          // Navigate to relevant screen based on role — handled by home screen
        }
      }
    );
  }, []);

  // Handle deep links — setup email links to smag-business://setup?oobCode=...
  useEffect(() => {
    // Handle initial URL (app opened from link)
    void Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    // Handle URL while app is open
    const sub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  function handleDeepLink(url: string) {
    const parsed = Linking.parse(url);
    // smag-business://setup?oobCode=xxx
    if (parsed.path === "setup" || parsed.hostname === "setup") {
      const oobCode = parsed.queryParams?.oobCode as string | undefined;
      if (oobCode) {
        router.replace(`/(auth)/setup?oobCode=${encodeURIComponent(oobCode)}` as never);
      }
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
