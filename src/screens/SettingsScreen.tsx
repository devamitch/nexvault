/**
 * SettingsScreen.tsx - Full Application Settings
 *
 * A scrollable dark interface organized into sections:
 *   1. AI Assistant (Jarvis) - provider, API key, learning, suggestions
 *   2. Interaction - handedness, interaction mode, particle count
 *   3. Automation - list with toggles, add new automation
 *   4. IoT Devices - registered devices with status, add device
 *   5. Device - location, notifications, network, storage
 *   6. About - version, build, links
 *
 * Uses glassmorphic card styling consistent with NexVault's
 * dark aesthetic (#000 background, #00D1FF primary cyan).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { InteractionMode } from "../core/QuantumEngine";
import { getAutomationEngine, type Automation } from "../services/AutomationEngine";
import { getDeviceIntegration, type DeviceState } from "../services/DeviceIntegration";
import { getIoTBridge, type DeviceStatus, type IoTDevice } from "../services/IoTBridge";
import { getJarvis, type AIProvider, type JarvisConfig } from "../services/JarvisCore";
import { useQuantumStore } from "../store/quantumStore";

// ── Constants ──────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;
const PRIMARY = "#00D1FF";
const BG = "#000000";
const CARD_BG = "rgba(255,255,255,0.06)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const SUBTLE_TEXT = "rgba(255,255,255,0.45)";
const SECTION_GAP = 24;

const APP_VERSION = "1.0.0";
const BUILD_NUMBER = Platform.OS === "ios" ? "1" : "1";

// ── Animated Pressable ─────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Types ──────────────────────────────────────────────────────

interface SettingsScreenProps {
  onNavigateBack?: () => void;
}

// ── Sub-Components ─────────────────────────────────────────────

/** Glassmorphic section card */
function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify()}
      style={[styles.glassCard, style]}
    >
      <View style={styles.glassCardTopEdge} />
      {children}
    </Animated.View>
  );
}

/** Section header */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

/** Animated toggle switch */
function ToggleSwitch({
  value,
  onToggle,
  disabled = false,
}: {
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: 250,
      easing: Easing.bezierFn(0.4, 0, 0.2, 1),
    });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(255,255,255,0.12)", "rgba(0,209,255,0.35)"]
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(255,255,255,0.15)", "rgba(0,209,255,0.6)"]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(progress.value * 20, { damping: 15 }) }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["rgba(255,255,255,0.5)", PRIMARY]
    ),
    shadowColor: PRIMARY,
    shadowOpacity: progress.value * 0.6,
    shadowRadius: progress.value * 8,
  }));

  return (
    <Pressable
      onPress={() => !disabled && onToggle(!value)}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

/** Row with label + right content */
function SettingRow({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingRowLeft}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sublabel && <Text style={styles.settingSublabel}>{sublabel}</Text>}
      </View>
      <View style={styles.settingRowRight}>{children}</View>
    </View>
  );
}

/** Segmented selector */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <View style={styles.segmentedContainer}>
      {options.map((option) => {
        const isActive = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segmentedOption, isActive && styles.segmentedOptionActive]}
          >
            <Text style={[styles.segmentedText, isActive && styles.segmentedTextActive]}>
              {labels?.[option] ?? option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Particle count slider (custom, no external dep) */
function ParticleSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<View>(null);
  const fraction = (value - min) / (max - min);
  const fillWidth = useSharedValue(fraction);

  useEffect(() => {
    fillWidth.value = withTiming((value - min) / (max - min), { duration: 150 });
  }, [value, min, max, fillWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value * 100}%` as unknown as number,
  }));

  const handlePress = useCallback(
    (evt: { nativeEvent: { locationX: number } }) => {
      trackRef.current?.measure((_x, _y, width) => {
        if (!width) return;
        const pct = Math.max(0, Math.min(1, evt.nativeEvent.locationX / width));
        const raw = min + pct * (max - min);
        const stepped = Math.round(raw / step) * step;
        const clamped = Math.max(min, Math.min(max, stepped));
        onChange(clamped);
      });
    },
    [min, max, step, onChange]
  );

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderValue}>{value.toLocaleString()}</Text>
        <Text style={styles.sliderRange}>
          {min.toLocaleString()} - {max.toLocaleString()}
        </Text>
      </View>
      <Pressable onPress={handlePress}>
        <View ref={trackRef} style={styles.sliderTrack}>
          <Animated.View style={[styles.sliderFill, fillStyle]} />
          <View
            style={[
              styles.sliderKnob,
              { left: `${fraction * 100}%` as unknown as number },
            ]}
          />
        </View>
      </Pressable>
    </View>
  );
}

/** Status indicator dot */
function StatusDot({ status }: { status: DeviceStatus }) {
  const colorMap: Record<DeviceStatus, string> = {
    online: "#00FF88",
    offline: "rgba(255,255,255,0.25)",
    connecting: "#FFB800",
    error: "#FF4444",
  };

  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (status === "online" || status === "connecting") {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [status, pulseOpacity]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    backgroundColor: colorMap[status],
  }));

  return <Animated.View style={[styles.statusDot, dotStyle]} />;
}

/** Divider line */
function Divider() {
  return <View style={styles.divider} />;
}

// ── Main Settings Screen ───────────────────────────────────────

export function SettingsScreen({ onNavigateBack }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();

  // ── Zustand store ──
  const particleCount = useQuantumStore((s) => s.particleCount);
  const setParticleCount = useQuantumStore((s) => s.setParticleCount);
  const interactionMode = useQuantumStore((s) => s.interactionMode);
  const setInteractionMode = useQuantumStore((s) => s.setInteractionMode);
  const preferredHandedness = useQuantumStore((s) => s.preferredHandedness);
  const setHandedness = useQuantumStore((s) => s.setHandedness);

  // ── Service singletons ──
  const jarvis = useMemo(() => getJarvis(), []);
  const automationEngine = useMemo(() => getAutomationEngine(), []);
  const iotBridge = useMemo(() => getIoTBridge(), []);
  const deviceIntegration = useMemo(() => getDeviceIntegration(), []);

  // ── Jarvis state ──
  const [jarvisConfig, setJarvisConfig] = useState<JarvisConfig>(jarvis.getConfig());
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(jarvisConfig.apiKey ?? "");

  // ── Automation state ──
  const [automations, setAutomations] = useState<Automation[]>(
    automationEngine.getAutomations() as Automation[]
  );

  // ── IoT state ──
  const [iotDevices, setIotDevices] = useState<IoTDevice[]>(iotBridge.getAllDevices());

  // ── Device state ──
  const [deviceState, setDeviceState] = useState<DeviceState>(
    deviceIntegration.getState()
  );
  const [locationTracking, setLocationTracking] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>("Unknown");
  const [networkInfo, setNetworkInfo] = useState<{
    connected: boolean;
    type: string | null;
  }>({ connected: true, type: null });
  const [storageInfo, setStorageInfo] = useState<string>("Calculating...");

  // ── Initialize device info ──
  useEffect(() => {
    (async () => {
      // Network
      const net = await deviceIntegration.checkNetwork();
      setNetworkInfo(net);

      // Device state refresh
      setDeviceState(deviceIntegration.getState());

      // Storage
      const state = deviceIntegration.getState();
      if (state.freeStorage !== null) {
        const mb = (state.freeStorage / (1024 * 1024)).toFixed(1);
        setStorageInfo(`${mb} MB used (documents)`);
      } else {
        setStorageInfo("Unable to determine");
      }

      /* Notification check (Commented out - missing package)
      try {
        const Notifications = require("expo-notifications");
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationStatus(
          status === "granted"
            ? "Enabled"
            : status === "denied"
              ? "Denied"
              : "Not Determined"
        );
      } catch {
        setNotificationStatus("Unavailable");
      }
      */
    })();
  }, [deviceIntegration]);

  // ── Refresh automations and IoT on focus ──
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      setAutomations(automationEngine.getAutomations() as Automation[]);
      setIotDevices(iotBridge.getAllDevices());
    }, 5000);

    return () => clearInterval(refreshInterval);
  }, [automationEngine, iotBridge]);

  // ── Jarvis handlers ──
  const updateJarvisProvider = useCallback(
    (provider: AIProvider) => {
      jarvis.updateConfig({ provider });
      setJarvisConfig(jarvis.getConfig());
    },
    [jarvis]
  );

  const saveApiKey = useCallback(() => {
    jarvis.updateConfig({ apiKey: apiKeyInput || undefined });
    setJarvisConfig(jarvis.getConfig());
    setApiKeyVisible(false);
  }, [jarvis, apiKeyInput]);

  const toggleLearning = useCallback(
    (enabled: boolean) => {
      jarvis.updateConfig({ enableLearning: enabled });
      setJarvisConfig(jarvis.getConfig());
    },
    [jarvis]
  );

  const toggleProactive = useCallback(
    (enabled: boolean) => {
      jarvis.updateConfig({ enableProactiveSuggestions: enabled });
      setJarvisConfig(jarvis.getConfig());
    },
    [jarvis]
  );

  // ── Automation handlers ──
  const toggleAutomation = useCallback(
    async (id: string, enabled: boolean) => {
      await automationEngine.toggleAutomation(id, enabled);
      setAutomations(automationEngine.getAutomations() as Automation[]);
    },
    [automationEngine]
  );

  const addNewAutomation = useCallback(async () => {
    const id = `auto_${Date.now()}`;
    await automationEngine.addAutomation({
      id,
      name: `Automation ${automations.length + 1}`,
      description: "New automation - configure trigger and actions",
      trigger: { type: "MANUAL", config: {} },
      actions: [],
      enabled: false,
    });
    setAutomations(automationEngine.getAutomations() as Automation[]);
  }, [automationEngine, automations.length]);

  const removeAutomation = useCallback(
    async (id: string) => {
      Alert.alert(
        "Remove Automation",
        "Are you sure you want to remove this automation?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              await automationEngine.removeAutomation(id);
              setAutomations(automationEngine.getAutomations() as Automation[]);
            },
          },
        ]
      );
    },
    [automationEngine]
  );

  // ── IoT handlers ──
  const addNewDevice = useCallback(async () => {
    const id = `iot_${Date.now()}`;
    await iotBridge.registerDevice({
      id,
      name: `Device ${iotDevices.length + 1}`,
      type: "custom",
      connectionType: "http",
      address: "192.168.1.100",
      capabilities: [],
      metadata: {},
    });
    setIotDevices(iotBridge.getAllDevices());
  }, [iotBridge, iotDevices.length]);

  const removeDevice = useCallback(
    async (id: string) => {
      Alert.alert("Remove Device", "Are you sure you want to remove this IoT device?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await iotBridge.removeDevice(id);
            setIotDevices(iotBridge.getAllDevices());
          },
        },
      ]);
    },
    [iotBridge]
  );

  // ── Device handlers ──
  const toggleLocationTracking = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await deviceIntegration.requestLocationPermission();
        if (granted) {
          await deviceIntegration.startLocationTracking();
          setLocationTracking(true);
        } else {
          Alert.alert(
            "Permission Required",
            "Location permission is needed for tracking."
          );
        }
      } else {
        deviceIntegration.stopLocationTracking();
        setLocationTracking(false);
      }
    },
    [deviceIntegration]
  );

  // ── Masked API key display ──
  const maskedKey = useMemo(() => {
    if (!jarvisConfig.apiKey) return "Not set";
    const key = jarvisConfig.apiKey;
    if (key.length <= 8) return "****";
    return `${key.slice(0, 4)}${"*".repeat(Math.min(key.length - 8, 24))}${key.slice(-4)}`;
  }, [jarvisConfig.apiKey]);

  // ── Header scroll animation ──
  const scrollY = useSharedValue(0);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0.6, 1 - scrollY.value / 200),
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View style={[styles.header, headerStyle]}>
        {onNavigateBack && (
          <Pressable onPress={onNavigateBack} style={styles.backButton} hitSlop={12}>
            <Text style={styles.backButtonText}>{"<"}</Text>
          </Pressable>
        )}
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* ══════════════════════════════════════════════════════
           1. AI ASSISTANT (JARVIS)
           ══════════════════════════════════════════════════════ */}
        <SectionHeader
          title="AI Assistant"
          subtitle="Jarvis configuration and behavior"
        />
        <GlassCard>
          {/* Provider Selector */}
          <SettingRow label="Provider" sublabel="AI backend for advanced queries">
            <SegmentedControl<AIProvider>
              options={["local", "anthropic", "openai"]}
              value={jarvisConfig.provider}
              onChange={updateJarvisProvider}
              labels={{
                local: "Local",
                anthropic: "Anthropic",
                openai: "OpenAI",
              }}
            />
          </SettingRow>

          <Divider />

          {/* API Key */}
          <View style={styles.apiKeySection}>
            <View style={styles.settingRowLeft}>
              <Text style={styles.settingLabel}>API Key</Text>
              <Text style={styles.settingSublabel}>
                {jarvisConfig.provider === "local"
                  ? "Not required for local mode"
                  : `Required for ${jarvisConfig.provider}`}
              </Text>
            </View>

            {jarvisConfig.provider !== "local" && (
              <>
                <View style={styles.apiKeyRow}>
                  <TextInput
                    style={styles.apiKeyInput}
                    value={apiKeyVisible ? apiKeyInput : maskedKey}
                    onChangeText={setApiKeyInput}
                    placeholder="Enter API key..."
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    secureTextEntry={!apiKeyVisible}
                    editable={apiKeyVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor={PRIMARY}
                  />
                  <Pressable
                    onPress={() => {
                      if (apiKeyVisible) {
                        saveApiKey();
                      } else {
                        setApiKeyInput(jarvisConfig.apiKey ?? "");
                        setApiKeyVisible(true);
                      }
                    }}
                    style={styles.apiKeyToggle}
                  >
                    <Text style={styles.apiKeyToggleText}>
                      {apiKeyVisible ? "SAVE" : "EDIT"}
                    </Text>
                  </Pressable>
                </View>
                {apiKeyVisible && (
                  <Pressable
                    onPress={() => {
                      setApiKeyVisible(false);
                      setApiKeyInput(jarvisConfig.apiKey ?? "");
                    }}
                    style={styles.apiKeyCancelButton}
                  >
                    <Text style={styles.apiKeyCancelText}>Cancel</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <Divider />

          {/* Learning Toggle */}
          <SettingRow label="Learning" sublabel="Learn from interaction patterns">
            <ToggleSwitch value={jarvisConfig.enableLearning} onToggle={toggleLearning} />
          </SettingRow>

          <Divider />

          {/* Proactive Suggestions Toggle */}
          <SettingRow
            label="Proactive Suggestions"
            sublabel="Suggest actions based on usage"
          >
            <ToggleSwitch
              value={jarvisConfig.enableProactiveSuggestions}
              onToggle={toggleProactive}
            />
          </SettingRow>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════
           2. INTERACTION
           ══════════════════════════════════════════════════════ */}
        <SectionHeader
          title="Interaction"
          subtitle="Input modes and visual preferences"
        />
        <GlassCard>
          {/* Handedness */}
          <SettingRow label="Handedness" sublabel="Preferred hand for gesture input">
            <SegmentedControl<"LEFT" | "RIGHT">
              options={["LEFT", "RIGHT"]}
              value={preferredHandedness}
              onChange={setHandedness}
              labels={{ LEFT: "Left", RIGHT: "Right" }}
            />
          </SettingRow>

          <Divider />

          {/* Interaction Mode */}
          <SettingRow label="Interaction Mode" sublabel="Primary input method">
            <SegmentedControl<InteractionMode>
              options={["HYBRID", "TOUCH", "GESTURE", "VOICE"]}
              value={interactionMode}
              onChange={setInteractionMode}
              labels={{
                HYBRID: "Hybrid",
                TOUCH: "Touch",
                GESTURE: "Gesture",
                VOICE: "Voice",
              }}
            />
          </SettingRow>

          <Divider />

          {/* Particle Count */}
          <View style={styles.sliderSection}>
            <Text style={styles.settingLabel}>Particle Count</Text>
            <Text style={styles.settingSublabel}>
              Higher values increase visual density but use more GPU
            </Text>
            <ParticleSlider
              value={particleCount}
              min={500}
              max={10000}
              step={500}
              onChange={setParticleCount}
            />
          </View>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════
           3. AUTOMATION
           ══════════════════════════════════════════════════════ */}
        <SectionHeader title="Automation" subtitle="Automated workflows and triggers" />
        <GlassCard>
          {automations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No automations configured</Text>
              <Text style={styles.emptyStateSubtext}>
                Create automated workflows triggered by time, location, sensors, or voice
                commands
              </Text>
            </View>
          ) : (
            <Animated.View layout={LinearTransition.springify()}>
              {automations.map((automation, index) => (
                <React.Fragment key={automation.id}>
                  {index > 0 && <Divider />}
                  <AutomationRow
                    automation={automation}
                    onToggle={toggleAutomation}
                    onRemove={removeAutomation}
                  />
                </React.Fragment>
              ))}
            </Animated.View>
          )}

          <Divider />

          <Pressable
            onPress={addNewAutomation}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add Automation</Text>
          </Pressable>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════
           4. IOT DEVICES
           ══════════════════════════════════════════════════════ */}
        <SectionHeader title="IoT Devices" subtitle="Connected hardware and sensors" />
        <GlassCard>
          {iotDevices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No devices registered</Text>
              <Text style={styles.emptyStateSubtext}>
                Connect smart home devices, Arduino/ESP32 hardware, or Raspberry Pi
                servers
              </Text>
            </View>
          ) : (
            <Animated.View layout={LinearTransition.springify()}>
              {iotDevices.map((device, index) => (
                <React.Fragment key={device.id}>
                  {index > 0 && <Divider />}
                  <IoTDeviceRow device={device} onRemove={removeDevice} />
                </React.Fragment>
              ))}
            </Animated.View>
          )}

          <Divider />

          <Pressable
            onPress={addNewDevice}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add Device</Text>
          </Pressable>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════
           5. DEVICE
           ══════════════════════════════════════════════════════ */}
        <SectionHeader title="Device" subtitle="System permissions and status" />
        <GlassCard>
          {/* Location Tracking */}
          <SettingRow label="Location Tracking" sublabel="Enable GPS for Reality Anchors">
            <ToggleSwitch value={locationTracking} onToggle={toggleLocationTracking} />
          </SettingRow>

          <Divider />

          {/* Notification Status (Commented out - missing package)
          <SettingRow label="Notifications" sublabel="Push notification permission">
            <View style={styles.flexRow}>
              <Text style={styles.statusText}>
                {notificationStatus}
              </Text>
              <View
                style={[
                  styles.statusLight,
                  notificationStatus === "Enabled"
                    ? styles.statusOnline
                    : notificationStatus === "Denied"
                      ? styles.statusError
                      : styles.statusOffline,
                ]}
              />
            </View>
          </SettingRow>
          */}

          <Divider />

          {/* Network Status */}
          <SettingRow label="Network" sublabel="Current connection status">
            <View style={styles.networkInfo}>
              <StatusDot status={networkInfo.connected ? "online" : "offline"} />
              <Text style={styles.networkText}>
                {networkInfo.connected ? (networkInfo.type ?? "Connected") : "Offline"}
              </Text>
            </View>
          </SettingRow>

          <Divider />

          {/* Storage */}
          <SettingRow label="Storage" sublabel="Document directory usage">
            <Text style={styles.infoValue}>{storageInfo}</Text>
          </SettingRow>

          <Divider />

          {/* Device Info */}
          <SettingRow label="Device" sublabel="Hardware information">
            <Text style={styles.infoValue} numberOfLines={1}>
              {deviceState.deviceModel ?? "Unknown"}
            </Text>
          </SettingRow>

          <Divider />

          {/* OS Version */}
          <SettingRow label="OS Version">
            <Text style={styles.infoValue}>
              {Platform.OS === "ios" ? "iOS" : "Android"} {deviceState.osVersion ?? "?"}
            </Text>
          </SettingRow>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════
           6. ABOUT
           ══════════════════════════════════════════════════════ */}
        <SectionHeader title="About" subtitle="NexVault information" />
        <GlassCard>
          <SettingRow label="App Version">
            <Text style={styles.infoValue}>{APP_VERSION}</Text>
          </SettingRow>

          <Divider />

          <SettingRow label="Build Number">
            <Text style={styles.infoValue}>{BUILD_NUMBER}</Text>
          </SettingRow>

          <Divider />

          <SettingRow label="SDK">
            <Text style={styles.infoValue}>Expo SDK 52</Text>
          </SettingRow>

          <Divider />

          <Pressable
            onPress={() => Linking.openURL("https://github.com/nexvault")}
            style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
          >
            <Text style={styles.linkText}>GitHub Repository</Text>
            <Text style={styles.linkArrow}>{">"}</Text>
          </Pressable>

          <Divider />

          <Pressable
            onPress={() => Linking.openURL("https://nexvault.dev/privacy")}
            style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>{">"}</Text>
          </Pressable>

          <Divider />

          <Pressable
            onPress={() => Linking.openURL("https://nexvault.dev/terms")}
            style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
            <Text style={styles.linkArrow}>{">"}</Text>
          </Pressable>

          <Divider />

          <Pressable
            onPress={() => Linking.openURL("https://nexvault.dev/docs")}
            style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
          >
            <Text style={styles.linkText}>Documentation</Text>
            <Text style={styles.linkArrow}>{">"}</Text>
          </Pressable>
        </GlassCard>

        {/* ── Footer ── */}
        <Animated.View entering={FadeIn.delay(600)} style={styles.footer}>
          <Text style={styles.footerText}>NexVault</Text>
          <Text style={styles.footerSubtext}>Quantum Spatial Research Interface</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Automation Row Component ───────────────────────────────────

function AutomationRow({
  automation,
  onToggle,
  onRemove,
}: {
  automation: Automation;
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const triggerLabel = useMemo(() => {
    const labels: Record<string, string> = {
      SCHEDULE: "Scheduled",
      LOCATION: "Location",
      SENSOR: "Sensor",
      IOT_EVENT: "IoT Event",
      VOICE: "Voice",
      STATE_CHANGE: "State Change",
      MANUAL: "Manual",
    };
    return labels[automation.trigger.type] ?? automation.trigger.type;
  }, [automation.trigger.type]);

  return (
    <View style={styles.automationRow}>
      <Pressable
        onLongPress={() => onRemove(automation.id)}
        style={styles.automationInfo}
      >
        <Text style={styles.automationName}>{automation.name}</Text>
        <Text style={styles.automationMeta}>
          {triggerLabel}
          {automation.runCount > 0 && ` \u00B7 ${automation.runCount} runs`}
          {automation.lastRun &&
            ` \u00B7 Last: ${new Date(automation.lastRun).toLocaleDateString()}`}
        </Text>
        {automation.description ? (
          <Text style={styles.automationDesc} numberOfLines={1}>
            {automation.description}
          </Text>
        ) : null}
      </Pressable>
      <ToggleSwitch
        value={automation.enabled}
        onToggle={(enabled) => onToggle(automation.id, enabled)}
      />
    </View>
  );
}

// ── IoT Device Row Component ───────────────────────────────────

function IoTDeviceRow({
  device,
  onRemove,
}: {
  device: IoTDevice;
  onRemove: (id: string) => void;
}) {
  const typeLabel = useMemo(() => {
    const labels: Record<string, string> = {
      light: "Light",
      thermostat: "Thermostat",
      sensor: "Sensor",
      camera: "Camera",
      custom: "Custom",
    };
    return labels[device.type] ?? device.type;
  }, [device.type]);

  const connectionLabel = useMemo(() => {
    const labels: Record<string, string> = {
      websocket: "WebSocket",
      mqtt: "MQTT",
      ble: "Bluetooth",
      http: "HTTP",
    };
    return labels[device.connectionType] ?? device.connectionType;
  }, [device.connectionType]);

  return (
    <Pressable onLongPress={() => onRemove(device.id)} style={styles.deviceRow}>
      <View style={styles.deviceInfo}>
        <View style={styles.deviceNameRow}>
          <StatusDot status={device.status} />
          <Text style={styles.deviceName}>{device.name}</Text>
        </View>
        <Text style={styles.deviceMeta}>
          {typeLabel} \u00B7 {connectionLabel} \u00B7 {device.address}
          {device.port ? `:${device.port}` : ""}
        </Text>
        {device.lastSeen > 0 && (
          <Text style={styles.deviceLastSeen}>
            Last seen: {new Date(device.lastSeen).toLocaleString()}
          </Text>
        )}
      </View>
      <Text style={styles.deviceStatusText}>{device.status}</Text>
    </Pressable>
  );
}

// ── Status Badge Component ─────────────────────────────────────

function StatusBadge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.statusBadge, { borderColor: color }]}>
      <Text style={[styles.statusBadgeText, { color }]}>{text}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
  },
  headerSpacer: {
    width: 32,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Section Header
  sectionHeader: {
    marginTop: SECTION_GAP,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    color: SUBTLE_TEXT,
    fontSize: 12,
    marginTop: 2,
  },

  // Glass Card
  glassCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    padding: 16,
    overflow: "hidden",
  },
  glassCardTopEdge: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 1,
  },

  // Setting Row
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: 8,
  },
  settingRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  settingRowRight: {
    flexShrink: 0,
  },
  settingLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  settingSublabel: {
    color: SUBTLE_TEXT,
    fontSize: 12,
    marginTop: 2,
  },

  // Toggle
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    shadowOffset: { width: 0, height: 0 },
  },

  // Segmented Control
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  segmentedOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 48,
    alignItems: "center",
  },
  segmentedOptionActive: {
    backgroundColor: "rgba(0,209,255,0.2)",
    borderRadius: 7,
  },
  segmentedText: {
    color: SUBTLE_TEXT,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  segmentedTextActive: {
    color: PRIMARY,
  },

  // API Key
  apiKeySection: {
    paddingVertical: 8,
  },
  apiKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  apiKeyInput: {
    flex: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  apiKeyToggle: {
    height: 40,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,209,255,0.15)",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(0,209,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  apiKeyToggleText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  apiKeyCancelButton: {
    marginTop: 8,
    alignSelf: "flex-end",
  },
  apiKeyCancelText: {
    color: SUBTLE_TEXT,
    fontSize: 12,
  },

  // Slider
  sliderSection: {
    paddingVertical: 8,
  },
  sliderContainer: {
    marginTop: 12,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sliderValue: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sliderRange: {
    color: SUBTLE_TEXT,
    fontSize: 11,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "visible",
    position: "relative",
  },
  sliderFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 6,
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },
  sliderKnob: {
    position: "absolute",
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: "#000000",
    shadowColor: PRIMARY,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  // Empty State
  emptyState: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyStateText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
  },
  emptyStateSubtext: {
    color: SUBTLE_TEXT,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  // Add Button
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  addButtonPressed: {
    opacity: 0.5,
  },
  addButtonIcon: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "600",
  },
  addButtonText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Automation Row
  automationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  automationInfo: {
    flex: 1,
    marginRight: 12,
  },
  automationName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  automationMeta: {
    color: SUBTLE_TEXT,
    fontSize: 11,
    marginTop: 2,
  },
  automationDesc: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginTop: 2,
  },

  // IoT Device Row
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  deviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deviceName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  deviceMeta: {
    color: SUBTLE_TEXT,
    fontSize: 11,
    marginTop: 3,
    marginLeft: 18,
  },
  deviceLastSeen: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 10,
    marginTop: 2,
    marginLeft: 18,
  },
  deviceStatusText: {
    color: SUBTLE_TEXT,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Status
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Network
  networkInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  networkText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },

  // Info Value
  infoValue: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },

  // Divider
  divider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 4,
  },

  // Links
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  linkRowPressed: {
    opacity: 0.5,
  },
  linkText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "500",
  },
  linkArrow: {
    color: SUBTLE_TEXT,
    fontSize: 16,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  footerText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 6,
  },
  footerSubtext: {
    color: "rgba(255,255,255,0.1)",
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 2,
  },
});
