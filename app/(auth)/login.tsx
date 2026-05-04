import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { businessSignIn } from "@/lib/firebase";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AuthTab = "signin" | "driver" | "kitchen";

export default function LoginScreen() {
  const router = useRouter() as { replace: (href: string) => void };
  const [tab, setTab] = useState<AuthTab>("signin");

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <MaterialIcons name="storefront" size={44} color="#ff7941" />
          <Text style={styles.appName}>Smag Business</Text>
          <Text style={styles.appSub}>For drivers, kitchens & staff</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TabBtn label="Sign In" active={tab === "signin"} onPress={() => setTab("signin")} />
          <TabBtn label="Driver" active={tab === "driver"} onPress={() => setTab("driver")} />
          <TabBtn label="Kitchen" active={tab === "kitchen"} onPress={() => setTab("kitchen")} />
        </View>

        {tab === "signin" && <SignInForm router={router} />}
        {tab === "driver" && <DriverRegisterForm onSuccess={() => setTab("signin")} />}
        {tab === "kitchen" && <KitchenRegisterForm onSuccess={() => setTab("signin")} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SignInForm({ router }: { router: { replace: (href: string) => void } }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return; }
    setError(null);
    setLoading(true);
    try {
      await businessSignIn(email.trim(), password);
      router.replace("/(app)/home");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Welcome back</Text>
      <Text style={styles.formSub}>Sign in with the credentials from your invite email.</Text>
      <Field label="Email" value={email} onChange={(t) => { setEmail(t); setError(null); }} keyboard="email-address" placeholder="you@smag.com" />
      <Field label="Password" value={password} onChange={(t) => { setPassword(t); setError(null); }} secure placeholder="••••••••" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#1a0d06" /> : <Text style={styles.btnText}>Sign In</Text>}
      </Pressable>
      <Text style={styles.hint}>First time? Use the "Set Up My Account" link from your invite email.</Text>
    </View>
  );
}

function DriverRegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", vehicleType: "", vehiclePlate: "", licenseNumber: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (val: string) => setForm(p => ({ ...p, [key]: val }));

  async function submit() {
    const { name, email, phone, vehicleType, vehiclePlate, licenseNumber } = form;
    if (!name.trim() || !email.trim() || !phone.trim() || !vehicleType.trim() || !vehiclePlate.trim()) {
      setError("All fields except license number are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    setError(null);
    setLoading(true);
    try {
      // Check for duplicate application
      const existing = await getDocs(query(collection(db, "driver_applications"), where("email", "==", email.trim().toLowerCase())));
      if (!existing.empty) { setError("An application with this email already exists."); return; }

      await addDoc(collection(db, "driver_applications"), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        vehicleType: vehicleType.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim(),
        status: "pending",
        appliedAtIso: new Date().toISOString()
      });
      Alert.alert(
        "Application Submitted! 🎉",
        "Your driver application has been received. You'll get an email with your login credentials once approved by our team.",
        [{ text: "OK", onPress: onSuccess }]
      );
    } catch (err: unknown) {
      setError((err as Error).message ?? "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Register as Driver</Text>
      <Text style={styles.formSub}>Apply to deliver for Smag. We'll review and send your login credentials.</Text>
      <Field label="Full Name" value={form.name} onChange={set("name")} placeholder="John Doe" />
      <Field label="Email Address" value={form.email} onChange={set("email")} keyboard="email-address" placeholder="john@example.com" />
      <Field label="Phone Number" value={form.phone} onChange={set("phone")} keyboard="phone-pad" placeholder="+234 801 234 5678" />
      <Field label="Vehicle Type" value={form.vehicleType} onChange={set("vehicleType")} placeholder="Motorcycle / Car / Bicycle" />
      <Field label="Vehicle Plate Number" value={form.vehiclePlate} onChange={set("vehiclePlate")} placeholder="ABC-123-XY" caps="characters" />
      <Field label="Driver's License Number (optional)" value={form.licenseNumber} onChange={set("licenseNumber")} placeholder="DL-XXXXXXXX" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.btn, { backgroundColor: "#ff7941" }, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#1a0d06" /> : <Text style={styles.btnText}>Submit Driver Application</Text>}
      </Pressable>
    </View>
  );
}

function KitchenRegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    businessName: "", ownerName: "", email: "", phone: "",
    address: "", cuisine: "", description: "", openingHours: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (val: string) => setForm(p => ({ ...p, [key]: val }));

  async function submit() {
    const { businessName, ownerName, email, phone, address, cuisine } = form;
    if (!businessName.trim() || !ownerName.trim() || !email.trim() || !phone.trim() || !address.trim() || !cuisine.trim()) {
      setError("Business name, owner name, email, phone, address, and cuisine are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    setError(null);
    setLoading(true);
    try {
      const existing = await getDocs(query(collection(db, "kitchen_applications"), where("email", "==", email.trim().toLowerCase())));
      if (!existing.empty) { setError("An application with this email already exists."); return; }

      await addDoc(collection(db, "kitchen_applications"), {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        cuisine: cuisine.trim(),
        description: form.description.trim(),
        openingHours: form.openingHours.trim(),
        status: "pending",
        appliedAtIso: new Date().toISOString()
      });
      Alert.alert(
        "Application Submitted! 🎉",
        "Your kitchen application has been received. Our team will review it and send your login credentials once approved.",
        [{ text: "OK", onPress: onSuccess }]
      );
    } catch (err: unknown) {
      setError((err as Error).message ?? "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Register Your Kitchen</Text>
      <Text style={styles.formSub}>Apply to list your restaurant on Smag. Once approved, you can add your menu and start receiving orders.</Text>
      <Field label="Business / Restaurant Name" value={form.businessName} onChange={set("businessName")} placeholder="The Gourmet Kitchen" />
      <Field label="Owner Full Name" value={form.ownerName} onChange={set("ownerName")} placeholder="Jane Smith" />
      <Field label="Business Email" value={form.email} onChange={set("email")} keyboard="email-address" placeholder="hello@yourkitchen.com" />
      <Field label="Phone Number" value={form.phone} onChange={set("phone")} keyboard="phone-pad" placeholder="+234 801 234 5678" />
      <Field label="Restaurant Address" value={form.address} onChange={set("address")} placeholder="123 Main Street, Lagos" />
      <Field label="Cuisine Type" value={form.cuisine} onChange={set("cuisine")} placeholder="Nigerian / Italian / Fast Food" />
      <Field label="Opening Hours (optional)" value={form.openingHours} onChange={set("openingHours")} placeholder="Mon-Fri 9am-10pm" />
      <Field label="Brief Description (optional)" value={form.description} onChange={set("description")} placeholder="What makes your kitchen special?" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.btn, { backgroundColor: "#4caf50" }, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#1a0d06" /> : <Text style={styles.btnText}>Submit Kitchen Application</Text>}
      </Pressable>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, secure, caps, multiline
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: "email-address" | "phone-pad" | "default";
  secure?: boolean;
  caps?: "none" | "characters" | "words";
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#3a1e0a"
        keyboardType={keyboard ?? "default"}
        secureTextEntry={secure}
        autoCapitalize={caps ?? (secure || keyboard === "email-address" ? "none" : "words")}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  scroll: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },
  logoWrap: { alignItems: "center", marginBottom: 28 },
  appName: { color: "#ffd4bd", fontSize: 28, fontWeight: "900", marginTop: 10 },
  appSub: { color: "#6b3a1f", fontSize: 14, marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: "#2a1508", alignItems: "center" },
  tabBtnActive: { backgroundColor: "#ff7941" },
  tabText: { color: "#6b3a1f", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#1a0d06" },
  form: { gap: 4 },
  formTitle: { color: "#ffd4bd", fontSize: 22, fontWeight: "900", marginBottom: 4 },
  formSub: { color: "#6b3a1f", fontSize: 13, lineHeight: 20, marginBottom: 16 },
  fieldWrap: { marginBottom: 12 },
  label: { color: "#c49070", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: "#2a1508", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: "#ffd4bd", borderWidth: 1, borderColor: "#3a1e0a" },
  error: { color: "#fb5151", fontSize: 13, marginTop: 4, marginBottom: 4 },
  btn: { marginTop: 8, backgroundColor: "#ff7941", borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  btnText: { color: "#1a0d06", fontWeight: "900", fontSize: 16 },
  hint: { marginTop: 16, color: "#3a1e0a", fontSize: 12, lineHeight: 18, textAlign: "center" }
});
