import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { httpsCallable } from "firebase/functions";
import { db, functions, getCurrentUser, businessSignOut } from "@/lib/firebase";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { useBusinessStore } from "@/lib/store";
import { OrderCardSkeleton } from "@/components/SkeletonLoader";
import { haptics } from "@/lib/haptics";
import { BusinessAccessGuard } from "@/components/BusinessAccessGuard";

type Order = {
  id: string;
  restaurantName: string;
  deliveryAddress: string;
  total: number;
  status: string;
  items: { name: string; quantity: number }[];
  userId: string;
};

const STATUS_FLOW: Record<string, string> = {
  confirmed: "preparing",
  preparing: "on_delivery",
  on_delivery: "delivered"
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  preparing: "Preparing",
  on_delivery: "On Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

export default function DriverDashboard() {
  return (
    <BusinessAccessGuard permission="business_driver" role="driver">
      <DriverDashboardContent />
    </BusinessAccessGuard>
  );
}

function DriverDashboardContent() {
  const router = useRouter() as { replace: (href: string) => void; push: (href: string) => void };
  const { profile } = useBusinessProfile();
  const { assignedOrders: orders, availableOrders, ordersLoading: loading, startOrderSubscriptions, addPendingUpdate, flushPendingUpdates, pendingUpdates } = useBusinessStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [tab, setTab] = useState<"assigned" | "available">("assigned");
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const user = getCurrentUser();

  useEffect(() => {
    if (!user) return;
    startOrderSubscriptions(user.uid);
  }, [user, startOrderSubscriptions]);

  // Flush pending offline updates when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void flushPendingUpdates();
    });
    return () => sub.remove();
  }, [flushPendingUpdates]);

  // Start broadcasting GPS when on_delivery
  useEffect(() => {
    if (!trackingOrderId) {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      return;
    }

    void Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") return;
      locationIntervalRef.current = setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const fn = httpsCallable(functions, "updateDriverLocation");
        void fn({ orderId: trackingOrderId, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }, 10000); // every 10 seconds
    });

    return () => { if (locationIntervalRef.current) clearInterval(locationIntervalRef.current); };
  }, [trackingOrderId]);

  async function selfAssign(orderId: string) {
    if (!user) return;
    setUpdatingId(orderId);
    try {
      const fn = httpsCallable<{ orderId: string; status: string; driverName?: string }, { ok: boolean }>(functions, "updateOrderStatus");
      await fn({ orderId, status: "on_delivery", driverName: profile?.name });
      void haptics.success();
      setTrackingOrderId(orderId);
      setTab("assigned");
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("network") || msg.includes("unavailable")) {
        addPendingUpdate({ orderId, status: "on_delivery", driverName: profile?.name });
        Alert.alert("Offline", "You're offline. This will sync automatically when you reconnect.");
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateStatus(order: Order) {
    const nextStatus = STATUS_FLOW[order.status];
    if (!nextStatus) return;
    setUpdatingId(order.id);
    try {
      const fn = httpsCallable<{ orderId: string; status: string; driverName?: string }, { ok: boolean }>(functions, "updateOrderStatus");
      await fn({ orderId: order.id, status: nextStatus, driverName: profile?.name });
      void haptics.success();
      if (nextStatus === "on_delivery") setTrackingOrderId(order.id);
      if (nextStatus === "delivered") setTrackingOrderId(null);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("network") || msg.includes("unavailable")) {
        addPendingUpdate({ orderId: order.id, status: nextStatus, driverName: profile?.name });
        Alert.alert("Offline", "You're offline. This will sync automatically when you reconnect.");
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Driver Dashboard</Text>
          <Text style={styles.subtitle}>{profile?.name ?? ""}</Text>
        </View>
        <Pressable onPress={() => { void businessSignOut().then(() => router.replace("/(auth)/login")); }}>
          <MaterialIcons name="logout" size={22} color="#6b3a1f" />
        </Pressable>
      </View>

      {trackingOrderId && (
        <View style={styles.trackingBanner}>
          <MaterialIcons name="location-on" size={16} color="#1a0d06" />
          <Text style={styles.trackingText}>Live GPS active — broadcasting location</Text>
        </View>
      )}

      {pendingUpdates.length > 0 && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="cloud-off" size={16} color="#f8a91f" />
          <Text style={styles.offlineText}>{pendingUpdates.length} update{pendingUpdates.length > 1 ? "s" : ""} pending sync</Text>
          <Pressable onPress={() => void flushPendingUpdates()} style={styles.retrySync}>
            <Text style={styles.retrySyncText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {pendingUpdates.length > 0 && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="cloud-off" size={16} color="#f8a91f" />
          <Text style={styles.offlineText}>{pendingUpdates.length} update{pendingUpdates.length > 1 ? "s" : ""} pending sync</Text>
          <Pressable onPress={() => void flushPendingUpdates()} style={styles.retrySync}>
            <Text style={styles.retrySyncText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === "assigned" && styles.tabBtnActive]} onPress={() => setTab("assigned")}>
          <Text style={[styles.tabText, tab === "assigned" && styles.tabTextActive]}>My Orders ({orders.length})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === "available" && styles.tabBtnActive]} onPress={() => setTab("available")}>
          <Text style={[styles.tabText, tab === "available" && styles.tabTextActive]}>
            Available ({availableOrders.length})
            {availableOrders.length > 0 && <Text style={styles.newBadge}> NEW</Text>}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <>
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </>
        ) : tab === "available" ? (
          availableOrders.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={56} color="#2a1508" />
              <Text style={styles.emptyText}>No available orders right now</Text>
              <Text style={{ color: "#3a1e0a", fontSize: 13, textAlign: "center" }}>New orders will appear here when ready for pickup</Text>
            </View>
          ) : (
            availableOrders.map((order) => (
              <View key={order.id} style={[styles.card, { borderColor: "#f8a91f" }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: "#f8a91f22" }]}>
                    <Text style={[styles.statusText, { color: "#f8a91f" }]}>READY FOR PICKUP</Text>
                  </View>
                </View>
                <Text style={styles.restaurant}>{order.restaurantName}</Text>
                <View style={styles.row}>
                  <MaterialIcons name="place" size={14} color="#805032" />
                  <Text style={styles.address}>{order.deliveryAddress}</Text>
                </View>
                <Text style={styles.items}>{order.items?.map(i => `${i.quantity}x ${i.name}`).join(", ")}</Text>
                <Text style={styles.total}>₦{order.total?.toLocaleString()}</Text>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#f8a91f" }, updatingId === order.id && { opacity: 0.6 }]}
                  onPress={() => selfAssign(order.id)}
                  disabled={updatingId !== null}
                >
                  {updatingId === order.id
                    ? <ActivityIndicator color="#1a0d06" size="small" />
                    : <Text style={styles.actionBtnText}>Accept & Start Delivery</Text>}
                </Pressable>
              </View>
            ))
          )
        ) : orders.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="delivery-dining" size={56} color="#2a1508" />
            <Text style={styles.emptyText}>No active orders assigned to you</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                <View style={[styles.statusBadge, order.status === "on_delivery" && styles.statusActive]}>
                  <Text style={styles.statusText}>{STATUS_LABEL[order.status] ?? order.status}</Text>
                </View>
              </View>

              <Text style={styles.restaurant}>{order.restaurantName}</Text>
              <View style={styles.row}>
                <MaterialIcons name="place" size={14} color="#805032" />
                <Text style={styles.address}>{order.deliveryAddress}</Text>
              </View>
              <Text style={styles.items}>{order.items?.map(i => `${i.quantity}x ${i.name}`).join(", ")}</Text>
              <Text style={styles.total}>₦{order.total?.toLocaleString()}</Text>

              {STATUS_FLOW[order.status] && (
                <View style={styles.btnRow}>
                  <Pressable
                    style={[styles.actionBtn, { flex: 1 }, updatingId === order.id && { opacity: 0.6 }]}
                    onPress={() => updateStatus(order)}
                    disabled={updatingId !== null}
                  >
                    {updatingId === order.id
                      ? <ActivityIndicator color="#1a0d06" size="small" />
                      : <Text style={styles.actionBtnText}>
                          Mark as {STATUS_LABEL[STATUS_FLOW[order.status]]}
                        </Text>}
                  </Pressable>
                  <Pressable
                    style={styles.mapBtn}
                    onPress={() => router.push(`/(app)/driver-map?orderId=${order.id}` as never)}
                  >
                    <MaterialIcons name="map" size={20} color="#ff7941" />
                  </Pressable>
                </View>
              )}
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
  trackingBanner: { backgroundColor: "#ff7941", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  trackingText: { color: "#1a0d06", fontWeight: "800", fontSize: 13 },
  offlineBanner: { backgroundColor: "#2a1508", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f8a91f33" },
  offlineText: { color: "#f8a91f", fontWeight: "700", fontSize: 12, flex: 1 },
  retrySync: { backgroundColor: "#f8a91f22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  retrySyncText: { color: "#f8a91f", fontWeight: "800", fontSize: 11 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: "#2a1508", alignItems: "center" },
  tabBtnActive: { backgroundColor: "#ff7941" },
  tabText: { color: "#6b3a1f", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#1a0d06" },
  newBadge: { color: "#f8a91f", fontWeight: "900", fontSize: 10 },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { color: "#3a1e0a", fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: "#2a1508", borderRadius: 20, padding: 16, gap: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { color: "#ff7941", fontWeight: "900", fontSize: 15, fontFamily: "monospace" },
  statusBadge: { backgroundColor: "#3a1e0a", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusActive: { backgroundColor: "#ff7941" },
  statusText: { color: "#ffd4bd", fontSize: 11, fontWeight: "800" },
  restaurant: { color: "#ffd4bd", fontSize: 18, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  address: { color: "#805032", fontSize: 13, flex: 1 },
  items: { color: "#6b3a1f", fontSize: 12 },
  total: { color: "#ff7941", fontSize: 20, fontWeight: "900" },
  actionBtn: { backgroundColor: "#ff7941", borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  actionBtnText: { color: "#1a0d06", fontWeight: "900", fontSize: 15 },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  mapBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#2a1508", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ff7941" }
});
