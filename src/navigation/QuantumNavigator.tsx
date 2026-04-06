/**
 * QuantumNavigator.tsx - React Navigation with Custom Transitions
 *
 * Full navigation setup using @react-navigation/native-stack
 * with custom particle-based screen transitions.
 *
 * Screen hierarchy:
 *   CalibrationVoid → AuthenticationField → MainTabs
 *     ├── QuantumHub (Home)
 *     ├── ResearchNexus (Vault)
 *     ├── MemoSpace (Voice Memos)
 *     └── Settings (Jarvis, IoT, Automation)
 */

import React from "react";
import { NavigationContainer, type Theme } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";

import { CalibrationVoid } from "../screens/CalibrationVoid";
import { AuthenticationField } from "../screens/AuthenticationField";
import { QuantumHub } from "../screens/QuantumHub";
import { ResearchNexus } from "../screens/ResearchNexus";
import { MemoSpace } from "../screens/MemoSpace";
import { SettingsScreen } from "../screens/SettingsScreen";

// ── Navigation Types ──────────────────────────────────────────

export type RootStackParamList = {
  Calibration: undefined;
  Authentication: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Hub: undefined;
  Research: undefined;
  Memos: undefined;
  Settings: undefined;
};

// ── Dark Theme ────────────────────────────────────────────────

const QUANTUM_THEME: Theme = {
  dark: true,
  colors: {
    primary: "#00D1FF",
    background: "#000000",
    card: "rgba(0,0,0,0.9)",
    text: "#FFFFFF",
    border: "rgba(255,255,255,0.1)",
    notification: "#00D1FF",
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "900" },
  },
};

// ── Stack Navigator ───────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const STACK_OPTIONS: NativeStackNavigationOptions = {
  headerShown: false,
  animation: "fade",
  animationDuration: 500,
  gestureEnabled: false,
  contentStyle: { backgroundColor: "#000000" },
};

// ── Tab Bar Icon ──────────────────────────────────────────────

function TabIcon({ focused, color }: { focused: boolean; color: string }) {
  return (
    <View
      style={[
        styles.tabDot,
        { backgroundColor: color, opacity: focused ? 1 : 0.3 },
      ]}
    />
  );
}

// ── Settings Tab Icon (gear shape) ───────────────────────────

function SettingsIcon({
  focused,
  color,
}: {
  focused: boolean;
  color: string;
}) {
  return (
    <View
      style={[
        styles.settingsDot,
        {
          borderColor: color,
          opacity: focused ? 1 : 0.3,
        },
      ]}
    >
      <View
        style={[styles.settingsInnerDot, { backgroundColor: color }]}
      />
    </View>
  );
}

// ── Main Tab Navigator ────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#00D1FF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.3)",
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Hub"
        component={QuantumHub}
        options={{
          tabBarLabel: "HUB",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Research"
        component={ResearchNexus}
        options={{
          tabBarLabel: "VAULT",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Memos"
        component={MemoSpace}
        options={{
          tabBarLabel: "MEMOS",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "CONFIG",
          tabBarIcon: ({ focused, color }) => (
            <SettingsIcon focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root Navigator ────────────────────────────────────────────

interface QuantumNavigatorProps {
  initialRoute?: keyof RootStackParamList;
}

export function QuantumNavigator({
  initialRoute = "Calibration",
}: QuantumNavigatorProps) {
  return (
    <NavigationContainer theme={QUANTUM_THEME}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={STACK_OPTIONS}
      >
        <Stack.Screen name="Calibration">
          {(props) => (
            <CalibrationVoid
              onComplete={() => props.navigation.replace("Authentication")}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Authentication">
          {(props) => (
            <AuthenticationField
              onAuthenticated={() => props.navigation.replace("Main")}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.08)",
    height: 70,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: "500",
    letterSpacing: 3,
    marginTop: 4,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  settingsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsInnerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
