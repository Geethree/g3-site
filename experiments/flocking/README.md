# Flocking

Rust moves the birds. WebGL draws a triangle for each one.

| File | Job |
| --- | --- |
| `lib.rs` | Start the page. |
| `simulation.rs` | Separation, alignment, cohesion, and pointer forces. |
| `math.rs`, `grid.rs` | Vectors, wrapped edges, and nearby bird lookup. |
| `state.rs` | Shared settings and flock. |
| `input.rs`, `controls.rs`, `events.rs` | Pointer, keyboard, and sliders. |
| `animation.rs` | Run 60 simulation steps per second. |
| `renderer.rs` | Upload birds and draw them in one call. |
| `bird.vert`, `bird.frag` | Rotate each triangle and soften its edges. |
| `tests.rs` | Check the rules without a browser. |

Each step reads the old flock before replacing it. Reset uses a fixed seed.
Pause freezes movement. Hidden tabs stop updating; reduced motion starts paused.

Run `bazel run //:serve -- --port 1320`, then open `/experiments/flocking/`.
Move to repel, hold to attract. Arrow keys move the pointer; Enter toggles attraction.
