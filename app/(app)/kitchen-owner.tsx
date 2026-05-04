import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection, onSnapshot, query, updateDoc, doc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, businessSignOut } from "@/lib/firebase";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { useBusinessStore } from "@/lib/store";
import { BusinessAccessGuard } from "@/components/BusinessAccessGuard";

type MenuItem = { id: string; name: string; description: string; price: number; category: string; available: boolean };
type Order = { id: string; status: string; total: number; items: { name: string; quantity: number }[]; createdAtIso?: string };

export default function KitchenOwnerDashboard() {
  return (
    <BusinessAccessGuard permission="business_menu" role="kitchen_owner">
      <KitchenOwnerDashboardContent />
    </BusinessAccessGuard>
  );
}

function KitchenOwnerDashboardContent() {
  const router = useRouter() as { replace: (href: string) => void; push: (href: string) => void };
  const { profile } = useBusinessProfile();
  const { assignedOrders: orders, ordersLoading: ordersLoadingFromStore, startOrderSubscriptions } = useBusinessStore();
  const [tab, setTab] = useState<"orders" | "menu">("orders");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", category: "" });
  const [addingItem, setAddingItem] = useState(false);

  const restaurantId = profile?.restaurantId;

  useEffect(() => {
    if (!restaurantId) return;
    startOrderSubscriptions("", restaurantId);
  }, [restaurantId, startOrderSubscriptions]);

  useEffect(() => {
    if (!restaurantId) return;
    const menuQ = query(collection(db, "external_menu_items"), where("restaurantId", "==", restaurantId));
    const unsubMenu = onSnapshot(menuQ, (snap) => {
      setMenuItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem)));
    });
    return () => { unsubMenu(); };
  }, [restaurantId]);

  async function updateOrderStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    try {
      const fn = httpsCallable<{ orderId: string; status: string }, { ok: boolean }>(functions, "updateOrderStatus");
      await fn({ orderId, status });
    } catch (err: unknown) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleMenuItem(item: MenuItem) {
    await updateDoc(doc(db, "external_menu_items", item.id), { available: !item.available });
  }

  async function addMenuItem() {
    if (!restaurantId || !newItem.name.trim() || !newItem.price) return;
    setAddingItem(true);
    try {
      await addDoc(collection(db, "external_menu_items"), {
        restaurantId,
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        price: Number(newItem.price),
        category: newItem.category.trim() || "Main",
        imageUrl: "",
        available: true
      });
      setNewItem({ name: "", description: "", price: "", category: "" });
    } catch (err: unknown) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setAddingItem(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{profile?.restaurantName ?? "My Kitchen"}</Text>
          <Text style={styles.subtitle}>{profile?.name ?? ""}</Text>
        </View>
        <Pressable onPress={() => { void businessSignOut().then(() => router.replace("/(auth)/login")); }}>
          <MaterialIcons name="logout" size={22} color="#6b3a1f" />
        </Pressable>
        <Pressable onPress={() => router.push("/(app)/kitchen-profile")} style={{ marginLeft: 8 }}>
          <MaterialIcons name="settings" size={22} color="#4caf50" />
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === "orders" && styles.tabBtnActive]} onPress={() => setTab("orders")}>
          <Text style={[styles.tabText, tab === "orders" && styles.tabTextActive]}>Orders ({orders.length})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === "menu" && styles.tabBtnActive]} onPress={() => setTab("menu")}>
          <Text style={[styles.tabText, tab === "menu" && styles.tabTextActive]}>Menu ({menuItems.length})</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {tab === "orders" ? (
          loading ? <ActivityIndicator color="#4caf50" style={{ marginTop: 60 }} /> :
          orders.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="receipt-long" size={48} color="#2a1508" />
              <Text style={styles.emptyText}>No active orders</Text>
            </View>
          ) : orders.map((order) => (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.total}>₦{order.total?.toLocaleString()}</Text>
              </View>
              <Text style={styles.items}>{order.items?.map(i => `${i.quantity}x ${i.name}`).join(", ")}</Text>
              <View style={styles.actions}>
                {order.status === "confirmed" && (
                  <Pressable style={[styles.btn, { backgroundColor: "#f8a91f" }]} onPress={() => updateOrderStatus(order.id, "preparing")} disabled={updatingId !== null}>
                    <Text style={styles.btnText}>Start Preparing</Text>
                  </Pressable>
                )}
                {order.status === "preparing" && (
                  <Pressable style={[styles.btn, { backgroundColor: "#4caf50" }]} onPress={() => updateOrderStatus(order.id, "on_delivery")} disabled={updatingId !== null}>
                    <Text style={styles.btnText}>Ready for Pickup</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        ) : (
          <>
            <View style={styles.addCard}>
              <Text style={styles.addTitle}>Add Menu Item</Text>
              <TextInput style={styles.input} placeholder="Item name" placeholderTextColor="#3a1e0a" value={newItem.name} onChangeText={(t) => setNewItem(p => ({ ...p, name: t }))} />
              <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#3a1e0a" value={newItem.description} onChangeText={(t) => setNewItem(p => ({ ...p, description: t }))} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Price (₦)" placeholderTextColor="#3a1e0a" keyboardType="numeric" value={newItem.price} onChangeText={(t) => setNewItem(p => ({ ...p, price: t }))} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Category" placeholderTextColor="#3a1e0a" value={newItem.category} onChangeText={(t) => setNewItem(p => ({ ...p, category: t }))} />
              </View>
              <Pressable style={[styles.btn, { backgroundColor: "#4caf50", marginTop: 4 }, addingItem && { opacity: 0.6 }]} onPress={addMenuItem} disabled={addingItem}>
                {addingItem ? <ActivityIndicator color="#1a0d06" size="small" /> : <Text style={styles.btnText}>Add Item</Text>}
              </Pressable>
            </View>

            {menuItems.map((item) => (
              <View key={item.id} style={styles.menuCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuName}>{item.name}</Text>
                  <Text style={styles.menuDesc}>{item.description}</Text>
                  <Text style={styles.menuPrice}>₦{item.price.toLocaleString()} · {item.category}</Text>
                </View>
                <Pressable style={[styles.toggleBtn, item.available && styles.toggleBtnActive]} onPress={() => toggleMenuItem(item)}>
                  <Text style={styles.toggleText}>{item.available ? "Available" : "Hidden"}</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 8 },
  title: { color: "#ffd4bd", fontSize: 22, fontWeight: "900" },
  subtitle: { color: "#6b3a1f", fontSize: 13, marginTop: 2 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: "#2a1508", alignItems: "center" },
  tabBtnActive: { backgroundColor: "#4caf50" },
  tabText: { color: "#6b3a1f", fontWeight: "700" },
  tabTextActive: { color: "#1a0d06" },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyText: { color: "#3a1e0a", fontSize: 15, fontWeight: "700" },
  card: { backgroundColor: "#2a1508", borderRadius: 18, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  orderId: { color: "#4caf50", fontWeight: "900", fontFamily: "monospace" },
  total: { color: "#ffd4bd", fontWeight: "900", fontSize: 16 },
  items: { color: "#805032", fontSize: 13 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  btnText: { color: "#1a0d06", fontWeight: "900", fontSize: 14 },
  addCard: { backgroundColor: "#2a1508", borderRadius: 18, padding: 14, gap: 8 },
  addTitle: { color: "#ffd4bd", fontSize: 16, fontWeight: "900" },
  input: { backgroundColor: "#1a0d06", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: "#ffd4bd", fontSize: 14, borderWidth: 1, borderColor: "#3a1e0a" },
  menuCard: { backgroundColor: "#2a1508", borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  menuName: { color: "#ffd4bd", fontWeight: "800", fontSize: 15 },
  menuDesc: { color: "#6b3a1f", fontSize: 12, marginTop: 2 },
  menuPrice: { color: "#4caf50", fontWeight: "700", fontSize: 13, marginTop: 4 },
  toggleBtn: { backgroundColor: "#3a1e0a", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  toggleBtnActive: { backgroundColor: "#4caf5033" },
  toggleText: { color: "#4caf50", fontWeight: "800", fontSize: 12 }
});
