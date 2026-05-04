import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { BusinessAccessGuard } from "@/components/BusinessAccessGuard";

export default function KitchenProfileScreen() {
  const { profile, loading, error } = useBusinessProfile();
  return (
    <BusinessAccessGuard permission="business_menu" role="kitchen_owner" profile={profile} loading={loading} error={error}>
      <KitchenProfileContent profile={profile} />
    </BusinessAccessGuard>
  );
}

function KitchenProfileContent({ profile }: { profile: ReturnType<typeof useBusinessProfile>["profile"] }) {
  const router = useRouter() as { back: () => void };
  const restaurantId = profile?.restaurantId;

  const [form, setForm] = useState({
    name: "",
    cuisine: "",
    address: "",
    deliveryMinutes: "",
    deliveryFee: "",
    minimumOrder: "",
    openingHours: "",
    description: "",
    imageUrl: "",
    isOpen: false,
    latitude: "",
    longitude: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  async function useMyLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied", "Location permission is required."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm(p => ({
        ...p,
        latitude: String(loc.coords.latitude),
        longitude: String(loc.coords.longitude)
      }));
    } catch {
      Alert.alert("Error", "Could not get location.");
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    if (!restaurantId) return;
    void getDoc(doc(db, "external_restaurants", restaurantId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          name: String(d.name ?? ""),
          cuisine: String(d.cuisine ?? ""),
          address: String(d.address ?? ""),
          deliveryMinutes: String(d.deliveryMinutes ?? ""),
          deliveryFee: String(d.deliveryFee ?? ""),
          minimumOrder: String(d.minimumOrder ?? ""),
          openingHours: String(d.openingHours ?? ""),
          description: String(d.description ?? ""),
          imageUrl: String(d.imageUrl ?? ""),
          isOpen: Boolean(d.isOpen ?? false),
          latitude: String(d.latitude ?? ""),
          longitude: String(d.longitude ?? "")
        });
      }
      setLoading(false);
    });
  }, [restaurantId]);

  const set = (key: keyof typeof form) => (val: string | boolean) =>
    setForm(p => ({ ...p, [key]: val }));

  async function save() {
    if (!restaurantId) return;
    if (!form.name.trim() || !form.cuisine.trim()) {
      Alert.alert("Validation", "Restaurant name and cuisine are required.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "external_restaurants", restaurantId), {
        name: form.name.trim(),
        cuisine: form.cuisine.trim(),
        address: form.address.trim(),
        deliveryMinutes: form.deliveryMinutes.trim(),
        deliveryFee: Number(form.deliveryFee) || 0,
        minimumOrder: Number(form.minimumOrder) || 0,
        openingHours: form.openingHours.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        isOpen: form.isOpen,
        latitude: Number(form.latitude) || 0,
        longitude: Number(form.longitude) || 0
      });
      Alert.alert("Saved", "Your restaurant profile has been updated.");
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color="#4caf50" size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#4caf50" />
        </Pressable>
        <Text style={styles.title}>Restaurant Profile</Text>
        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#1a0d06" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Open/Close toggle */}
        <View style={styles.toggleCard}>
          <View>
            <Text style={styles.toggleLabel}>Restaurant Status</Text>
            <Text style={styles.toggleSub}>{form.isOpen ? "Currently accepting orders" : "Currently closed"}</Text>
          </View>
          <Switch
            value={form.isOpen}
            onValueChange={(v) => set("isOpen")(v)}
            trackColor={{ false: "#3a1e0a", true: "#4caf50" }}
            thumbColor="#fff"
          />
        </View>

        <Field label="Restaurant Name" value={form.name} onChange={set("name")} placeholder="The Gourmet Kitchen" />
        <Field label="Cuisine Type" value={form.cuisine} onChange={set("cuisine")} placeholder="Nigerian / Italian / Fast Food" />
        <Field label="Address" value={form.address} onChange={set("address")} placeholder="123 Main Street, Lagos" />
        <Field label="Cover Image URL" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://..." keyboard="url" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Delivery Time (e.g. 20-30)" value={form.deliveryMinutes} onChange={set("deliveryMinutes")} placeholder="20-30" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Delivery Fee (₦)" value={form.deliveryFee} onChange={set("deliveryFee")} placeholder="500" keyboard="numeric" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Minimum Order (₦)" value={form.minimumOrder} onChange={set("minimumOrder")} placeholder="2000" keyboard="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Opening Hours" value={form.openingHours} onChange={set("openingHours")} placeholder="9am - 10pm" />
          </View>
        </View>

        <Field label="Description" value={form.description} onChange={set("description")} placeholder="What makes your kitchen special?" multiline />

        {/* Coordinates */}
        <View style={styles.coordCard}>
          <View style={styles.coordHeader}>
            <Text style={styles.coordTitle}>Location Coordinates</Text>
            <Text style={styles.coordSub}>Used to show your restaurant in nearby search results</Text>
          </View>
          <Pressable style={[styles.locBtn, locating && { opacity: 0.6 }]} onPress={useMyLocation} disabled={locating}>
            {locating
              ? <ActivityIndicator color="#1a0d06" size="small" />
              : <><MaterialIcons name="my-location" size={16} color="#1a0d06" /><Text style={styles.locBtnText}>Use My Current Location</Text></>}
          </Pressable>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Latitude" value={form.latitude} onChange={set("latitude")} placeholder="6.4281" keyboard="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Longitude" value={form.longitude} onChange={set("longitude")} placeholder="3.4219" keyboard="numeric" />
            </View>
          </View>
          {form.latitude && form.longitude ? (
            <Text style={styles.coordSet}>✓ Coordinates set — your restaurant will appear in nearby results</Text>
          ) : (
            <Text style={styles.coordMissing}>⚠ No coordinates — tap "Use My Location" or enter manually</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, multiline
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: "default" | "numeric" | "url" | "email-address";
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
        multiline={multiline}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2a1508", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: "#ffd4bd", fontSize: 20, fontWeight: "900" },
  saveBtn: { backgroundColor: "#4caf50", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  saveBtnText: { color: "#1a0d06", fontWeight: "900", fontSize: 14 },
  content: { padding: 16, gap: 4 },
  toggleCard: { backgroundColor: "#2a1508", borderRadius: 16, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  toggleLabel: { color: "#ffd4bd", fontWeight: "800", fontSize: 15 },
  toggleSub: { color: "#6b3a1f", fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", gap: 8 },
  fieldWrap: { marginBottom: 12 },
  label: { color: "#c49070", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: "#2a1508", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: "#ffd4bd", borderWidth: 1, borderColor: "#3a1e0a" },
  coordCard: { backgroundColor: "#2a1508", borderRadius: 16, padding: 14, marginBottom: 12, gap: 10 },
  coordHeader: { gap: 2 },
  coordTitle: { color: "#ffd4bd", fontWeight: "800", fontSize: 14 },
  coordSub: { color: "#6b3a1f", fontSize: 12 },
  locBtn: { backgroundColor: "#4caf50", borderRadius: 999, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  locBtnText: { color: "#1a0d06", fontWeight: "800", fontSize: 14 },
  coordSet: { color: "#4caf50", fontSize: 12, fontWeight: "700" },
  coordMissing: { color: "#f8a91f", fontSize: 12, fontWeight: "700" }
});
