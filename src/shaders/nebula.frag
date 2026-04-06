// nebula.frag - Particle Glow Shader
//
// Creates a soft, bioluminescent glow effect for individual particles.
// Uses radial falloff with additive blending to produce
// ethereal, self-illuminating orbs.
//
// Uniforms:
//   u_color   - Base particle color (vec3)
//   u_opacity - Global opacity multiplier (float)
//   u_time    - Animation time for subtle pulse (float)
//   u_size    - Particle size scale factor (float)

precision mediump float;

uniform vec3 u_color;
uniform float u_opacity;
uniform float u_time;
uniform float u_size;

varying vec2 v_uv;

void main() {
    // Distance from center of particle quad (0 at center, 1 at edge)
    vec2 center = v_uv - 0.5;
    float dist = length(center) * 2.0;

    // Soft radial falloff with cubic ease
    float glow = 1.0 - smoothstep(0.0, 1.0, dist);
    glow = glow * glow * glow; // Cubic falloff for softer edges

    // Inner core is brighter (hot white center)
    float core = 1.0 - smoothstep(0.0, 0.15, dist);

    // Subtle breathing animation
    float pulse = 1.0 + sin(u_time * 2.0) * 0.1;

    // Combine core brightness with outer glow
    vec3 coreColor = mix(u_color, vec3(1.0), 0.7); // Near-white core
    vec3 finalColor = mix(u_color * glow, coreColor * core, core);

    // Apply opacity and pulse
    float alpha = glow * u_opacity * pulse;

    // Discard fully transparent fragments for performance
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(finalColor, alpha);
}
