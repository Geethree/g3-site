//! Generate the strands in a WebGPU shader and draw each glow as a quad.
use crate::state::State;
use experiment_gpu::{Gpu, wgpu};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

pub struct Renderer {
    gpu: Gpu,
    pipeline: wgpu::RenderPipeline,
    uniforms: wgpu::Buffer,
    bindings: wgpu::BindGroup,
}

impl Renderer {
    pub async fn new(canvas: HtmlCanvasElement) -> Result<Self, JsValue> {
        let gpu = Gpu::new(canvas).await?;
        let uniforms = gpu.uniform_buffer(48);
        let layout = gpu.uniform_layout();
        let bindings = gpu.bind_uniforms(&layout, &uniforms);
        let pipeline = gpu
            .pipeline(include_str!("field.wgsl"), &layout, &[])
            .await?;
        Ok(Self {
            gpu,
            pipeline,
            uniforms,
            bindings,
        })
    }

    pub fn is_unavailable(&self) -> bool {
        self.gpu.is_unavailable()
    }

    pub fn draw(&mut self, state: &State, ratio: f64) {
        let (width, height) = self.gpu.size(ratio);
        self.gpu.write_floats(
            &self.uniforms,
            &[
                width as f32,
                height as f32,
                state.pointer[0],
                state.pointer[1],
                state.pulse_origin[0],
                state.pulse_origin[1],
                state.time,
                state.time - state.pulse_time,
                state.palette,
                0.0,
                0.0,
                0.0,
            ],
        );
        self.gpu
            .draw(ratio, &self.pipeline, &self.bindings, None, 6, 96 * 420);
    }
}
