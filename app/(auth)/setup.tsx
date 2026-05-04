import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth, businessSignIn } from "@/lib/firebase";

export default function SetupScreen() {
  const router = useRouter() as { replace: (href: string) => void };
  const { oobCode, email: emailParam } = useLocalSearchParams<{ oobCode?: string; email?: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSetup() {
    if (!oobCode) { setError("Invalid setup link. Please request a new one from your admin."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError(null);
    setLoading(true);
    try {
      // Verify the reset code is valid
      const email = await verifyPasswordResetCode(auth, oobCode);
      // Set the new password
      await confirmPasswordReset(auth, oobCode, password);
      // Auto sign in
      await businessSignIn(email, password);
      setDone(true);
      setTimeout(() => router.replace("/(app)/home"), 1500);
    } catch (err: unknown) {
      const msg = (err as { code?: string; message?: string });
      if (msg.code === "auth/invalid-action-code") {
        setError("This setup link has expired or already been used. Contact your admin for a new one.");
      } else {
        setError(msg.message ?? "Setup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <MaterialIcons name="check-circle" size={64} color="#4caf50" />
          <Text style={styles.doneTitle}>Account Ready!</Text>
          <Text style={styles.doneSub}>Taking you to your dashboard...</Text>
          <ActivityIndicator color="#ff7941" style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="lock-open" size={40} color="#ff7941" />
        </View>
        <Text style={styles.title}>Set Up Your Account</Text>
        <Text style={styles.subtitle}>
          Create a password to access your Smag Business workspace.
          {emailParam ? `\n\nSetting up for: ${emailParam}` : ""}
        </Text>

        {!oobCode ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={24} color="#fb5151" />
            <Text style={styles.errorCardText}>
              Invalid or missing setup link. Please use the exact link from your invite email, or contact your admin for a new one.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor="#3a1e0a"
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={(t) => { setConfirm(t); setError(null); }}
              secureTextEntry
              placeholder="Repeat your password"
              placeholderTextColor="#3a1e0a"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSetup} disabled={loading}>
              {loading ? <ActivityIndicator color="#1a0d06" /> : <Text style={styles.btnText}>Activate Account</Text>}
            </Pressable>
          </>
        )}

        <Pressable style={styles.backLink} onPress={() => router.replace("/(auth)/login")}>
          <MaterialIcons name="arrow-back" size={16} color="#6b3a1f" />
          <Text style={styles.backLinkText}>Back to Sign In</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  iconWrap: { width: 72, height: 72, borderRadius: 22, backgroundColor: "#2a1508", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { color: "#ffd4bd", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#6b3a1f", fontSize: 14, marginTop: 8, marginBottom: 28, lineHeight: 22 },
  label: { color: "#c49070", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: "#2a1508", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#ffd4bd", borderWidth: 1, borderColor: "#3a1e0a" },
  error: { color: "#fb5151", fontSize: 13, marginTop: 8 },
  btn: { marginTop: 24, backgroundColor: "#ff7941", borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#1a0d06", fontWeight: "900", fontSize: 17 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, alignSelf: "center" },
  backLinkText: { color: "#6b3a1f", fontSize: 13, fontWeight: "700" },
  errorCard: { backgroundColor: "#2a1508", borderRadius: 16, padding: 16, flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: "#fb515133" },
  errorCardText: { flex: 1, color: "#fb5151", fontSize: 13, lineHeight: 20 },
  doneTitle: { color: "#ffd4bd", fontSize: 26, fontWeight: "900" },
  doneSub: { color: "#6b3a1f", fontSize: 14 }
});
