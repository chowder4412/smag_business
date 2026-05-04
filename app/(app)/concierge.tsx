import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db, businessSignOut, getCurrentUser } from "@/lib/firebase";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { BusinessAccessGuard } from "@/components/BusinessAccessGuard";

type ChatSession = { id: string; userId: string; lastMessage: string; updatedAt: string; unread: number };
type Message = { id: string; from: "user" | "agent"; text: string; createdAt: string };

export default function ConciergeDashboard() {
  return (
    <BusinessAccessGuard permission="business_support" role="concierge">
      <ConciergeDashboardContent />
    </BusinessAccessGuard>
  );
}

function ConciergeDashboardContent() {
  const router = useRouter() as { replace: (href: string) => void };
  const { profile } = useBusinessProfile();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const q = query(collection(db, "vip_chat_sessions"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatSession)));
    });
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    const q = query(collection(db, "vip_chat_sessions", activeSession, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [activeSession]);

  async function sendReply() {
    if (!activeSession || !reply.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "vip_chat_sessions", activeSession, "messages"), {
        from: "agent",
        text: reply.trim(),
        agentName: profile?.name ?? "Support",
        createdAt: serverTimestamp()
      });
      setReply("");
    } finally {
      setSending(false);
    }
  }

  if (activeSession) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.chatHeader}>
          <Pressable onPress={() => setActiveSession(null)}>
            <MaterialIcons name="arrow-back" size={22} color="#2196f3" />
          </Pressable>
          <Text style={styles.chatTitle}>Session {activeSession.slice(-6).toUpperCase()}</Text>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.from === "agent" ? styles.bubbleAgent : styles.bubbleUser]}>
              <Text style={[styles.bubbleText, item.from === "agent" && styles.bubbleTextAgent]}>{item.text}</Text>
            </View>
          )}
        />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.replyInput}
              value={reply}
              onChangeText={setReply}
              placeholder="Type a reply..."
              placeholderTextColor="#3a1e0a"
              multiline
            />
            <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendReply} disabled={sending}>
              {sending ? <ActivityIndicator color="#1a0d06" size="small" /> : <MaterialIcons name="send" size={20} color="#1a0d06" />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Support Dashboard</Text>
          <Text style={styles.subtitle}>{profile?.name ?? ""} · Concierge</Text>
        </View>
        <Pressable onPress={() => { void businessSignOut().then(() => router.replace("/(auth)/login")); }}>
          <MaterialIcons name="logout" size={22} color="#6b3a1f" />
        </Pressable>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="support-agent" size={48} color="#2a1508" />
            <Text style={styles.emptyText}>No active chat sessions</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.sessionCard} onPress={() => setActiveSession(item.id)}>
            <View style={styles.sessionIcon}>
              <MaterialIcons name="person" size={22} color="#2196f3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionId}>Session {item.id.slice(-6).toUpperCase()}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
            <MaterialIcons name="chevron-right" size={20} color="#3a1e0a" />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a0d06" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 8 },
  title: { color: "#ffd4bd", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#6b3a1f", fontSize: 13, marginTop: 2 },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", marginTop: 80, gap: 10 },
  emptyText: { color: "#3a1e0a", fontSize: 15, fontWeight: "700" },
  sessionCard: { backgroundColor: "#2a1508", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  sessionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1a0d06", alignItems: "center", justifyContent: "center" },
  sessionId: { color: "#ffd4bd", fontWeight: "800", fontSize: 14 },
  lastMessage: { color: "#6b3a1f", fontSize: 12, marginTop: 2 },
  unreadBadge: { backgroundColor: "#2196f3", borderRadius: 999, width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: "#2a1508" },
  chatTitle: { color: "#ffd4bd", fontSize: 18, fontWeight: "900" },
  messageList: { padding: 16, gap: 8 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12, backgroundColor: "#2a1508", alignSelf: "flex-start" },
  bubbleUser: { alignSelf: "flex-start" },
  bubbleAgent: { backgroundColor: "#2196f3", alignSelf: "flex-end" },
  bubbleText: { color: "#ffd4bd", fontSize: 14 },
  bubbleTextAgent: { color: "#fff" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#2a1508" },
  replyInput: { flex: 1, backgroundColor: "#2a1508", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: "#ffd4bd", fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2196f3", alignItems: "center", justifyContent: "center" }
});
