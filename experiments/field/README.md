# Field

Rust controls a WebGL2 canvas. The GPU draws the glowing strands.

| File | Job |
| --- | --- |
| `lib.rs` | Start everything. |
| `state.rs` | Store time, pointer, color, pulse, and pause. |
| `input.rs` | Handle pointer, keyboard, and buttons. |
| `animation.rs` | Advance time and request the next frame. |
| `renderer.rs` | Send state to WebGL and draw. |
| `field.vert` | Calculate each point's position, size, and color. |
| `field.frag` | Make each point a soft, round glow. |

The Astro page loads the WASM using generated `wasm-bindgen` JavaScript.
Input changes state. Each frame, Rust sends that state to the shaders.
The GPU calculates 96 strands of 420 points; no particle array is stored.

Change the shape and motion in `field.vert`, or the glow in `field.frag`.

```sh
bazel run //:serve -- --port 1320
```

Open http://127.0.0.1:1320/play/. WebGL2 is required.
