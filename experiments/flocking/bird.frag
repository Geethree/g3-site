#version 300 es
precision highp float;
in vec3 v_corner;
in vec3 v_color;
out vec4 color;
void main() {
    // Distance from the nearest triangle edge makes a soft outline.
    float edge = min(v_corner.x, min(v_corner.y, v_corner.z));
    float glow = smoothstep(0.0, 0.16, edge);
    color = vec4(v_color, 0.75 * glow);
}
