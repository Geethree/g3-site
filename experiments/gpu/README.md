# Shared WebGPU support

`experiment-gpu` is a Cargo path dependency of Field and Flocking. Bazel's
`rules_rs` crate hubs generate its Rust targets from the same manifest and sources.

The crate owns browser adapter/device initialization, canvas sizing, uniform
uploads, additive render pipelines, frame submission, and graphics errors.
`wgpu` is compiled with the browser WebGPU backend only; there is no WebGL fallback.
Shaders use WGSL. No GPU compute simulation is performed here.

Initialization is asynchronous. The Astro loader initializes WASM and then awaits
its exported `start()` function. The experiment sets `data-ready` only after its
pipeline is valid and its controls and frame loop are connected.

A browser/device with WebGPU support and a secure context (HTTPS or localhost)
is required. Initialization failures appear in the existing status element.
Device loss or uncaptured GPU errors stop rendering and display a reload message.

Canvas resolution follows CSS size with device pixel ratio capped at 2, bounded
by the device's maximum texture dimension. Surface loss/outdated frames retry;
timeouts skip a frame. Flocking keeps a failed frame dirty so paused scenes retry.
