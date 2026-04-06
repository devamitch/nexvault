/**
 * Widget Module Barrel Export
 *
 * Central export point for all NexVault widget infrastructure.
 *
 * Usage:
 * ```ts
 * import {
 *   QuantumWidget,
 *   updateWidgetData,
 *   getWidgetData,
 *   syncWidgetData,
 *   requestWidgetReload,
 *   isWidgetSupported,
 *   getWidgetSupportInfo,
 * } from '@/widgets';
 * ```
 *
 * The React Native component and AsyncStorage-based data layer come from
 * QuantumWidget.tsx. The native bridge that pushes data to iOS WidgetKit
 * and Android AppWidgetProvider comes from WidgetBridge.ts.
 */

// ── React Native Widget Component & Data Layer ────────────────
export {
  QuantumWidget,
  updateWidgetData,
  getWidgetData as getWidgetDataFromStorage,
} from "./QuantumWidget";

// ── Cross-Platform Native Widget Bridge ───────────────────────
export {
  syncWidgetData,
  requestWidgetReload,
  getWidgetData,
  isWidgetSupported,
  getWidgetSupportInfo,
} from "./WidgetBridge";

// ── Re-export Types ───────────────────────────────────────────
export type { WidgetData } from "./WidgetBridge";
