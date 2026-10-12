#version 300 es
precision highp float;
layout(location = 0) in vec4 a_bird;
uniform vec2 u_world;
uniform float u_pixel;
out vec3 v_corner;
out vec3 v_color;
void main() {
    // The same three corners are used for every bird, rotated to its velocity.
    vec2 corners[3] = vec2[3](vec2(1.0, 0.0), vec2(-0.7, 0.55), vec2(-0.7, -0.55));
    vec3 edges[3] = vec3[3](vec3(1,0,0), vec3(0,1,0), vec3(0,0,1));
    vec2 direction = length(a_bird.zw) > 0.00001 ? normalize(a_bird.zw) : vec2(1.0, 0.0);
    vec2 side = vec2(-direction.y, direction.x);
    vec2 corner = corners[gl_VertexID];
    vec2 position = a_bird.xy + (direction * corner.x + side * corner.y) * (9.0 * u_pixel);
    gl_Position = vec4(position / u_world * 2.0 - 1.0, 0.0, 1.0);
    v_corner = edges[gl_VertexID];
    float shade = 0.5 + 0.5 * sin(float(gl_InstanceID) * 0.37);
    v_color = mix(vec3(0.22, 0.78, 0.92), vec3(0.85, 0.98, 0.70), shade);
}
