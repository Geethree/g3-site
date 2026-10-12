#version 300 es
precision highp float;
in vec3 v_color;
in float v_alpha;
out vec4 color;
// Runs for each pixel inside a point's square. Turn it into a soft round glow.
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float glow = exp(-r * r * 4.5) * (1.0 - smoothstep(0.7, 1.0, r));
    color = vec4(v_color, glow * v_alpha);
}
