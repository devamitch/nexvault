// warp.vert - Space Distortion Vertex Shader
//
// Creates wormhole/tunnel transition effects by displacing
// vertex positions along radial vectors from a focal point.
// Used for the Phase transition animations.
//
// Uniforms:
//   u_time       - Animation time (float)
//   u_intensity  - Warp strength 0-1 (float)
//   u_focalPoint - Center of warp effect in model space (vec3)
//   u_mode       - 0: collapse (inward), 1: expand (outward), 2: tunnel

precision mediump float;

uniform float u_time;
uniform float u_intensity;
uniform vec3 u_focalPoint;
uniform int u_mode;

attribute vec3 position;
attribute vec2 uv;
attribute vec3 normal;

varying vec2 v_uv;
varying float v_distortion;

// Smooth noise for organic distortion
float hash3D(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main() {
    v_uv = uv;

    vec3 pos = position;
    vec3 toFocal = pos - u_focalPoint;
    float dist = length(toFocal);
    vec3 dir = normalize(toFocal);

    float warpAmount = 0.0;

    if (u_mode == 0) {
        // COLLAPSE: Pull vertices toward focal point
        // Closer vertices move faster, creating funnel effect
        float falloff = 1.0 / (1.0 + dist * dist);
        warpAmount = -u_intensity * falloff * 3.0;

        // Add spiral rotation
        float angle = u_intensity * 3.14159 * 2.0 * falloff;
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        pos.xy = u_focalPoint.xy + rot * toFocal.xy;
    }
    else if (u_mode == 1) {
        // EXPAND: Push vertices away from focal point
        float falloff = exp(-dist * 0.5);
        warpAmount = u_intensity * falloff * 2.0;
    }
    else if (u_mode == 2) {
        // TUNNEL: Create cylindrical tunnel warping
        float radial = length(pos.xy - u_focalPoint.xy);
        float tunnelRadius = 1.0 + u_intensity * 3.0;

        // Push vertices outward to form tunnel walls
        if (radial < tunnelRadius) {
            vec2 radDir = normalize(pos.xy - u_focalPoint.xy);
            pos.xy = u_focalPoint.xy + radDir * tunnelRadius;
        }

        // Stretch along Z for tunnel depth
        pos.z += u_intensity * pos.z * 0.5;
        warpAmount = u_intensity;
    }

    // Apply warp displacement along focal direction
    pos += dir * warpAmount;

    // Add noise-based turbulence for organic feel
    float turbulence = hash3D(pos + u_time * 0.5) * u_intensity * 0.2;
    pos += normal * turbulence;

    v_distortion = abs(warpAmount);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
