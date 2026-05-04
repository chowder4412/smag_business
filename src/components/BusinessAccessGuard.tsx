import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { businessSignOut } from "@/lib/firebase";
import type { BusinessProfile } from "@/lib/useBusinessProfile";

type Props = {
  permission: string;
  role?: string;
  profile: BusinessProfile | null;
  loading: boolean;
  error: string | null;
  children: ReactNode;
};

export function BusinessAccessGuard({ permission, role, profile, loading, error, children }: Props) {
  const router = useRouter() as { replace: (href: string) => void };
  const allowed = profile?.permissions.includes(permission) && (!role || profile.role === role);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#ff7941" size="large" />
          <Text style={styles.muted}>Loading your workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !allowed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <MaterialIcons name="lock-outline" size={48} color="#fb5151" />
          <Text style={styles.title}>Access Denied</Text>
          <Text style={styles.muted}>{error ?? "This business workspace is not assigned to your role."}</Text>
          <Pressable style={styles.button} onPress={() => { void businessSignOut().then(() => router.replace("/(auth)/login")); }}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  title: { color: "#ffd4bd", fontSize: 22, fontWeight: "900" },
  muted: { color: "#805032", fontSize: 14, textAlign: "center", lineHeight: 20 },
  button: { marginTop: 16, backgroundColor: "#2a1508", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: "#fb5151", fontWeight: "800" }
});
