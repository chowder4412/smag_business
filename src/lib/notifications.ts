import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db, getCurrentUser } from "./firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name: "New Orders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default"
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Save token to employee/kitchen_owner profile
  const user = getCurrentUser();
  if (user && token) {
    try {
      const employeeSnap = await getDocs(query(collection(db, "employees"), where("uid", "==", user.uid)));
      if (!employeeSnap.empty) {
        await updateDoc(employeeSnap.docs[0].ref, { pushToken: token }).catch(() => {});
      }
      await updateDoc(doc(db, "kitchen_owners", user.uid), { pushToken: token }).catch(() => {});
    } catch { /* non-fatal */ }
  }

  return token;
}

export function addNotificationListener(
  onReceived: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void
) {
  const receivedSub = Notifications.addNotificationReceivedListener(onReceived);
  const responseSub = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => { receivedSub.remove(); responseSub.remove(); };
}
