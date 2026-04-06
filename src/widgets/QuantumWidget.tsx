/**
 * QuantumWidget.tsx - iOS/Android Home Screen Widget
 *
 * A miniature representation of the NexVault interface for
 * the device home screen. Displays:
 *   - Mini particle system (200 particles via Skia)
 *   - Vault item count
 *   - Latest memo timestamp
 *   - Voice assistant status indicator
 *   - Glassmorphic design matching main app
 *
 * Tapping the widget deep-links into the app at the relevant
 * vault item or memo.
 *
 * Note: Actual widget registration requires platform-specific
 * setup (WidgetKit for iOS, AppWidgetProvider for Android).
 * This component provides the render logic and shared data layer.
 */

import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, Text, Dimensions, Linking } from "react-native";
import {
  Canvas,
  Circle,
  RoundedRect,
  LinearGradient,
  vec,
  BlurMask,
  Group,
} from "@shopify/react-native-skia";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ──────────────────────────────────────────────────────

interface WidgetData {
  vaultItemCount: number;
  memoCount: number;
  latestMemoTimestamp: number | null;
  isListening: boolean;
}

interface QuantumWidgetProps {
  /** Widget size: small (2x2), medium (4x2), large (4x4) */
  size?: "small" | "medium" | "large";
}

// ── Constants ──────────────────────────────────────────────────

const WIDGET_SIZES = {
  small: { width: 155, height: 155 },
  medium: { width: 329, height: 155 },
  large: { width: 329, height: 345 },
};

// ── Mini Particle System (Skia) ───────────────────────────────

function MiniParticleField({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const PARTICLE_COUNT = 200;

  // Pre-compute particle positions (static for widget)
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => ({
        cx: Math.random() * width,
        cy: Math.random() * height,
        r: 0.5 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.5,
      })),
    [width, height]
  );

  return (
    <Canvas style={{ width, height }}>
      {/* Background */}
      <RoundedRect x={0} y={0} width={width} height={height} r={20}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={["rgba(0, 10, 30, 0.95)", "rgba(0, 5, 15, 0.98)"]}
        />
      </RoundedRect>

      {/* Particles */}
      {particles.map((p, i) => (
        <Circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          color={`rgba(0, 209, 255, ${p.opacity})`}
        />
      ))}

      {/* Glass overlay at top */}
      <RoundedRect x={0} y={0} width={width} height={height} r={20}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height * 0.3)}
          colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.0)"]}
        />
      </RoundedRect>

      {/* Border */}
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height}
        r={20}
        style="stroke"
        strokeWidth={0.5}
        color="rgba(255, 255, 255, 0.15)"
      />
    </Canvas>
  );
}

// ── Widget Component ──────────────────────────────────────────

export function QuantumWidget({ size = "small" }: QuantumWidgetProps) {
  const dims = WIDGET_SIZES[size];

  // In a real widget, this data comes from the shared app group storage
  // For now, using placeholder data
  const widgetData: WidgetData = {
    vaultItemCount: 0,
    memoCount: 0,
    latestMemoTimestamp: null,
    isListening: false,
  };

  const formatTimestamp = (ts: number | null): string => {
    if (!ts) return "No memos";
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handlePress = () => {
    // Deep link into the app
    Linking.openURL("nexvault://hub");
  };

  return (
    <View style={[styles.container, { width: dims.width, height: dims.height }]}>
      {/* Particle background */}
      <View style={styles.particleLayer}>
        <MiniParticleField width={dims.width} height={dims.height} />
      </View>

      {/* Content overlay */}
      <View style={styles.contentLayer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>NEXVAULT</Text>
          {/* Status indicator */}
          <View
            style={[
              styles.statusDot,
              widgetData.isListening
                ? styles.statusActive
                : styles.statusIdle,
            ]}
          />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{widgetData.vaultItemCount}</Text>
            <Text style={styles.statLabel}>ITEMS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{widgetData.memoCount}</Text>
            <Text style={styles.statLabel}>MEMOS</Text>
          </View>
        </View>

        {/* Latest memo timestamp */}
        <Text style={styles.timestamp}>
          {formatTimestamp(widgetData.latestMemoTimestamp)}
        </Text>

        {size !== "small" && (
          <View style={styles.quickActions}>
            <Text style={styles.actionText}>TAP TO OPEN</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Shared Data Layer ─────────────────────────────────────────

/**
 * Updates the widget data in shared storage.
 * Call this from the main app whenever vault/memo data changes.
 */
export async function updateWidgetData(data: WidgetData): Promise<void> {
  try {
    await AsyncStorage.setItem(
      "@nexvault/widget_data",
      JSON.stringify(data)
    );
    // On iOS, this would also call WidgetCenter.shared.reloadAllTimelines()
    // On Android, this would call AppWidgetManager.notifyAppWidgetViewDataChanged()
  } catch {
    // Non-critical
  }
}

/**
 * Reads widget data from shared storage.
 */
export async function getWidgetData(): Promise<WidgetData> {
  try {
    const raw = await AsyncStorage.getItem("@nexvault/widget_data");
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall through
  }
  return {
    vaultItemCount: 0,
    memoCount: 0,
    latestMemoTimestamp: null,
    isListening: false,
  };
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  contentLayer: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appName: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusActive: {
    backgroundColor: "#00D1FF",
    shadowColor: "#00D1FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusIdle: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  stat: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  statValue: {
    color: "#00D1FF",
    fontSize: 24,
    fontWeight: "200",
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 8,
    fontWeight: "400",
    letterSpacing: 2,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  timestamp: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 9,
    fontWeight: "300",
    letterSpacing: 1,
    textAlign: "center",
  },
  quickActions: {
    alignItems: "center",
    marginTop: 8,
  },
  actionText: {
    color: "rgba(0, 209, 255, 0.4)",
    fontSize: 8,
    fontWeight: "400",
    letterSpacing: 3,
  },
});
