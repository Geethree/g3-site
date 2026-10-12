struct Uniforms {
    resolution: vec2f,
    pointer: vec2f,
    pulse_origin: vec2f,
    time: f32,
    pulse_age: f32,
    palette: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
struct Vertex {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
    @location(1) alpha: f32,
    @location(2) uv: vec2f,
};

// Each point is a six-vertex quad. WebGPU has no programmable point size.
@vertex fn vertex(@builtin(vertex_index) corner: u32, @builtin(instance_index) point: u32) -> Vertex {
    let corners = array<vec2f, 6>(vec2f(0, 0), vec2f(1, 0), vec2f(0, 1),
        vec2f(0, 1), vec2f(1, 0), vec2f(1, 1));
    let uv = corners[corner];
    let strand = f32(point / 420u);
    let s = f32(point % 420u) / 419.0;
    let lane = strand / 95.0;
    let z = lane * 6.2831853 + s * 5.0 + u.time * 0.16;
    var p = vec3f((s - 0.5) * 3.7,
        sin(z) * (0.28 + 0.46 * sin(s * 3.14159)) + (lane - 0.5) * 0.38,
        cos(z) * 0.75);
    p.y += 0.10 * sin(s * 15.0 + lane * 7.0 - u.time * 0.6);
    let perspective = 2.6 / (2.6 + p.z);
    var pos = p.xy * perspective;
    let aspect = u.resolution.x / u.resolution.y;
    pos.x /= max(aspect, 0.85);
    let delta = pos - u.pointer;
    let attraction = exp(-dot(delta, delta) * 3.8);
    pos += delta * attraction * 0.30;
    pos.y += attraction * sin(u.time * 1.5 + s * 8.0) * 0.045;
    let radius = length(pos - u.pulse_origin);
    let wave_distance = (radius - u.pulse_age * 0.65) * 13.0;
    let wave = exp(-wave_distance * wave_distance) * exp(-u.pulse_age * 0.65);
    pos += normalize(pos - u.pulse_origin + vec2f(0.0001)) * wave * 0.10;
    let shimmer = pow(0.5 + 0.5 * sin(s * 21.0 - u.time * 0.8 + lane * 4.0), 4.0);
    let hue = lane * 0.55 + s * 0.27 + u.palette * 0.31;
    var color = 0.55 + 0.45 * cos(6.28318 * (hue + vec3f(0.0, 0.33, 0.67)));
    color = mix(color, vec3f(0.72, 0.90, 1.0), shimmer * 0.35 + wave * 0.65);
    let alpha = (0.11 + shimmer * 0.35 + wave * 0.5) * perspective;
    let size = clamp((2.0 + shimmer * 2.3 + wave * 5.0) * perspective * min(u.resolution.y / 800.0, 2.0), 1.5, 12.0);
    let offset = (uv - 0.5) * size * 2.0 / u.resolution;
    return Vertex(vec4f(pos + offset, 0.0, 1.0), color, alpha, uv);
}

@fragment fn fragment(point: Vertex) -> @location(0) vec4f {
    let r = length(point.uv - 0.5) * 2.0;
    if r > 1.0 { discard; }
    let glow = exp(-r * r * 4.5) * (1.0 - smoothstep(0.7, 1.0, r));
    return vec4f(point.color, glow * point.alpha);
}
