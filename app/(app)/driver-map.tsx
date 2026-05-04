import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { BusinessAccessGuard } from "@/components/BusinessAccessGuard";

type Order = {
  id: string;
  restaurantName: string;
  deliveryAddress: string;
  restaurantLat?: number;
  restaurantLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  status: string;
};

// Default Lagos coords
const DEFAULT_RESTAURANT = { latitude: 6.4281, longitude: 3.4219 };
const DEFAULT_DELIVERY = { latitude: 6.4350, longitude: 3.4300 };

export default function DriverMapScreen() {
  return (
    <BusinessAccessGuard permission="business_driver" role="driver">
      <DriverMapContent />
    </BusinessAccessGuard>
  );
}

function DriverMapContent() {
  const router = useRouter() as { back: () => void };
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const mapRef = useRef<MapView>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [driverCoord, setDriverCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to order for restaurant/delivery coords
  useEffect(() => {
    if (!orderId) return;
    return onSnapshot(doc(db, "orders", orderId), (snap) => {
      if (snap.exists()) setOrder({ id: snap.id, ...snap.data() } as Order);
      setLoading(false);
    });
  }, [orderId]);

  // Watch driver's own GPS and broadcast to Firestore
  useEffect(() => {
    if (!orderId) return;
    let watchSub: Location.LocationSubscription | null = null;

    void Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") return;
      void Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setDriverCoord(coord);
          // Broadcast to Firestore
          const fn = httpsCallable(functions, "updateDriverLocation");
          void fn({ orderId, latitude: coord.latitude, longitude: coord.longitude });
        }
      ).then((sub) => { watchSub = sub; });
    });

    return () => { watchSub?.remove(); };
  }, [orderId]);

  const restaurantCoord = order?.restaurantLat && order?.restaurantLng
    ? { latitude: order.restaurantLat, longitude: order.restaurantLng }
    : DEFAULT_RESTAURANT;

  const deliveryCoord = order?.deliveryLat && order?.deliveryLng
    ? { latitude: order.deliveryLat, longitude: order.deliveryLng }
    : DEFAULT_DELIVERY;

  const midLat = (restaurantCoord.latitude + deliveryCoord.latitude) / 2;
  const midLng = (restaurantCoord.longitude + deliveryCoord.longitude) / 2;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#ff7941" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Navigation</Text>
          {order && <Text style={styles.subtitle}>{order.deliveryAddress}</Text>}
        </View>
        {driverCoord && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff7941" size="large" />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: Math.abs(restaurantCoord.latitude - deliveryCoord.latitude) * 3 + 0.02,
            longitudeDelta: Math.abs(restaurantCoord.longitude - deliveryCoord.longitude) * 3 + 0.02
          }}
          showsUserLocation
          showsMyLocationButton
        >
          {/* Restaurant */}
          <Marker coordinate={restaurantCoord} title={order?.restaurantName ?? "Restaurant"}>
            <View style={styles.markerRestaurant}>
              <MaterialIcons name="restaurant" size={16} color="#ff7941" />
            </View>
          </Marker>

          {/* Delivery */}
          <Marker coordinate={deliveryCoord} title="Delivery Address">
            <View style={styles.markerDelivery}>
              <MaterialIcons name="home" size={16} color="#fff" />
            </View>
          </Marker>

          {/* Driver position */}
          {driverCoord && (
            <Marker coordinate={driverCoord} title="You" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.markerDriver}>
                <MaterialIcons name="delivery-dining" size={18} color="#1a0d06" />
              </View>
            </Marker>
          )}

          {/* Route */}
          <Polyline
            coordinates={[
              restaurantCoord,
              ...(driverCoord ? [driverCoord] : []),
              deliveryCoord
            ]}
            strokeColor="#ff7941"
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        </MapView>
      )}

      {order && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name="restaurant" size={16} color="#ff7941" />
            <Text style={styles.infoText}>{order.restaurantName}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="place" size={16} color="#4caf50" />
            <Text style={styles.infoText}>{order.deliveryAddress}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: order.status === "on_delivery" ? "#ff794122" : "#2a1508" }]}>
            <Text style={styles.statusText}>{order.status.replace("_", " ").toUpperCase()}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2a1508", alignItems: "center", justifyContent: "center" },
  title: { color: "#ffd4bd", fontSize: 18, fontWeight: "900" },
  subtitle: { color: "#6b3a1f", fontSize: 12, marginTop: 1 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ff794122", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ff7941" },
  liveText: { color: "#ff7941", fontSize: 11, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  map: { flex: 1 },
  markerRestaurant: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#2a1508", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#ff7941" },
  markerDelivery: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#4caf50", alignItems: "center", justifyContent: "center" },
  markerDriver: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ff7941", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  infoCard: { backgroundColor: "#2a1508", padding: 16, gap: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { color: "#ffd4bd", fontSize: 13, flex: 1 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  statusText: { color: "#ff7941", fontSize: 11, fontWeight: "900", letterSpacing: 1 }
});
