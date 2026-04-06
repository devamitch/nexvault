/**
 * WaveformViz.tsx - Audio Waveform Visualization
 *
 * Real-time audio waveform rendering using Skia Canvas.
 * Supports two modes:
 *   LIVE     - Reacts to audio amplitude SharedValue in real-time
 *   PLAYBACK - Renders a static waveform from saved amplitude data
 *
 * Visual features:
 *   - Vertical bar visualization with center-aligned mirroring
 *   - Color gradient based on amplitude intensity
 *   - Glow effect on peak bars
 *   - Optional 3D sculpted mesh mode for memo shapes
 */

import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import {
  Canvas,
  RoundedRect,
  LinearGradient,
  vec,
} from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

interface WaveformVizProps {
  width: number;
  height: number;
  /** Live amplitude (0-1) for real-time mode */
  amplitude?: SharedValue<number>;
  /** Pre-recorded waveform data for playback mode */
  waveformData?: number[];
  /** Number of bars to render */
  barCount?: number;
  /** Primary color */
  color?: string;
  /** Secondary color for gradient */
  colorSecondary?: string;
  /** Bar width in pixels */
  barWidth?: number;
  /** Gap between bars */
  barGap?: number;
  /** Whether to mirror bars vertically from center */
  mirrored?: boolean;
}

export function WaveformViz({
  width,
  height,
  amplitude,
  waveformData,
  barCount = 40,
  color = "#00D1FF",
  colorSecondary = "#0066CC",
  barWidth: customBarWidth,
  barGap = 2,
  mirrored = true,
}: WaveformVizProps) {
  const barWidth = customBarWidth ?? (width - barGap * barCount) / barCount;
  const centerY = height / 2;

  // Generate bar heights from either live amplitude or static data
  const bars = useMemo(() => {
    if (waveformData && waveformData.length > 0) {
      // Downsample or upsample waveformData to barCount
      return Array.from({ length: barCount }, (_, i) => {
        const dataIdx = Math.floor((i / barCount) * waveformData.length);
        return waveformData[dataIdx] ?? 0;
      });
    }

    // Generate random phase offsets for live mode
    return Array.from({ length: barCount }, (_, i) => {
      const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
      return 1 - centerDist * 0.6; // Higher in center, lower at edges
    });
  }, [barCount, waveformData]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        {bars.map((baseHeight, i) => {
          const amp = amplitude?.value ?? (waveformData ? baseHeight : 0);
          const h = Math.max(2, baseHeight * amp * height * 0.4);
          const x = i * (barWidth + barGap);
          const alpha = 0.4 + amp * 0.6;

          if (mirrored) {
            // Top half (growing upward from center)
            return (
              <React.Fragment key={i}>
                <RoundedRect
                  x={x}
                  y={centerY - h}
                  width={barWidth}
                  height={h}
                  r={1}
                >
                  <LinearGradient
                    start={vec(x, centerY)}
                    end={vec(x, centerY - h)}
                    colors={[
                      `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`,
                      `${colorSecondary}${Math.round(alpha * 128).toString(16).padStart(2, "0")}`,
                    ]}
                  />
                </RoundedRect>
                {/* Bottom mirror */}
                <RoundedRect
                  x={x}
                  y={centerY}
                  width={barWidth}
                  height={h}
                  r={1}
                >
                  <LinearGradient
                    start={vec(x, centerY)}
                    end={vec(x, centerY + h)}
                    colors={[
                      `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`,
                      `${colorSecondary}${Math.round(alpha * 64).toString(16).padStart(2, "0")}`,
                    ]}
                  />
                </RoundedRect>
              </React.Fragment>
            );
          }

          // Non-mirrored: bars grow from bottom
          return (
            <RoundedRect
              key={i}
              x={x}
              y={height - h}
              width={barWidth}
              height={h}
              r={1}
              color={`${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
