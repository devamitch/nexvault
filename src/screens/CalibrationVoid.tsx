/**
 * CalibrationVoid.tsx - Phase 1: Onboarding Experience
 *
 * "The Void Awakens"
 *
 * Starts in absolute darkness. Particles gradually materialize.
 * Camera activates and hand tracking begins. As user raises hand,
 * particles react with attraction/repulsion.
 *
 * A holographic slider crystallizes from particles. Hand X controls
 * fill percentage, hand Z controls scale. Milestones at 25% intervals
 * trigger haptic pulses and particle effects.
 *
 * At 100%, all particles implode into a wormhole singularity,
 * transitioning the user to Phase 2 (Authentication).
 *
 * Flow:
 *   1. Fade in particles (2s)
 *   2. Detect hand → particles react
 *   3. Slider materializes (fade in over 1s)
 *   4. Hand X → slider fill, milestones → haptics
 *   5. 100% → collapse transition → Phase 2
 */

import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, StatusBar, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { HolographicSlider } from "../components/spatial/HolographicSlider";
import { ParticleNebula } from "../components/spatial/ParticleNebula";
import { useDepthPerception } from "../hooks/useDepthPerception";
import { useSpatialTracking } from "../hooks/useSpatialTracking";
import { useQuantumStore } from "../store/quantumStore";

// ── Types ──────────────────────────────────────────────────────

interface CalibrationVoidProps {
  onComplete: () => void;
}

// ── Constants ──────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Component ─────────────────────────────────────────────────

export function CalibrationVoid({ onComplete }: CalibrationVoidProps) {
  const [phase, setPhase] = useState<"PARTICLES" | "SLIDER" | "TRANSITION">("PARTICLES");
  const transitionStarted = useRef(false);

  // Camera
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");

  // Spatial tracking
  const { handX, handY, handZ, handDetected } = useSpatialTracking();

  // Depth perception for parallax
  const { tiltX, tiltY, start: startSensors, stop: stopSensors } = useDepthPerception();

  // Store
  const setSliderValue = useQuantumStore((s) => s.setSliderValue);
  const completeOnboarding = useQuantumStore((s) => s.completeOnboarding);

  // Animation values
  const particleOpacity = useSharedValue(0);
  const sliderOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0); // For wormhole transition
  const [transitionMode, setTransitionMode] = useState<"normal" | "collapse" | "expand">(
    "normal"
  );

  // ── Initialization ──

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    startSensors();

    // Fade in particles over 2 seconds
    particleOpacity.value = withTiming(1, {
      duration: 2000,
      easing: Easing.out(Easing.cubic),
    });

    // Show slider after particles are established
    sliderOpacity.value = withDelay(
      2500,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );

    // Update phase for slider visibility
    const timer = setTimeout(() => setPhase("SLIDER"), 2500);

    return () => {
      clearTimeout(timer);
      stopSensors();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── VisionCamera Frame Processor ──
  // Note: In production, this would use a worklet-based frame processor
  // with MediaPipe. Here we show the structure; actual ML inference
  // requires native module bridge.

  // ── Slider Callbacks ──

  const handleValueChange = useCallback(
    (value: number) => {
      setSliderValue(value);
    },
    [setSliderValue]
  );

  const handleSliderComplete = useCallback(async () => {
    if (transitionStarted.current) return;
    transitionStarted.current = true;

    setPhase("TRANSITION");

    // Heavy haptic for completion
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Collapse particles into singularity
    setTransitionMode("collapse");

    // White flash overlay
    overlayOpacity.value = withDelay(
      1000,
      withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 200 }))
    );

    // Complete onboarding and transition after animation
    setTimeout(() => {
      completeOnboarding();
      runOnJS(onComplete)();
    }, 1500);
  }, [completeOnboarding, onComplete, overlayOpacity]);

  // ── Animated Styles ──

  const particleContainerStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
  }));

  const sliderContainerStyle = useAnimatedStyle(() => ({
    opacity: sliderOpacity.value,
  }));

  const flashOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Camera (hidden - used only for frame processing) */}
      {hasPermission && device && (
        <Camera
          style={styles.hiddenCamera}
          device={device}
          isActive={phase !== "TRANSITION"}
          // In production: frameProcessor={frameProcessor}
        />
      )}

      {/* Particle Nebula (Deep Space Background) */}
      <Animated.View style={[styles.nebulaContainer, particleContainerStyle]}>
        <ParticleNebula
          count={2000}
          bounds={5}
          color="#00D1FF"
          handX={handX}
          handY={handY}
          handZ={handZ}
          tiltX={tiltX}
          tiltY={tiltY}
          handActive={handDetected}
          transitionMode={transitionMode}
        />
      </Animated.View>

      {/* Holographic Slider (Mid-ground) */}
      {phase !== "PARTICLES" && (
        <Animated.View style={[styles.sliderContainer, sliderContainerStyle]}>
          <HolographicSlider
            handX={handX}
            handZ={handZ}
            handActive={handDetected}
            onValueChange={handleValueChange}
            onComplete={handleSliderComplete}
            width={300}
            height={60}
          />
        </Animated.View>
      )}

      {/* Manual Simulation / Bypass (for development) */}
      {phase === "SLIDER" && !handDetected.value && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(e) => {
            const x = e.nativeEvent.locationX / SCREEN_WIDTH;
            handDetected.value = true;
            handX.value = withTiming(x, { duration: 300 });
            handZ.value = withTiming(1.0, { duration: 300 });
          }}
        >
          <View style={styles.debugHint}>
            <Animated.Text style={styles.debugText}>TAP TO SIMULATE HAND</Animated.Text>
          </View>
        </Pressable>
      )}

      {/* Wormhole transition flash */}
      <Animated.View style={[styles.flashOverlay, flashOverlayStyle]} />
    </View>
  );
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
  nebulaContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  sliderContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT / 2 - 50,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    pointerEvents: "none",
  },
  debugHint: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  debugText: {
    color: "rgba(0, 209, 255, 0.4)",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "300",
  },
});
