# Field

Rust controls a WebGPU canvas. The GPU draws the glowing strands.

| File | Job |
| --- | --- |
| `lib.rs` | Start everything. |
| `state.rs` | Store time, pointer, color, pulse, and pause. |
| `input.rs` | Handle pointer, keyboard, and buttons. |
| `animation.rs` | Advance time and request the next frame. |
| `renderer.rs` | Send state to WebGPU and draw instanced quads. |
| `field.wgsl` | Calculate point positions, sizes, colors, and round glow. |

The Astro page loads the WASM using generated `wasm-bindgen` JavaScript.
Input changes state. Each frame, Rust sends that state to the shaders.
The GPU calculates 96 strands of 420 points; no particle array is stored.

Change the shape, motion, and glow in `field.wgsl`.
Each point is a quad; its fragment shader produces a soft circular glow.
Shared browser GPU setup lives in `../gpu`.

```sh
bazel run //:serve -- --port 1320
```

Open http://127.0.0.1:1320/play/. WebGPU is required (HTTPS or localhost). There is no WebGL fallback.
