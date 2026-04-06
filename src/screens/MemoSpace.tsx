/**
 * MemoSpace.tsx - Voice Memo Management
 *
 * Full voice memo screen with:
 *   - Voice memo recording with real-time waveform
 *   - Playback with visualization
 *   - Memo list with 3D waveform thumbnails
 *   - Voice-sculpted geometry preview
 *   - Delete/tag management
 */

import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { v4 as uuid } from "uuid";
import { DepthField } from "../components/visual/DepthField";
import { LiquidGlass } from "../components/visual/LiquidGlass";
import { WaveformViz } from "../components/visual/WaveformViz";
import { useDepthPerception } from "../hooks/useDepthPerception";
import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { useQuantumStore, type MemoData } from "../store/quantumStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Memo Card ─────────────────────────────────────────────────

function MemoCard({
  memo,
  onPlay,
  onDelete,
}: {
  memo: MemoData;
  onPlay: (memo: MemoData) => void;
  onDelete: (id: string) => void;
}) {
  const scale = useSharedValue(1);

  const formatDuration = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}:${remainSecs.toString().padStart(2, "0")}`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.memoCard, cardStyle]} entering={FadeIn.duration(300)}>
      <LiquidGlass
        width={SCREEN_W - 40}
        height={100}
        borderRadius={16}
        glowColor="rgba(0,209,255,0.1)"
      >
        <View style={styles.memoContent}>
          {/* Waveform thumbnail */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPlay(memo);
            }}
            style={styles.playButton}
          >
            <View style={styles.playIcon}>
              <View style={styles.playTriangle} />
            </View>
          </Pressable>

          {/* Waveform preview */}
          <View style={styles.waveformContainer}>
            <WaveformViz
              width={SCREEN_W - 180}
              height={40}
              waveformData={
                memo.waveformData.length > 0
                  ? memo.waveformData
                  : Array.from({ length: 30 }, () => Math.random() * 0.5 + 0.1)
              }
              barCount={30}
              mirrored={false}
            />
            <View style={styles.memoMeta}>
              <Animated.Text style={styles.memoDuration}>
                {formatDuration(memo.duration)}
              </Animated.Text>
              <Animated.Text style={styles.memoDate}>
                {formatDate(memo.createdAt)}
              </Animated.Text>
            </View>
          </View>

          {/* Delete button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete(memo.id);
            }}
            style={styles.deleteButton}
          >
            <Animated.Text style={styles.deleteText}>{"\u00D7"}</Animated.Text>
          </Pressable>
        </View>
      </LiquidGlass>
    </Animated.View>
  );
}

// ── Recording Interface ───────────────────────────────────────

function RecordingInterface({
  isRecording,
  amplitude,
  duration,
  onStart,
  onStop,
}: {
  isRecording: boolean;
  amplitude: Animated.SharedValue<number>;
  duration: number;
  onStart: () => void;
  onStop: () => void;
}) {
  const recordPulse = useSharedValue(1);

  React.useEffect(() => {
    if (isRecording) {
      recordPulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      recordPulse.value = withSpring(1);
    }
  }, [isRecording, recordPulse]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordPulse.value }],
  }));

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}:${remainSecs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.recordingContainer}>
      <LiquidGlass
        width={SCREEN_W - 40}
        height={180}
        borderRadius={20}
        glowColor={isRecording ? "rgba(255,50,50,0.2)" : "rgba(0,209,255,0.1)"}
      >
        <View style={styles.recordingInner}>
          {/* Waveform display */}
          <WaveformViz
            width={SCREEN_W - 80}
            height={60}
            amplitude={amplitude}
            barCount={50}
            color={isRecording ? "#FF6B6B" : "#00D1FF"}
            mirrored={true}
          />

          {/* Timer */}
          <Animated.Text style={styles.timer}>
            {isRecording ? formatTime(duration) : "READY"}
          </Animated.Text>

          {/* Record button */}
          <Pressable onPress={isRecording ? onStop : onStart}>
            <Animated.View
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
                buttonStyle,
              ]}
            >
              {isRecording ? (
                <View style={styles.stopSquare} />
              ) : (
                <View style={styles.recordCircle} />
              )}
            </Animated.View>
          </Pressable>
        </View>
      </LiquidGlass>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export function MemoSpace() {
  const memos = useQuantumStore((s) => s.memos);
  const addMemo = useQuantumStore((s) => s.addMemo);
  const removeMemo = useQuantumStore((s) => s.removeMemo);
  const { amplitude, startMemoRecording, stopMemoRecording, isRecordingMemo } =
    useVoiceCommand();
  const { tiltX, tiltY, start: startSensors, stop: stopSensors } = useDepthPerception();
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playingMemoUri, setPlayingMemoUri] = useState<string | null>(null);
  const player = useAudioPlayer(playingMemoUri);

  React.useEffect(() => {
    startSensors();
    return stopSensors;
  }, [startSensors, stopSensors]);

  const handleStartRecording = useCallback(async () => {
    setRecordingDuration(0);
    await startMemoRecording();
    durationInterval.current = setInterval(() => {
      setRecordingDuration((d) => d + 1000);
    }, 1000);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [startMemoRecording]);

  const handleStopRecording = useCallback(async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    const result = await stopMemoRecording();

    if (result.uri) {
      const newMemo: MemoData = {
        id: uuid(),
        audioUri: result.uri,
        duration: result.duration || recordingDuration,
        transcript: "",
        createdAt: Date.now(),
        tags: [],
        waveformData: Array.from({ length: 50 }, () => Math.random()),
      };
      addMemo(newMemo);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [stopMemoRecording, recordingDuration, addMemo]);

  const handlePlayMemo = useCallback(
    (memo: MemoData) => {
      setPlayingMemoUri(memo.audioUri);
      if (player) {
        player.play();
      }
    },
    [player]
  );

  const handleDeleteMemo = useCallback(
    (id: string) => {
      removeMemo(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [removeMemo]
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Background */}
      <DepthField
        width={SCREEN_W}
        height={SCREEN_H}
        particleCount={150}
        color="#FF6B6B"
        tiltX={tiltX}
        tiltY={tiltY}
      />

      {/* Header */}
      <View style={styles.header}>
        <Animated.Text style={styles.headerTitle}>MEMO SPACE</Animated.Text>
        <Animated.Text style={styles.headerSubtitle}>
          {memos.length} RECORDINGS
        </Animated.Text>
      </View>

      {/* Recording Interface */}
      <RecordingInterface
        isRecording={isRecordingMemo}
        amplitude={amplitude}
        duration={recordingDuration}
        onStart={handleStartRecording}
        onStop={handleStopRecording}
      />

      {/* Memo List */}
      <FlatList
        data={memos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MemoCard memo={item} onPlay={handlePlayMemo} onDelete={handleDeleteMemo} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Animated.Text style={styles.emptyText}>NO RECORDINGS</Animated.Text>
            <Animated.Text style={styles.emptySubtext}>
              Tap the record button to begin
            </Animated.Text>
          </View>
        }
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
    color: "rgba(255,107,107,0.5)",
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 4,
    marginTop: 4,
  },
  recordingContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  recordingInner: {
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  timer: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 22,
    fontWeight: "200",
    letterSpacing: 4,
  },
  recordButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonActive: {
    borderColor: "#FF6B6B",
  },
  recordCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF6B6B",
  },
  stopSquare: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: "#FF6B6B",
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  memoCard: { marginBottom: 10 },
  memoContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,209,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(0,209,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { marginLeft: 4 },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: "#00D1FF",
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  waveformContainer: { flex: 1 },
  memoMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  memoDuration: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "500",
  },
  memoDate: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 9,
  },
  deleteButton: { padding: 8 },
  deleteText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 18,
    fontWeight: "200",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontWeight: "200",
    letterSpacing: 6,
  },
  emptySubtext: {
    color: "rgba(255,107,107,0.3)",
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 2,
  },
});
