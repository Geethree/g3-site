#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform vec2 u_pulse_origin;
uniform float u_time;
uniform float u_pulse_age;
uniform float u_palette;
out vec3 v_color;
out float v_alpha;
// Runs once per point. No vertex buffer: gl_VertexID gives each point its number.
void main() {
    // Split the point number into a strand and a position along that strand.
    float strand = floor(float(gl_VertexID) / 420.0);
    float s = mod(float(gl_VertexID), 420.0) / 419.0;
    float lane = strand / 95.0;
    // Wrap the strands around a curved tube, then add a smaller ripple.
    float z = lane * 6.2831853 + s * 5.0 + u_time * 0.16;
    vec3 p = vec3((s - 0.5) * 3.7,
        sin(z) * (0.28 + 0.46 * sin(s * 3.14159)) + (lane - 0.5) * 0.38,
        cos(z) * 0.75);
    p.y += 0.10 * sin(s * 15.0 + lane * 7.0 - u_time * 0.6);
    // Points closer to the viewer look larger. Adjust X for the canvas shape.
    float perspective = 2.6 / (2.6 + p.z);
    vec2 pos = p.xy * perspective;
    float aspect = u_resolution.x / u_resolution.y;
    pos.x /= max(aspect, 0.85);
    // Push nearby points away from the pointer; the effect fades with distance.
    vec2 delta = pos - u_pointer;
    float attraction = exp(-dot(delta, delta) * 3.8);
    pos += delta * attraction * 0.30;
    pos.y += attraction * sin(u_time * 1.5 + s * 8.0) * 0.045;
    // A click makes an expanding ring. Its strength fades as the pulse ages.
    float radius = length(pos - u_pulse_origin);
    float wave = exp(-pow((radius - u_pulse_age * 0.65) * 13.0, 2.0)) * exp(-u_pulse_age * 0.65);
    pos += normalize(pos - u_pulse_origin + vec2(0.0001)) * wave * 0.10;
    // Bright patches travel along the strands. Color shifts with the palette.
    float shimmer = pow(0.5 + 0.5 * sin(s * 21.0 - u_time * 0.8 + lane * 4.0), 4.0);
    float hue = lane * 0.55 + s * 0.27 + u_palette * 0.31;
    v_color = 0.55 + 0.45 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
    v_color = mix(v_color, vec3(0.72, 0.90, 1.0), shimmer * 0.35 + wave * 0.65);
    v_alpha = (0.11 + shimmer * 0.35 + wave * 0.5) * perspective;
    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = clamp((2.0 + shimmer * 2.3 + wave * 5.0) * perspective * min(u_resolution.y / 800.0, 2.0), 1.5, 12.0);
}
