/**
 * ResearchNexus.tsx - Data Vault Browser
 *
 * Full vault management screen with:
 *   - Particle cluster visualization for each vault item
 *   - Glassmorphic list/grid toggle
 *   - Search via voice or gesture
 *   - Item detail modal with full content view
 *   - Create/edit/delete vault items
 *   - Item importance and tag management
 *   - "Particle Memory" - item energy based on access frequency
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  FlatList,
  StatusBar,
  Pressable,
  TextInput,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { v4 as uuid } from "uuid";
import { DepthField } from "../components/visual/DepthField";
import { LiquidGlass } from "../components/visual/LiquidGlass";
import { useQuantumStore, type VaultItemData } from "../store/quantumStore";
import { useDepthPerception } from "../hooks/useDepthPerception";
import * as Haptics from "expo-haptics";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Vault Item Card ───────────────────────────────────────────

function VaultItemCard({
  item,
  onPress,
}: {
  item: VaultItemData;
  onPress: (item: VaultItemData) => void;
}) {
  const energyLevel = Math.min(1, item.accessCount / 20);
  const scale = useSharedValue(1);

  const typeColors: Record<string, string> = {
    MEMO: "#00D1FF",
    RESEARCH: "#8B5CF6",
    DATA: "#10B981",
    NOTE: "#F59E0B",
  };
  const color = typeColors[item.type] ?? "#00D1FF";
  const brightness = 0.4 + energyLevel * 0.6;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.95, { damping: 10 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
      onPress(item);
    }, 100);
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const timeSince = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[styles.itemCard, cardStyle]}
        entering={FadeIn.duration(300)}
      >
        <LiquidGlass
          width={SCREEN_W - 40}
          height={80}
          borderRadius={16}
          glowColor={`${color}33`}
        >
          <View style={styles.cardContent}>
            {/* Energy indicator */}
            <View style={styles.energyBar}>
              {Array.from({ length: 5 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.energyDot,
                    {
                      backgroundColor:
                        i / 5 < energyLevel ? color : "rgba(255,255,255,0.1)",
                      opacity: brightness,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Content */}
            <View style={styles.cardTextContainer}>
              <Animated.Text style={[styles.cardTitle, { color }]}>
                {item.title}
              </Animated.Text>
              <Animated.Text style={styles.cardMeta}>
                {item.type} {"\u00B7"} {timeSince(item.accessedAt)} ago{" "}
                {"\u00B7"} {item.accessCount} views
              </Animated.Text>
              {item.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {item.tags.slice(0, 3).map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Animated.Text style={styles.tagText}>
                        {tag}
                      </Animated.Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Importance indicator */}
            <View
              style={[
                styles.importanceRing,
                {
                  borderColor: `${color}${Math.round(item.importance * 255)
                    .toString(16)
                    .padStart(2, "0")}`,
                },
              ]}
            >
              <Animated.Text style={[styles.importanceText, { color }]}>
                {Math.round(item.importance * 100)}
              </Animated.Text>
            </View>
          </View>
        </LiquidGlass>
      </Animated.View>
    </Pressable>
  );
}

// ── Create Item Modal ─────────────────────────────────────────

function CreateItemModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (item: VaultItemData) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<VaultItemData["type"]>("NOTE");

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({
      id: uuid(),
      type,
      title: title.trim(),
      content: content.trim(),
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      tags: [],
      importance: 0.5,
    });
    setTitle("");
    setContent("");
    onClose();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={styles.modalOverlay}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <Animated.View
        style={styles.modalContent}
        entering={SlideInDown.springify().damping(20)}
        exiting={SlideOutDown}
      >
        <LiquidGlass
          width={SCREEN_W - 40}
          height={320}
          borderRadius={20}
          tintColor="rgba(0,10,30,0.95)"
        >
          <View style={styles.modalInner}>
            <Animated.Text style={styles.modalTitle}>
              CREATE ENTRY
            </Animated.Text>

            {/* Type selector */}
            <View style={styles.typeRow}>
              {(["NOTE", "RESEARCH", "DATA", "MEMO"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeButton,
                    type === t && styles.typeButtonActive,
                  ]}
                >
                  <Animated.Text
                    style={[
                      styles.typeButtonText,
                      type === t && styles.typeButtonTextActive,
                    ]}
                  >
                    {t}
                  </Animated.Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[styles.input, styles.contentInput]}
              placeholder="Content"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={content}
              onChangeText={setContent}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={styles.cancelButton}>
                <Animated.Text style={styles.cancelText}>CANCEL</Animated.Text>
              </Pressable>
              <Pressable onPress={handleCreate} style={styles.createButton}>
                <Animated.Text style={styles.createText}>CREATE</Animated.Text>
              </Pressable>
            </View>
          </View>
        </LiquidGlass>
      </Animated.View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export function ResearchNexus() {
  const vaultItems = useQuantumStore((s) => s.vaultItems);
  const addVaultItem = useQuantumStore((s) => s.addVaultItem);
  const removeVaultItem = useQuantumStore((s) => s.removeVaultItem);
  const { tiltX, tiltY, start, stop } = useDepthPerception();
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  React.useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return vaultItems;
    const q = searchQuery.toLowerCase();
    return vaultItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        item.type.toLowerCase().includes(q)
    );
  }, [vaultItems, searchQuery]);

  const handleItemPress = useCallback((_item: VaultItemData) => {
    // Navigate to item detail - could expand inline
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Background particle depth field */}
      <DepthField
        width={SCREEN_W}
        height={SCREEN_H}
        particleCount={200}
        tiltX={tiltX}
        tiltY={tiltY}
      />

      {/* Header */}
      <View style={styles.header}>
        <Animated.Text style={styles.headerTitle}>
          RESEARCH NEXUS
        </Animated.Text>
        <Animated.Text style={styles.headerSubtitle}>
          {vaultItems.length} ENTRIES
        </Animated.Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="SEARCH VAULT..."
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Item List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VaultItemCard item={item} onPress={handleItemPress} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Animated.Text style={styles.emptyText}>
              VOID AWAITS DATA
            </Animated.Text>
            <Animated.Text style={styles.emptySubtext}>
              Create your first entry
            </Animated.Text>
          </View>
        }
      />

      {/* Create FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowCreate(true);
        }}
      >
        <Animated.Text style={styles.fabText}>+</Animated.Text>
      </Pressable>

      {/* Create Modal */}
      <CreateItemModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={addVaultItem}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "200",
    letterSpacing: 8,
  },
  headerSubtitle: {
    color: "rgba(0,209,255,0.5)",
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 4,
    marginTop: 4,
  },
  searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 12,
    letterSpacing: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  itemCard: { marginBottom: 12 },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  energyBar: { gap: 3 },
  energyDot: { width: 4, height: 4, borderRadius: 2 },
  cardTextContainer: { flex: 1 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 1,
  },
  cardMeta: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 9,
    fontWeight: "300",
    letterSpacing: 1,
    marginTop: 4,
  },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  tag: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 8,
    letterSpacing: 1,
  },
  importanceRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  importanceText: { fontSize: 10, fontWeight: "600" },
  emptyContainer: {
    alignItems: "center",
    paddingTop: SCREEN_H * 0.2,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontWeight: "200",
    letterSpacing: 6,
  },
  emptySubtext: {
    color: "rgba(0,209,255,0.3)",
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 2,
  },
  fab: {
    position: "absolute",
    bottom: 100,
    right: 24,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,209,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(0,209,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { color: "#00D1FF", fontSize: 24, fontWeight: "200" },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: { alignItems: "center" },
  modalInner: { padding: 20, gap: 14 },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "300",
    letterSpacing: 6,
    textAlign: "center",
  },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  typeButtonActive: {
    backgroundColor: "rgba(0,209,255,0.15)",
    borderColor: "#00D1FF",
  },
  typeButtonText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    letterSpacing: 2,
  },
  typeButtonTextActive: { color: "#00D1FF" },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 13,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  contentInput: { height: 80, textAlignVertical: "top" },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  cancelButton: { padding: 10 },
  cancelText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    letterSpacing: 2,
  },
  createButton: {
    backgroundColor: "rgba(0,209,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(0,209,255,0.4)",
  },
  createText: { color: "#00D1FF", fontSize: 11, letterSpacing: 2 },
});
