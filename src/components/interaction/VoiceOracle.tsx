/**
 * VoiceOracle.tsx - Voice Command UI with Visual Feedback
 *
 * A floating UI overlay that shows:
 *   - Current listening status
 *   - Real-time transcript
 *   - Command recognition confirmation
 *   - Error/retry feedback
 *   - Audio amplitude visualization
 *
 * Appears when voice interaction is active, auto-hides when idle.
 */

import React, { useEffect } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  type SharedValue,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { LiquidGlass } from "../visual/LiquidGlass";
import { WaveformViz } from "../visual/WaveformViz";

const { width: SCREEN_W } = Dimensions.get("window");

interface VoiceOracleProps {
  isListening: boolean;
  amplitude: SharedValue<number>;
  transcript: string;
  lastCommandAction: string | null;
  isRecordingMemo: boolean;
}

export function VoiceOracle({
  isListening,
  amplitude,
  transcript,
  lastCommandAction,
  isRecordingMemo,
}: VoiceOracleProps) {
  const containerOpacity = useSharedValue(0);
  const statusScale = useSharedValue(1);

  useEffect(() => {
    if (isListening || isRecordingMemo) {
      containerOpacity.value = withTiming(1, { duration: 300 });
      statusScale.value = withSpring(1, { damping: 15 });
    } else {
      containerOpacity.value = withDelay(1000, withTiming(0, { duration: 500 }));
    }
  }, [isListening, isRecordingMemo, containerOpacity, statusScale]);

  // Flash on command recognition
  useEffect(() => {
    if (lastCommandAction) {
      statusScale.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withSpring(1, { damping: 10 })
      );
    }
  }, [lastCommandAction, statusScale]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: statusScale.value }],
  }));

  if (!isListening && !isRecordingMemo && containerOpacity.value === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
    >
      <LiquidGlass
        width={SCREEN_W - 60}
        height={isRecordingMemo ? 120 : 80}
        borderRadius={16}
        glowColor={isRecordingMemo ? "rgba(255,50,50,0.2)" : "rgba(0,209,255,0.2)"}
      >
        <View style={styles.content}>
          {/* Status indicator */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isRecordingMemo ? styles.recordingDot : styles.listeningDot,
              ]}
            />
            <Animated.Text style={styles.statusText}>
              {isRecordingMemo ? "RECORDING MEMO" : "LISTENING"}
            </Animated.Text>
          </View>

          {/* Waveform */}
          <WaveformViz
            width={SCREEN_W - 100}
            height={30}
            amplitude={amplitude}
            barCount={30}
            color={isRecordingMemo ? "#FF6B6B" : "#00D1FF"}
            mirrored={false}
          />

          {/* Transcript */}
          {transcript.length > 0 && (
            <Animated.Text style={styles.transcript} numberOfLines={1}>
              {transcript}
            </Animated.Text>
          )}

          {/* Last command confirmation */}
          {lastCommandAction && (
            <Animated.Text style={styles.commandConfirm}>
              {lastCommandAction}
            </Animated.Text>
          )}
        </View>
      </LiquidGlass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 30,
    right: 30,
    alignItems: "center",
    zIndex: 500,
  },
  content: {
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listeningDot: {
    backgroundColor: "#00D1FF",
    shadowColor: "#00D1FF",
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  recordingDot: {
    backgroundColor: "#FF6B6B",
    shadowColor: "#FF6B6B",
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 3,
  },
  transcript: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "300",
    fontStyle: "italic",
  },
  commandConfirm: {
    color: "#00D1FF",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
  },
});
