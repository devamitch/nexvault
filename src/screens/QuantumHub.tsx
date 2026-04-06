/**
 * QuantumHub.tsx - Phase 3: Main Interface
 *
 * "Four-Dimensional Workspace"
 *
 * The primary interaction environment where traditional screens
 * cease to exist. A multi-layered spatial environment with:
 *
 * Layer 1: Deep Space (5000 particles, gyroscope parallax)
 * Layer 2: Quantum Dynamic Island (morphing glass element)
 * Layer 3: Interaction Plane (vault items as particle clusters)
 *
 * Input modalities:
 *   - Hand gestures for spatial manipulation
 *   - Voice commands for navigation and creation
 *   - Device tilt for parallax depth
 *
 * Features:
 *   - Vault items float as particle clusters in 3D space
 *   - Voice memo recording with real-time waveform viz
 *   - Gesture trails showing interaction history
 *   - Depth Grab for true 3D manipulation
 */

import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import { Dimensions, Pressable, StatusBar, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { ParticleNebula } from "../components/spatial/ParticleNebula";
import { QuantumIsland } from "../components/spatial/QuantumIsland";
import { useRealityBridge } from "../hooks/useRealityBridge";
import {
  useQuantumStore,
  type MemoData,
  type VaultItemData,
} from "../store/quantumStore";

// ── Types ──────────────────────────────────────────────────────

interface QuantumHubProps {
  onNavigateToVault?: () => void;
  onNavigateToMemo?: () => void;
}

// ── Constants ──────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Vault Item Cluster Component ──────────────────────────────

interface VaultClusterProps {
  item: VaultItemData;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function VaultCluster({ item, index, isSelected, onSelect }: VaultClusterProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  // Particle memory: access frequency affects animation speed
  const energyLevel = Math.min(1, item.accessCount / 20);

  useEffect(() => {
    // Breathing animation scaled by energy level
    const breathDuration = 3000 - energyLevel * 1500;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05 + energyLevel * 0.05, { duration: breathDuration }),
        withTiming(1.0, { duration: breathDuration })
      ),
      -1,
      true
    );

    if (isSelected) {
      glowOpacity.value = withTiming(0.8, { duration: 300 });
    } else {
      glowOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [isSelected, energyLevel, scale, glowOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Position items in a circular layout
  const angle = (index / 8) * Math.PI * 2;
  const radius = SCREEN_WIDTH * 0.28;
  const posX = SCREEN_WIDTH / 2 + Math.cos(angle) * radius - 40;
  const posY = SCREEN_HEIGHT * 0.55 + Math.sin(angle) * radius * 0.6 - 40;

  // Color based on item type
  const typeColors: Record<string, string> = {
    MEMO: "#00D1FF",
    RESEARCH: "#8B5CF6",
    DATA: "#10B981",
    NOTE: "#F59E0B",
  };
  const color = typeColors[item.type] ?? "#00D1FF";

  // Brightness based on access count (particle memory)
  const brightness = 0.4 + energyLevel * 0.6;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelect(item.id);
      }}
      style={[styles.clusterContainer, { left: posX, top: posY }]}
    >
      <Animated.View style={containerStyle}>
        {/* Outer glow */}
        <Animated.View
          style={[styles.clusterGlow, glowStyle, { backgroundColor: color }]}
        />

        {/* Core particle cluster */}
        <View
          style={[
            styles.clusterCore,
            {
              backgroundColor: `rgba(${hexToRgbString(color)}, ${brightness * 0.3})`,
              borderColor: `rgba(${hexToRgbString(color)}, ${brightness * 0.5})`,
            },
          ]}
        >
          {/* Mini particles inside cluster */}
          {Array.from({ length: Math.floor(5 + energyLevel * 10) }, (_, i) => (
            <View
              key={i}
              style={[
                styles.miniParticle,
                {
                  left: 10 + Math.random() * 60,
                  top: 10 + Math.random() * 40,
                  width: 2 + Math.random() * 3,
                  height: 2 + Math.random() * 3,
                  backgroundColor: color,
                  opacity: 0.4 + Math.random() * 0.6 * brightness,
                },
              ]}
            />
          ))}
        </View>

        {/* Label */}
        <Animated.Text style={[styles.clusterLabel, { color }]} numberOfLines={1}>
          {item.title}
        </Animated.Text>

        {/* Type indicator */}
        <Animated.Text
          style={[styles.clusterType, { color: `rgba(${hexToRgbString(color)}, 0.6)` }]}
        >
          {item.type}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Biometric Lock Indicator ──────────────────────────────────

function BiometricIndicator() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.biometricIndicator, style]}>
      <View style={styles.biometricDot} />
    </Animated.View>
  );
}

// ── Main Component ────────────────────────────────────────────

export function QuantumHub({ onNavigateToVault, onNavigateToMemo }: QuantumHubProps) {
  const { spatial, voice, depth, activateAll, haptic } = useRealityBridge();
  const isActivatedRef = useRef(false);

  // Camera
  const { hasPermission } = useCameraPermission();
  const device = useCameraDevice("front");

  // Store
  const vaultItems = useQuantumStore((s) => s.vaultItems);
  const memos = useQuantumStore((s) => s.memos);
  const selectedItemId = useQuantumStore((s) => s.selectedItemId);
  const islandState = useQuantumStore((s) => s.islandState);
  const currentAlert = useQuantumStore((s) => s.currentAlert);
  const selectItem = useQuantumStore((s) => s.selectItem);
  const addMemo = useQuantumStore((s) => s.addMemo);
  const setIslandState = useQuantumStore((s) => s.setIslandState);
  const dismissAlert = useQuantumStore((s) => s.dismissAlert);

  // ── Initialization ──

  useEffect(() => {
    if (!isActivatedRef.current) {
      isActivatedRef.current = true;
      activateAll();
    }
  }, [activateAll]);

  // ── Voice Command Handler ──

  useEffect(() => {
    if (!voice.lastCommand) return;

    const cmd = voice.lastCommand;
    switch (cmd.action) {
      case "OPEN_VAULT":
        voice.speakConfirmation("OPEN_VAULT");
        haptic.medium();
        onNavigateToVault?.();
        break;

      case "NEW_MEMO":
        voice.speakConfirmation("NEW_MEMO");
        haptic.medium();
        startMemoRecording();
        break;

      case "SAVE":
        voice.speakConfirmation("SAVE");
        haptic.success();
        stopMemoRecording();
        break;

      case "STATUS":
        voice.speak(
          `System operational. ${vaultItems.length} vault items. ${memos.length} voice memos.`
        );
        break;

      case "DESCRIBE_SCREEN":
        voice.speak(
          "You are in the Quantum Hub. Vault items float around you as particle clusters."
        );
        break;

      case "GO_HOME":
        // Already home
        voice.speak("You are home.");
        break;

      case "GRAB":
        if (selectedItemId) {
          voice.speakConfirmation("GRAB");
          haptic.heavy();
        }
        break;

      case "DELETE":
        if (selectedItemId) {
          voice.speakConfirmation("DELETE");
          haptic.error();
          useQuantumStore.getState().removeVaultItem(selectedItemId);
          selectItem(null);
        }
        break;

      case "SCALE_UP":
        voice.speakConfirmation("SCALE_UP");
        haptic.light();
        break;

      case "SCALE_DOWN":
        voice.speakConfirmation("SCALE_DOWN");
        haptic.light();
        break;
    }
  }, [voice.lastCommand]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Memo Recording ──

  const startMemoRecording = useCallback(async () => {
    setIslandState("LISTENING");
    await voice.startMemoRecording();
  }, [voice, setIslandState]);

  const stopMemoRecording = useCallback(async () => {
    const result = await voice.stopMemoRecording();
    setIslandState("IDLE");

    if (result.uri) {
      const newMemo: MemoData = {
        id: `memo_${Date.now()}`,
        audioUri: result.uri,
        duration: result.duration,
        transcript: "", // Would come from speech-to-text service
        createdAt: Date.now(),
        tags: [],
        waveformData: [],
      };
      addMemo(newMemo);
    }
  }, [voice, setIslandState, addMemo]);

  // ── Item Selection ──

  const handleItemSelect = useCallback(
    (id: string) => {
      selectItem(selectedItemId === id ? null : id);
    },
    [selectItem, selectedItemId]
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Hidden Camera for hand tracking */}
      {hasPermission && device && (
        <Camera style={styles.hiddenCamera} device={device} isActive={true} />
      )}

      {/* Layer 1: Deep Space Particle Nebula (5000 particles) */}
      <ParticleNebula
        count={5000}
        bounds={10}
        color="#00D1FF"
        handX={spatial.handX}
        handY={spatial.handY}
        handZ={spatial.handZ}
        tiltX={depth.tiltX}
        tiltY={depth.tiltY}
        handActive={spatial.handDetected}
        transitionMode="normal"
      />

      {/* Layer 2: Quantum Dynamic Island */}
      <QuantumIsland
        state={islandState}
        amplitude={voice.amplitude}
        alert={currentAlert}
        onDismissAlert={dismissAlert}
      />

      {/* Layer 3: Interaction Plane - Vault Item Clusters */}
      <View style={styles.interactionPlane}>
        {vaultItems.slice(0, 8).map((item, index) => (
          <VaultCluster
            key={item.id}
            item={item}
            index={index}
            isSelected={selectedItemId === item.id}
            onSelect={handleItemSelect}
          />
        ))}

        {/* Empty state message */}
        {vaultItems.length === 0 && (
          <View style={styles.emptyState}>
            <Animated.Text style={styles.emptyText}>VOID AWAITS DATA</Animated.Text>
            <Animated.Text style={styles.emptySubtext}>
              Say "New Memo" or "Create Entry"
            </Animated.Text>
          </View>
        )}
      </View>

      {/* Biometric Lock Status */}
      <BiometricIndicator />

      {/* Bottom status bar */}
      <View style={styles.statusBar}>
        <Animated.Text style={styles.statusText}>
          {spatial.handDetected.value ? "HAND TRACKED" : "AWAITING INPUT"}
        </Animated.Text>
        <View style={styles.statusDivider} />
        <Animated.Text style={styles.statusText}>{vaultItems.length} ITEMS</Animated.Text>
        <View style={styles.statusDivider} />
        <Animated.Text style={styles.statusText}>{memos.length} MEMOS</Animated.Text>
      </View>
    </View>
  );
}

// ── Utilities ──────────────────────────────────────────────────

function hexToRgbString(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  hiddenCamera: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  interactionPlane: {
    ...StyleSheet.absoluteFillObject,
    top: 120, // Below the Quantum Island
  },
  clusterContainer: {
    position: "absolute",
    width: 80,
    height: 80,
    alignItems: "center",
  },
  clusterGlow: {
    position: "absolute",
    width: 90,
    height: 70,
    borderRadius: 35,
    top: -5,
    left: -5,
    opacity: 0.15,
  },
  clusterCore: {
    width: 80,
    height: 60,
    borderRadius: 20,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  miniParticle: {
    position: "absolute",
    borderRadius: 2,
  },
  clusterLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 4,
  },
  clusterType: {
    fontSize: 7,
    fontWeight: "300",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 2,
  },
  emptyState: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.3,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 16,
    fontWeight: "200",
    letterSpacing: 8,
  },
  emptySubtext: {
    color: "rgba(0, 209, 255, 0.4)",
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 2,
    marginTop: 12,
  },
  biometricIndicator: {
    position: "absolute",
    top: SCREEN_HEIGHT - 100,
    right: 30,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 200, 100, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  biometricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0, 200, 100, 0.8)",
  },
  statusBar: {
    position: "absolute",
    bottom: 40,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 9,
    fontWeight: "300",
    letterSpacing: 3,
  },
  statusDivider: {
    width: 1,
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 12,
  },
});
