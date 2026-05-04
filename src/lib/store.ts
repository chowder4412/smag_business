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

type PendingUpdate = {
  orderId: string;
  status: string;
  driverName?: string;
  retries: number;
};

type BusinessStore = {
  profile: BusinessProfile | null;
  setProfile: (p: BusinessProfile | null) => void;

  assignedOrders: Order[];
  availableOrders: Order[];
  ordersLoading: boolean;

  // Offline queue — status updates that failed due to network
  pendingUpdates: PendingUpdate[];
  addPendingUpdate: (update: Omit<PendingUpdate, "retries">) => void;
  removePendingUpdate: (orderId: string) => void;
  flushPendingUpdates: () => Promise<void>;

  _unsubAssigned: Unsubscribe | null;
  _unsubAvailable: Unsubscribe | null;

  startOrderSubscriptions: (uid: string, restaurantId?: string) => void;
  stopOrderSubscriptions: () => void;
};

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  profile: null,
  setProfile: (p) => set({ profile: p }),

  assignedOrders: [],
  availableOrders: [],
  ordersLoading: true,

  pendingUpdates: [],
  addPendingUpdate: (update) => set((s) => ({
    pendingUpdates: [
      ...s.pendingUpdates.filter(p => p.orderId !== update.orderId),
      { ...update, retries: 0 }
    ]
  })),
  removePendingUpdate: (orderId) => set((s) => ({
    pendingUpdates: s.pendingUpdates.filter(p => p.orderId !== orderId)
  })),
  flushPendingUpdates: async () => {
    const { pendingUpdates, removePendingUpdate } = get();
    if (pendingUpdates.length === 0) return;
    const { httpsCallable } = await import("firebase/functions");
    const { functions } = await import("./firebase");
    for (const update of pendingUpdates) {
      try {
        const fn = httpsCallable(functions, "updateOrderStatus");
        await fn({ orderId: update.orderId, status: update.status, driverName: update.driverName });
        removePendingUpdate(update.orderId);
      } catch {
        // Will retry on next flush
        set(s => ({
          pendingUpdates: s.pendingUpdates.map(p =>
            p.orderId === update.orderId ? { ...p, retries: p.retries + 1 } : p
          ).filter(p => p.retries < 5) // drop after 5 attempts
        }));
      }
    }
  },

  _unsubAssigned: null,
  _unsubAvailable: null,

  startOrderSubscriptions: (uid, restaurantId) => {
    get().stopOrderSubscriptions();

    const assignedQ = restaurantId
      ? query(collection(db, "orders"), where("restaurantId", "==", restaurantId), where("status", "in", ["confirmed", "preparing", "on_delivery"]))
      : query(collection(db, "orders"), where("assignedDriverUid", "==", uid), where("status", "in", ["confirmed", "preparing", "on_delivery"]));

    const unsubAssigned = onSnapshot(assignedQ, (snap) => {
      set({ assignedOrders: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)), ordersLoading: false });
    }, () => set({ ordersLoading: false }));

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
