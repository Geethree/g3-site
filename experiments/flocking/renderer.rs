//! Upload Rust simulation state and draw instanced triangles with WebGPU.
use crate::state::State;
use experiment_gpu::{Gpu, wgpu};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

pub struct Renderer {
    gpu: Gpu,
    pipeline: wgpu::RenderPipeline,
    uniforms: wgpu::Buffer,
    bindings: wgpu::BindGroup,
    birds: wgpu::Buffer,
    capacity: usize,
    canvas: HtmlCanvasElement,
}
impl Renderer {
    pub async fn new(canvas: HtmlCanvasElement) -> Result<Self, JsValue> {
        let gpu = Gpu::new(canvas.clone()).await?;
        let uniforms = gpu.uniform_buffer(16);
        let layout = gpu.uniform_layout();
        let bindings = gpu.bind_uniforms(&layout, &uniforms);
        let pipeline = gpu
            .pipeline(
                include_str!("bird.wgsl"),
                &layout,
                &[wgpu::VertexBufferLayout {
                    array_stride: 16,
                    step_mode: wgpu::VertexStepMode::Instance,
                    attributes: &wgpu::vertex_attr_array![0 => Float32x4],
                }],
            )
            .await?;
        let capacity = 800;
        let birds = Self::bird_buffer(&gpu, capacity);
        Ok(Self {
            gpu,
            pipeline,
            uniforms,
            bindings,
            birds,
            capacity,
            canvas,
        })
    }

    fn bird_buffer(gpu: &Gpu, count: usize) -> wgpu::Buffer {
        gpu.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Bird instances"),
            size: (count.max(1) * 16) as u64,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        })
    }
    pub fn needs_resize(&self, ratio: f64) -> bool {
        self.gpu.needs_resize(ratio)
    }
    pub fn is_unavailable(&self) -> bool {
        self.gpu.is_unavailable()
    }

    pub fn draw(&mut self, state: &State, ratio: f64) -> bool {
        let count = state.simulation.birds.len();
        if count > self.capacity {
            self.capacity = count.next_power_of_two();
            self.birds = Self::bird_buffer(&self.gpu, self.capacity);
        }
        let birds: Vec<f32> = state
            .simulation
            .birds
            .iter()
            .flat_map(|bird| {
                [
                    bird.position.x,
                    bird.position.y,
                    bird.velocity.x,
                    bird.velocity.y,
                ]
            })
            .collect();
        if !birds.is_empty() {
            self.gpu.write_floats(&self.birds, &birds);
        }
        self.gpu.write_floats(
            &self.uniforms,
            &[
                state.simulation.width,
                1.0,
                1.0 / self.canvas.client_height().max(1) as f32,
                0.0,
            ],
        );
        self.gpu.draw(
            ratio,
            &self.pipeline,
            &self.bindings,
            Some(&self.birds),
            3,
            count as u32,
        )
    }
}
