import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export function SkeletonBox({
  width, height, borderRadius = 12, style
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true })
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: "#2a1508", opacity }, style]}
    />
  );
}

export function OrderCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBox width={80} height={16} borderRadius={6} />
        <SkeletonBox width={60} height={16} borderRadius={6} />
      </View>
      <SkeletonBox width="70%" height={20} borderRadius={6} style={{ marginTop: 8 }} />
      <SkeletonBox width="90%" height={14} borderRadius={6} style={{ marginTop: 6 }} />
      <SkeletonBox width="100%" height={44} borderRadius={999} style={{ marginTop: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#2a1508", borderRadius: 20, padding: 16, gap: 4, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between" }
});
