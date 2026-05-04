import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, businessSignOut } from "@/lib/firebase";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { BusinessAccessGuard } from "@/components/BusinessAccessGuard";

type Order = { id: string; restaurantName: string; status: string; total: number; items: { name: string; quantity: number }[]; createdAtIso?: string };
type Employee = { id: string; name: string; email: string; status: string; roleId: string };

export default function ManagerDashboard() {
  const { profile, loading, error } = useBusinessProfile();
  return (
    <BusinessAccessGuard permission="business_team" role="manager" profile={profile} loading={loading} error={error}>
      <ManagerDashboardContent profile={profile} />
    </BusinessAccessGuard>
  );
}

function ManagerDashboardContent({ profile }: { profile: ReturnType<typeof useBusinessProfile>["profile"] }) {
  const router = useRouter() as { replace: (href: string) => void };
  const [tab, setTab] = useState<"orders" | "team">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try { await businessSignOut(); router.replace("/(auth)/login"); }
    finally { setSigningOut(false); }
  }

  useEffect(() => {
    const ordersQ = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(30));
    const unsubOrders = onSnapshot(ordersQ, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    });
    const empQ = query(collection(db, "employees"));
    const unsubEmp = onSnapshot(empQ, (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
    });
    return () => { unsubOrders(); unsubEmp(); };
  }, []);

  async function updateStatus(orderId: string, status: string) {
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

  const STATUS_COLORS: Record<string, string> = {
    confirmed: "#f8a91f", preparing: "#ff7941", on_delivery: "#2196f3", delivered: "#4caf50", cancelled: "#fb5151", pending_payment: "#9c27b0"
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Manager Dashboard</Text>
          <Text style={styles.subtitle}>{profile?.name ?? ""}</Text>
        </View>
        <Pressable onPress={handleSignOut} disabled={signingOut}>
          {signingOut
            ? <ActivityIndicator color="#6b3a1f" size="small" />
            : <MaterialIcons name="logout" size={22} color="#6b3a1f" />}
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statVal}>{orders.filter(o => ["confirmed","preparing","on_delivery"].includes(o.status)).length}</Text><Text style={styles.statLabel}>Active</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: "#4caf50" }]}>{orders.filter(o => o.status === "delivered").length}</Text><Text style={styles.statLabel}>Delivered</Text></View>
        <View style={styles.stat}><Text style={[styles.statVal, { color: "#2196f3" }]}>{employees.filter(e => e.status === "active").length}</Text><Text style={styles.statLabel}>Staff</Text></View>
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === "orders" && styles.tabActive]} onPress={() => setTab("orders")}>
          <Text style={[styles.tabText, tab === "orders" && styles.tabTextActive]}>Orders</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === "team" && styles.tabActive]} onPress={() => setTab("team")}>
          <Text style={[styles.tabText, tab === "team" && styles.tabTextActive]}>Team</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? <ActivityIndicator color="#9c27b0" style={{ marginTop: 60 }} /> :
        tab === "orders" ? orders.map((order) => (
          <View key={order.id} style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
              <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[order.status] ?? "#666"}22` }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[order.status] ?? "#666" }]}>{order.status}</Text>
              </View>
              <Text style={styles.total}>₦{order.total?.toLocaleString()}</Text>
            </View>
            <Text style={styles.restaurant}>{order.restaurantName}</Text>
            <Text style={styles.items}>{order.items?.map(i => `${i.quantity}x ${i.name}`).join(", ")}</Text>
            {["confirmed","preparing","on_delivery"].includes(order.status) && (
              <View style={styles.actions}>
                {order.status === "confirmed" && <Pressable style={[styles.btn, { backgroundColor: "#f8a91f" }]} onPress={() => updateStatus(order.id, "preparing")} disabled={updatingId !== null}><Text style={styles.btnText}>Preparing</Text></Pressable>}
                {order.status === "preparing" && <Pressable style={[styles.btn, { backgroundColor: "#2196f3" }]} onPress={() => updateStatus(order.id, "on_delivery")} disabled={updatingId !== null}><Text style={styles.btnText}>On Delivery</Text></Pressable>}
                {order.status === "on_delivery" && <Pressable style={[styles.btn, { backgroundColor: "#4caf50" }]} onPress={() => updateStatus(order.id, "delivered")} disabled={updatingId !== null}><Text style={styles.btnText}>Delivered</Text></Pressable>}
                <Pressable style={[styles.btn, { backgroundColor: "#fb515122" }]} onPress={() => updateStatus(order.id, "cancelled")} disabled={updatingId !== null}><Text style={[styles.btnText, { color: "#fb5151" }]}>Cancel</Text></Pressable>
              </View>
            )}
          </View>
        )) : employees.map((emp) => (
          <View key={emp.id} style={styles.empCard}>
            <View style={styles.empIcon}><MaterialIcons name="person" size={22} color="#9c27b0" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.empName}>{emp.name}</Text>
              <Text style={styles.empEmail}>{emp.email}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: emp.status === "active" ? "#4caf5022" : "#fb515122" }]}>
              <Text style={[styles.badgeText, { color: emp.status === "active" ? "#4caf50" : "#fb5151" }]}>{emp.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 8 },
  title: { color: "#ffd4bd", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#6b3a1f", fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: "#2a1508", borderRadius: 14, padding: 12, alignItems: "center" },
  statVal: { color: "#ff7941", fontSize: 24, fontWeight: "900" },
  statLabel: { color: "#6b3a1f", fontSize: 11, fontWeight: "700", marginTop: 2 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: "#2a1508", alignItems: "center" },
  tabActive: { backgroundColor: "#9c27b0" },
  tabText: { color: "#6b3a1f", fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: "#2a1508", borderRadius: 18, padding: 14, gap: 6 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderId: { color: "#9c27b0", fontWeight: "900", fontFamily: "monospace", fontSize: 13 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  total: { marginLeft: "auto", color: "#ffd4bd", fontWeight: "900" },
  restaurant: { color: "#ffd4bd", fontWeight: "800" },
  items: { color: "#6b3a1f", fontSize: 12 },
  actions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  btn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: "#1a0d06", fontWeight: "800", fontSize: 12 },
  empCard: { backgroundColor: "#2a1508", borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  empIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1a0d06", alignItems: "center", justifyContent: "center" },
  empName: { color: "#ffd4bd", fontWeight: "800" },
  empEmail: { color: "#6b3a1f", fontSize: 12, marginTop: 2 }
});
