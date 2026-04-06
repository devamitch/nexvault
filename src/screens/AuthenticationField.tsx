/**
 * AuthenticationField.tsx - Phase 2: Biometric Gate
 *
 * "Quantum Lock Chamber"
 *
 * Post-wormhole arrival. Particles reorganize into a spherical
 * cage formation pulsing with bioluminescent rhythms.
 *
 * A holographic scanner grid materializes with spatial typography:
 * "IDENTITY VERIFICATION REQUIRED"
 *
 * Authentication flow:
 *   1. Particles form sphere cage (1s)
 *   2. Scanner grid appears (0.5s)
 *   3. Biometric prompt fires (FaceID/TouchID)
 *   4. Success: particles turn white, expand, haptic success, voice confirm
 *   5. Failure: particles turn red, scatter, haptic error, retry after 3s
 *   6. Transition: particles form tunnel → Phase 3
 */

import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StatusBar, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ParticleNebula } from "../components/spatial/ParticleNebula";
import { BiometricVault, type AuthResult } from "../core/BiometricVault";
import { useQuantumStore } from "../store/quantumStore";

// ── Types ──────────────────────────────────────────────────────

interface AuthenticationFieldProps {
  onAuthenticated: () => void;
  onRetry?: () => void;
}

type AuthPhase =
  | "FORMING"
  | "SCANNING"
  | "AUTHENTICATING"
  | "SUCCESS"
  | "FAILURE"
  | "TRANSITION";

// ── Constants ──────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Component ─────────────────────────────────────────────────

export function AuthenticationField({ onAuthenticated }: AuthenticationFieldProps) {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("FORMING");
  const [particleColor, setParticleColor] = useState("#00D1FF");
  const [transitionMode, setTransitionMode] = useState<"normal" | "collapse" | "expand">(
    "expand"
  ); // Start with expand from wormhole arrival
  const biometricVault = useRef(new BiometricVault()).current;
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Store
  const setAuthenticated = useQuantumStore((s) => s.setAuthenticated);

  // Animation values
  const gridOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.8);
  const scanLineY = useSharedValue(0);
  const resultOpacity = useSharedValue(0);
  const resultScale = useSharedValue(0.5);
  const overlayOpacity = useSharedValue(0);

  // ── Phase Progression ──

  useEffect(() => {
    // Phase 1: Particles expand from wormhole and form sphere cage
    setTransitionMode("expand");

    const formingTimer = setTimeout(() => {
      setTransitionMode("normal");
      setAuthPhase("SCANNING");
    }, 1000);

    return () => {
      clearTimeout(formingTimer);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (authPhase === "SCANNING") {
      // Show scanner grid
      gridOpacity.value = withTiming(1, { duration: 500 });
      textOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
      textScale.value = withDelay(300, withSpring(1, { damping: 15, stiffness: 200 }));

      // Animate scan line
      scanLineY.value = withDelay(
        800,
        withTiming(SCREEN_HEIGHT * 0.4, { duration: 1500 })
      );

      // Trigger biometric after scan line animation
      const authTimer = setTimeout(() => {
        setAuthPhase("AUTHENTICATING");
        performAuthentication();
      }, 2300);

      return () => clearTimeout(authTimer);
    }
  }, [authPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Authentication ──

  const performAuthentication = useCallback(async () => {
    try {
      const result: AuthResult = await biometricVault.authenticate();

      if (result.success) {
        handleSuccess();
      } else {
        handleFailure();
      }
    } catch {
      handleFailure();
    }
  }, [biometricVault]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuccess = useCallback(async () => {
    setAuthPhase("SUCCESS");

    // Particles turn white
    setParticleColor("#FFFFFF");

    // Success haptic: 3 quick pulses
    for (let i = 0; i < 3; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await delay(80);
    }

    // Show success indicator
    resultOpacity.value = withTiming(1, { duration: 300 });
    resultScale.value = withSpring(1, { damping: 12, stiffness: 200 });

    // Hide scan elements
    gridOpacity.value = withTiming(0, { duration: 500 });
    textOpacity.value = withTiming(0, { duration: 300 });

    // Voice confirmation
    Speech.speak("Identity Verified. Initializing Consciousness Interface.", {
      pitch: 0.7,
      rate: 0.9,
      language: "en-US",
      onDone: () => {
        // Transition after voice finishes
        setAuthPhase("TRANSITION");
        setTransitionMode("collapse");

        // Flash and navigate
        overlayOpacity.value = withDelay(
          500,
          withSequence(
            withTiming(0.8, { duration: 200 }),
            withTiming(0, { duration: 300 })
          )
        );

        setTimeout(() => {
          setAuthenticated(true);
          onAuthenticated();
        }, 1000);
      },
    });
  }, [
    resultOpacity,
    resultScale,
    gridOpacity,
    textOpacity,
    overlayOpacity,
    setAuthenticated,
    onAuthenticated,
  ]);

  const handleFailure = useCallback(async () => {
    setAuthPhase("FAILURE");

    // Particles turn red
    setParticleColor("#FF3333");

    // Error haptic: 2 long pulses
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(200);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Show failure indicator
    resultOpacity.value = withTiming(1, { duration: 300 });
    resultScale.value = withSpring(1, { damping: 12, stiffness: 200 });

    // Scatter particles
    setTransitionMode("expand");

    // Reset after 3 seconds
    retryTimeoutRef.current = setTimeout(() => {
      setParticleColor("#00D1FF");
      setTransitionMode("normal");
      resultOpacity.value = withTiming(0, { duration: 300 });
      resultScale.value = 0.5;
      scanLineY.value = 0;
      setAuthPhase("SCANNING");
    }, 3000);
  }, [resultOpacity, resultScale, scanLineY]);

  // ── Animated Styles ──

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }],
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
    opacity: gridOpacity.value,
  }));

  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{ scale: resultScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const isSuccess = authPhase === "SUCCESS" || authPhase === "TRANSITION";

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Particle Nebula Background */}
      <ParticleNebula
        count={2000}
        bounds={5}
        color={particleColor}
        transitionMode={transitionMode}
      />

      {/* Scanner Grid Overlay */}
      <Animated.View style={[styles.gridOverlay, gridStyle]}>
        {/* Horizontal scan lines */}
        {Array.from({ length: 8 }, (_, i) => (
          <View
            key={`h-${i}`}
            style={[styles.gridLine, styles.horizontalLine, { top: `${(i + 1) * 11}%` }]}
          />
        ))}
        {/* Vertical scan lines */}
        {Array.from({ length: 6 }, (_, i) => (
          <View
            key={`v-${i}`}
            style={[styles.gridLine, styles.verticalLine, { left: `${(i + 1) * 14}%` }]}
          />
        ))}
      </Animated.View>

      {/* Moving scan line */}
      <Animated.View style={[styles.scanLine, scanLineStyle]} />

      {/* Identity Verification Text */}
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Animated.Text style={styles.titleText}>IDENTITY VERIFICATION</Animated.Text>
        <Animated.Text style={styles.subtitleText}>REQUIRED</Animated.Text>
      </Animated.View>

      {/* Result Indicator */}
      <Animated.View
        style={[
          styles.resultContainer,
          resultOpacity.value > 0 ? resultStyle : { opacity: 0 },
        ]}
      >
        <View
          style={[
            styles.resultCircle,
            isSuccess ? styles.successCircle : styles.failureCircle,
          ]}
        >
          <Animated.Text style={styles.resultIcon}>{isSuccess ? "✓" : "✕"}</Animated.Text>
        </View>
        <Animated.Text
          style={[styles.resultText, isSuccess ? styles.successText : styles.failureText]}
        >
          {isSuccess ? "IDENTITY CONFIRMED" : "VERIFICATION FAILED"}
        </Animated.Text>
      </Animated.View>

      {/* Emergency Bypass (for development) */}
      {authPhase === "SCANNING" && (
        <Pressable
          style={styles.bypassArea}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleSuccess();
          }}
        >
          <Animated.Text style={styles.bypassText}>BYPASS ENCRYPTION</Animated.Text>
        </Pressable>
      )}

      {/* Transition flash overlay */}
      <Animated.View style={[styles.flashOverlay, flashStyle]} />
    </View>
  );
}

// ── Utility ────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    marginHorizontal: 30,
    marginVertical: SCREEN_HEIGHT * 0.15,
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(0, 209, 255, 0.15)",
  },
  horizontalLine: {
    left: 0,
    right: 0,
    height: 0.5,
  },
  verticalLine: {
    top: 0,
    bottom: 0,
    width: 0.5,
  },
  scanLine: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.3,
    left: 30,
    right: 30,
    height: 2,
    backgroundColor: "rgba(0, 209, 255, 0.6)",
    shadowColor: "#00D1FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  textContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.38,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  titleText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 18,
    fontWeight: "300",
    letterSpacing: 6,
    textAlign: "center",
  },
  subtitleText: {
    color: "rgba(0, 209, 255, 0.8)",
    fontSize: 14,
    fontWeight: "200",
    letterSpacing: 10,
    textAlign: "center",
    marginTop: 8,
  },
  resultContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.45,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  resultCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  successCircle: {
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  failureCircle: {
    borderColor: "#FF3333",
    backgroundColor: "rgba(255, 50, 50, 0.1)",
  },
  resultIcon: {
    fontSize: 36,
    color: "#FFFFFF",
    fontWeight: "200",
  },
  resultText: {
    fontSize: 12,
    fontWeight: "300",
    letterSpacing: 4,
    marginTop: 16,
  },
  successText: {
    color: "#FFFFFF",
  },
  failureText: {
    color: "#FF3333",
  },
  bypassArea: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    padding: 20,
  },
  bypassText: {
    color: "rgba(255, 255, 255, 0.2)",
    fontSize: 9,
    letterSpacing: 4,
    fontWeight: "200",
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    pointerEvents: "none",
  },
});
