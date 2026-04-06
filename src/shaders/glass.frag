// glass.frag - Liquid Glassmorphic Material Shader
//
// Produces an Apple-style frosted glass effect with:
//   - Background blur simulation via Gaussian sampling
//   - Refraction displacement for depth illusion
//   - Edge highlight for material separation
//   - Animated caustic patterns for "liquid" feel
//
// Uniforms:
//   u_resolution  - Viewport resolution (vec2)
//   u_time        - Animation time (float)
//   u_blurAmount  - Blur strength 0-1 (float)
//   u_opacity     - Material opacity (float)
//   u_tintColor   - Glass tint color (vec3)
//   u_refraction  - Refraction strength (float)
//   u_background  - Background sampler (sampler2D)

precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_blurAmount;
uniform float u_opacity;
uniform vec3 u_tintColor;
uniform float u_refraction;
uniform sampler2D u_background;

varying vec2 v_uv;

// Simple 2D noise for caustic patterns
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Caustic light pattern
float caustics(vec2 uv, float time) {
    float c = 0.0;
    c += noise2D(uv * 3.0 + time * 0.3) * 0.5;
    c += noise2D(uv * 6.0 - time * 0.2) * 0.25;
    c += noise2D(uv * 12.0 + time * 0.15) * 0.125;
    return c;
}

void main() {
    vec2 uv = v_uv;

    // 1. Refraction displacement
    float noiseVal = noise2D(uv * 4.0 + u_time * 0.1);
    vec2 displacement = vec2(
        noise2D(uv * 5.0 + u_time * 0.15) - 0.5,
        noise2D(uv * 5.0 + u_time * 0.15 + 1.5) - 0.5
    ) * u_refraction * 0.02;

    vec2 refractedUV = uv + displacement;

    // 2. Simulated blur (box filter approximation)
    vec3 blurred = vec3(0.0);
    float pixelSize = u_blurAmount * 0.005;
    const int SAMPLES = 5;
    float totalWeight = 0.0;

    for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * pixelSize;
            float weight = 1.0 - length(vec2(float(x), float(y))) * 0.2;
            blurred += texture2D(u_background, refractedUV + offset).rgb * weight;
            totalWeight += weight;
        }
    }
    blurred /= totalWeight;

    // 3. Glass tint
    vec3 tinted = mix(blurred, u_tintColor, 0.15);

    // 4. Caustic highlights
    float causticsValue = caustics(uv, u_time);
    vec3 causticLight = vec3(1.0) * causticsValue * 0.08;

    // 5. Edge highlight (Fresnel-like effect based on UV position)
    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeHighlight = smoothstep(0.0, 0.1, edgeDist) * 0.3;
    float topHighlight = smoothstep(0.95, 1.0, uv.y) * 0.15;

    // 6. Combine
    vec3 finalColor = tinted + causticLight;
    finalColor += vec3(1.0) * topHighlight; // Top edge shine
    finalColor += vec3(1.0) * (1.0 - edgeHighlight) * 0.05; // Edge glow

    gl_FragColor = vec4(finalColor, u_opacity);
}
