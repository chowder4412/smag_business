import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { businessSignOut, checkAppVersion } from "@/lib/firebase";

export default function HomeScreen() {
  const router = useRouter() as { replace: (href: string) => void };
  const { profile, loading, error, retry } = useBusinessProfile();
  const [signingOut, setSigningOut] = useState(false);

  // Version check on mount
  useEffect(() => {
    void checkAppVersion().catch((err: unknown) => {
      Alert.alert("Update Required", (err as Error).message, [
        { text: "OK", onPress: () => void businessSignOut().then(() => router.replace("/(auth)/login")) }
      ]);
    });
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await businessSignOut();
      router.replace("/(auth)/login");
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#ff7941" size="large" />
          <Text style={styles.loadingText}>Loading your workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={48} color="#fb5151" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>{error ?? "Profile not found."}</Text>
          <Pressable style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
            {signingOut ? <ActivityIndicator color="#fb5151" size="small" /> : <Text style={styles.signOutText}>Sign Out</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const roleConfig: Record<string, { icon: string; label: string; route: string; color: string }> = {
    driver: { icon: "delivery-dining", label: "Driver Dashboard", route: "/(app)/driver", color: "#ff7941" },
    kitchen_staff: { icon: "restaurant", label: "Kitchen Dashboard", route: "/(app)/kitchen-staff", color: "#f8a91f" },
    kitchen_owner: { icon: "storefront", label: "My Kitchen", route: "/(app)/kitchen-owner", color: "#4caf50" },
    concierge: { icon: "support-agent", label: "Support Dashboard", route: "/(app)/concierge", color: "#2196f3" },
    manager: { icon: "manage-accounts", label: "Manager Dashboard", route: "/(app)/manager", color: "#9c27b0" },
    unknown: { icon: "help-outline", label: "Unknown Role", route: "/(app)/home", color: "#fb5151" }
  };

  const cfg = roleConfig[profile.role] ?? roleConfig.unknown;
  const canEnterWorkspace = profile.role !== "unknown";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{profile.name}</Text>
          </View>
          <Pressable onPress={handleSignOut} disabled={signingOut}>
            {signingOut
              ? <ActivityIndicator color="#6b3a1f" size="small" />
              : <MaterialIcons name="logout" size={22} color="#6b3a1f" />}
          </Pressable>
        </View>

        <View style={[styles.roleCard, { borderColor: cfg.color }]}>
          <MaterialIcons name={cfg.icon as never} size={36} color={cfg.color} />
          <View style={{ flex: 1 }}>
            <Text style={styles.roleLabel}>Your Role</Text>
            <Text style={styles.roleName}>{profile.role.replace("_", " ").toUpperCase()}</Text>
            {profile.restaurantName ? <Text style={styles.restaurantName}>{profile.restaurantName}</Text> : null}
          </View>
        </View>

        {!canEnterWorkspace ? <Text style={styles.errorText}>Your role has business access but no matching workspace. Contact your admin.</Text> : null}
        <Pressable
          style={[styles.enterBtn, { backgroundColor: cfg.color }, !canEnterWorkspace && { opacity: 0.5 }]}
          onPress={() => canEnterWorkspace && router.replace(cfg.route as never)}
          disabled={!canEnterWorkspace}
        >
          <MaterialIcons name={cfg.icon as never} size={22} color="#1a0d06" />
          <Text style={styles.enterBtnText}>{cfg.label}</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#1a0d06" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { color: "#805032", fontSize: 15, marginTop: 12 },
  errorTitle: { color: "#ffd4bd", fontSize: 22, fontWeight: "900" },
  errorText: { color: "#805032", fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: { marginTop: 12, backgroundColor: "#2a1508", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: "#ff7941", fontWeight: "800" },
  signOutBtn: { marginTop: 16, backgroundColor: "#2a1508", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  signOutText: { color: "#fb5151", fontWeight: "800" },
  content: { flex: 1, padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 },
  greeting: { color: "#6b3a1f", fontSize: 14 },
  name: { color: "#ffd4bd", fontSize: 26, fontWeight: "900", marginTop: 2 },
  roleCard: { backgroundColor: "#2a1508", borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, borderWidth: 1, marginBottom: 20 },
  roleLabel: { color: "#6b3a1f", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  roleName: { color: "#ffd4bd", fontSize: 18, fontWeight: "900", marginTop: 2 },
  restaurantName: { color: "#805032", fontSize: 13, marginTop: 2 },
  enterBtn: { borderRadius: 999, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  enterBtnText: { color: "#1a0d06", fontWeight: "900", fontSize: 17 }
});
