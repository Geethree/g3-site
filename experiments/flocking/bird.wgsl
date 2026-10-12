struct Uniforms {
    world: vec2f,
    pixel: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
struct Vertex {
    @builtin(position) position: vec4f,
    @location(0) corner: vec3f,
    @location(1) color: vec3f,
};
@vertex fn vertex(@location(0) bird: vec4f,
    @builtin(vertex_index) vertex_id: u32, @builtin(instance_index) bird_id: u32) -> Vertex {
    let corners = array<vec2f, 3>(vec2f(1.0, 0.0), vec2f(-0.7, 0.55), vec2f(-0.7, -0.55));
    let edges = array<vec3f, 3>(vec3f(1, 0, 0), vec3f(0, 1, 0), vec3f(0, 0, 1));
    var direction = vec2f(1.0, 0.0);
    if length(bird.zw) > 0.00001 { direction = normalize(bird.zw); }
    let side = vec2f(-direction.y, direction.x);
    let corner = corners[vertex_id];
    let position = bird.xy + (direction * corner.x + side * corner.y) * (9.0 * u.pixel);
    let shade = 0.5 + 0.5 * sin(f32(bird_id) * 0.37);
    let color = mix(vec3f(0.22, 0.78, 0.92), vec3f(0.85, 0.98, 0.70), shade);
    return Vertex(vec4f(position / u.world * 2.0 - 1.0, 0.0, 1.0), edges[vertex_id], color);
}
@fragment fn fragment(bird: Vertex) -> @location(0) vec4f {
    let edge = min(bird.corner.x, min(bird.corner.y, bird.corner.z));
    let glow = smoothstep(0.0, 0.16, edge);
    return vec4f(bird.color, 0.75 * glow);
}
