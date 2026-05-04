import { create } from "zustand";
import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import type { BusinessProfile } from "./useBusinessProfile";

type Order = {
  id: string;
  restaurantName: string;
  deliveryAddress: string;
  total: number;
  status: string;
  items: { name: string; quantity: number }[];
  userId: string;
  assignedDriverUid?: string;
  restaurantId?: string;
};

type BusinessStore = {
  // Auth / profile
  profile: BusinessProfile | null;
  setProfile: (p: BusinessProfile | null) => void;

  // Orders assigned to this user
  assignedOrders: Order[];
  availableOrders: Order[];
  ordersLoading: boolean;

  // Subscriptions (stored so we can unsubscribe)
  _unsubAssigned: Unsubscribe | null;
  _unsubAvailable: Unsubscribe | null;

  // Actions
  startOrderSubscriptions: (uid: string, restaurantId?: string) => void;
  stopOrderSubscriptions: () => void;
};

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  profile: null,
  setProfile: (p) => set({ profile: p }),

  assignedOrders: [],
  availableOrders: [],
  ordersLoading: true,

  _unsubAssigned: null,
  _unsubAvailable: null,

  startOrderSubscriptions: (uid, restaurantId) => {
    // Stop any existing subscriptions first
    get().stopOrderSubscriptions();

    // Assigned orders — driver sees their own, kitchen sees their restaurant
    const assignedQ = restaurantId
      ? query(collection(db, "orders"), where("restaurantId", "==", restaurantId), where("status", "in", ["confirmed", "preparing", "on_delivery"]))
      : query(collection(db, "orders"), where("assignedDriverUid", "==", uid), where("status", "in", ["confirmed", "preparing", "on_delivery"]));

    const unsubAssigned = onSnapshot(assignedQ, (snap) => {
      set({
        assignedOrders: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)),
        ordersLoading: false
      });
    }, () => set({ ordersLoading: false }));

    // Available orders on_delivery not yet assigned to a driver
    // Orders are created with assignedDriverUid: "" so this query works
    const availQ = query(
      collection(db, "orders"),
      where("status", "==", "on_delivery"),
      where("assignedDriverUid", "==", "")
    );

    const unsubAvailable = onSnapshot(availQ, (snap) => {
      set({ availableOrders: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)) });
    });

    set({ _unsubAssigned: unsubAssigned, _unsubAvailable: unsubAvailable });
  },

  stopOrderSubscriptions: () => {
    const { _unsubAssigned, _unsubAvailable } = get();
    _unsubAssigned?.();
    _unsubAvailable?.();
    set({ _unsubAssigned: null, _unsubAvailable: null, assignedOrders: [], availableOrders: [], ordersLoading: true });
  }
}));
