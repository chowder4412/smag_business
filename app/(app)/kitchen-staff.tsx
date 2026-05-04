import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, businessSignOut } from "@/lib/firebase";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { OrderCardSkeleton } from "@/components/SkeletonLoader";
import { haptics } from "@/lib/haptics";
import { BusinessAccessGuard } from "@/components/BusinessAccessGuard";

type Order = {
  id: string;
  restaurantName: string;
  deliveryAddress: string;
  total: number;
  status: string;
  items: { name: string; quantity: number; price: number }[];
  createdAtIso?: string;
};

export default function KitchenStaffDashboard() {
  return (
    <BusinessAccessGuard permission="business_orders" role="kitchen_staff">
      <KitchenStaffDashboardContent />
    </BusinessAccessGuard>
  );
}

function KitchenStaffDashboardContent() {
  const router = useRouter() as { replace: (href: string) => void };
  const { profile } = useBusinessProfile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    // Filter to Smag Kitchen orders only — kitchen staff don't see external restaurant orders
    const q = query(
      collection(db, "orders"),
      where("restaurantId", "in", ["lartiste", "luigi", "ocean_garden"]),
      where("status", "in", ["confirmed", "preparing"])
    );
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) => (a.createdAtIso ?? "").localeCompare(b.createdAtIso ?? ""));
      setOrders(sorted);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  async function markPreparing(orderId: string) {
    setUpdatingId(orderId);
    try {
      const fn = httpsCallable<{ orderId: string; status: string }, { ok: boolean }>(functions, "updateOrderStatus");
      await fn({ orderId, status: "preparing" });
      void haptics.success();
    } catch (err: unknown) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function markReady(orderId: string) {
    setUpdatingId(orderId);
    try {
      const fn = httpsCallable<{ orderId: string; status: string }, { ok: boolean }>(functions, "updateOrderStatus");
      await fn({ orderId, status: "on_delivery" });
      void haptics.success();
    } catch (err: unknown) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kitchen Dashboard</Text>
          <Text style={styles.subtitle}>{profile?.name ?? ""} · Smag Kitchen</Text>
        </View>
        <Pressable onPress={() => { void businessSignOut().then(() => router.replace("/(auth)/login")); }}>
          <MaterialIcons name="logout" size={22} color="#6b3a1f" />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{orders.filter(o => o.status === "confirmed").length}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: "#f8a91f" }]}>{orders.filter(o => o.status === "preparing").length}</Text>
          <Text style={styles.statLabel}>Preparing</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <>
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </>
        ) : orders.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="restaurant" size={56} color="#2a1508" />
            <Text style={styles.emptyText}>No active orders right now</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={[styles.card, order.status === "preparing" && styles.cardPreparing]}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                <View style={[styles.badge, order.status === "preparing" && styles.badgePreparing]}>
                  <Text style={styles.badgeText}>{order.status === "confirmed" ? "NEW" : "PREPARING"}</Text>
                </View>
              </View>

              <View style={styles.itemsList}>
                {order.items?.map((item, i) => (
                  <View key={i} style={styles.itemRow}>
                    <Text style={styles.itemQty}>{item.quantity}x</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.address}>{order.deliveryAddress}</Text>

              <View style={styles.actions}>
                {order.status === "confirmed" && (
                  <Pressable
                    style={[styles.btn, styles.btnPrepare, updatingId === order.id && { opacity: 0.6 }]}
                    onPress={() => markPreparing(order.id)}
                    disabled={updatingId !== null}
                  >
                    {updatingId === order.id ? <ActivityIndicator color="#1a0d06" size="small" /> : <Text style={styles.btnText}>Start Preparing</Text>}
                  </Pressable>
                )}
                {order.status === "preparing" && (
                  <Pressable
                    style={[styles.btn, styles.btnReady, updatingId === order.id && { opacity: 0.6 }]}
                    onPress={() => markReady(order.id)}
                    disabled={updatingId !== null}
                  >
                    {updatingId === order.id ? <ActivityIndicator color="#1a0d06" size="small" /> : <Text style={styles.btnText}>Ready for Pickup</Text>}
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 8 },
  title: { color: "#ffd4bd", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#6b3a1f", fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: "#2a1508", borderRadius: 16, padding: 14, alignItems: "center" },
  statValue: { color: "#ff7941", fontSize: 28, fontWeight: "900" },
  statLabel: { color: "#6b3a1f", fontSize: 11, fontWeight: "700", marginTop: 2 },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { color: "#3a1e0a", fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: "#2a1508", borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: "#3a1e0a" },
  cardPreparing: { borderColor: "#f8a91f" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { color: "#f8a91f", fontWeight: "900", fontSize: 16, fontFamily: "monospace" },
  badge: { backgroundColor: "#3a1e0a", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePreparing: { backgroundColor: "#f8a91f33" },
  badgeText: { color: "#f8a91f", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  itemsList: { gap: 4 },
  itemRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  itemQty: { color: "#f8a91f", fontWeight: "900", fontSize: 15, width: 28 },
  itemName: { color: "#ffd4bd", fontSize: 15, fontWeight: "700" },
  address: { color: "#6b3a1f", fontSize: 12 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  btnPrepare: { backgroundColor: "#f8a91f" },
  btnReady: { backgroundColor: "#4caf50" },
  btnText: { color: "#1a0d06", fontWeight: "900", fontSize: 14 }
});
