import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function NetworkBanner({ isOnline }: { isOnline: boolean }) {
  const translateY = useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOnline ? -48 : 0,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [isOnline, translateY]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <MaterialIcons name="cloud-off" size={14} color="#1a0d06" />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: "#f8a91f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  text: { color: "#1a0d06", fontWeight: "800", fontSize: 13 }
});
