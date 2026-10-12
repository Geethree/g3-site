//! Browser WebGPU setup shared by the experiments. No WebGL backend is compiled.
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use wasm_bindgen::prelude::*;
use web_sys::{Element, HtmlCanvasElement};

pub use wgpu;

pub struct Gpu {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    canvas: HtmlCanvasElement,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    status: Element,
    failed: Arc<AtomicBool>,
    // Keep initialization handles alive with the surface and device.
    _adapter: wgpu::Adapter,
    _instance: wgpu::Instance,
}

impl Gpu {
    pub async fn new(canvas: HtmlCanvasElement) -> Result<Self, JsValue> {
        let document = canvas.owner_document().ok_or("Document unavailable")?;
        let status = document
            .get_element_by_id("status")
            .ok_or("Status missing")?;
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU,
            ..Default::default()
        });
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        let adapter = instance.request_adapter(&wgpu::RequestAdapterOptions {
            compatible_surface: Some(&surface),
            ..Default::default()
        }).await.map_err(|_| JsValue::from_str("WebGPU is unavailable. Use a browser and device with WebGPU support over HTTPS or localhost."))?;
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("Experiment device"),
                ..Default::default()
            })
            .await
            .map_err(|error| JsValue::from_str(&format!("Unable to initialize WebGPU: {error}")))?;
        let failed = Arc::new(AtomicBool::new(false));
        let lost = failed.clone();
        device.set_device_lost_callback(move |_, _| {
            lost.store(true, Ordering::Relaxed);
            report_status("Graphics device lost. Reload to restart.");
        });
        let failed_validation = failed.clone();
        device.on_uncaptured_error(Arc::new(move |error| {
            failed_validation.store(true, Ordering::Relaxed);
            report_status(&format!("Graphics error: {error}. Reload to restart."));
        }));
        let config = surface
            .get_default_config(&adapter, 1, 1)
            .ok_or("WebGPU canvas configuration unavailable")?;
        Ok(Self {
            device,
            queue,
            canvas,
            surface,
            config,
            status,
            failed,
            _adapter: adapter,
            _instance: instance,
        })
    }

    pub fn is_unavailable(&self) -> bool {
        self.failed.load(Ordering::Relaxed)
    }

    pub fn size(&self, ratio: f64) -> (u32, u32) {
        let limit = self.device.limits().max_texture_dimension_2d;
        let ratio = ratio.min(2.0);
        (
            ((self.canvas.client_width() as f64 * ratio).max(1.0) as u32).min(limit),
            ((self.canvas.client_height() as f64 * ratio).max(1.0) as u32).min(limit),
        )
    }

    pub fn needs_resize(&self, ratio: f64) -> bool {
        self.size(ratio) != (self.canvas.width(), self.canvas.height())
    }

    pub fn uniform_buffer(&self, size: u64) -> wgpu::Buffer {
        self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Frame uniforms"),
            size,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        })
    }

    pub fn uniform_layout(&self) -> wgpu::BindGroupLayout {
        self.device
            .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Frame uniforms"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            })
    }

    pub fn bind_uniforms(
        &self,
        layout: &wgpu::BindGroupLayout,
        buffer: &wgpu::Buffer,
    ) -> wgpu::BindGroup {
        self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Frame uniforms"),
            layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: buffer.as_entire_binding(),
            }],
        })
    }

    pub async fn pipeline(
        &self,
        source: &'static str,
        uniforms: &wgpu::BindGroupLayout,
        buffers: &[wgpu::VertexBufferLayout<'_>],
    ) -> Result<wgpu::RenderPipeline, JsValue> {
        self.device.push_error_scope(wgpu::ErrorFilter::Validation);
        let shader = self
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("Experiment shader"),
                source: wgpu::ShaderSource::Wgsl(source.into()),
            });
        let layout = self
            .device
            .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("Experiment pipeline"),
                bind_group_layouts: &[uniforms],
                push_constant_ranges: &[],
            });
        let pipeline = self
            .device
            .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("Experiment pipeline"),
                layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &shader,
                    entry_point: Some("vertex"),
                    buffers,
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &shader,
                    entry_point: Some("fragment"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: self.config.format,
                        blend: Some(wgpu::BlendState {
                            color: wgpu::BlendComponent {
                                src_factor: wgpu::BlendFactor::SrcAlpha,
                                dst_factor: wgpu::BlendFactor::One,
                                operation: wgpu::BlendOperation::Add,
                            },
                            alpha: wgpu::BlendComponent {
                                src_factor: wgpu::BlendFactor::SrcAlpha,
                                dst_factor: wgpu::BlendFactor::One,
                                operation: wgpu::BlendOperation::Add,
                            },
                        }),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: Default::default(),
                }),
                primitive: Default::default(),
                depth_stencil: None,
                multisample: Default::default(),
                multiview: None,
                cache: None,
            });
        if let Some(error) = self.device.pop_error_scope().await {
            return Err(JsValue::from_str(&format!(
                "WebGPU shader initialization failed: {error}"
            )));
        }
        Ok(pipeline)
    }

    /// Uniforms and bird records contain only f32 values, packed in little-endian order.
    pub fn write_floats(&self, buffer: &wgpu::Buffer, values: &[f32]) {
        let bytes: Vec<u8> = values
            .iter()
            .flat_map(|value| value.to_le_bytes())
            .collect();
        self.queue.write_buffer(buffer, 0, &bytes);
    }

    pub fn draw(
        &mut self,
        ratio: f64,
        pipeline: &wgpu::RenderPipeline,
        uniforms: &wgpu::BindGroup,
        vertex_buffer: Option<&wgpu::Buffer>,
        vertices: u32,
        instances: u32,
    ) -> bool {
        if self.is_unavailable() {
            return false;
        }
        let (width, height) = self.size(ratio);
        if self.config.width != width || self.config.height != height || self.needs_resize(ratio) {
            self.canvas.set_width(width);
            self.canvas.set_height(height);
            self.config.width = width;
            self.config.height = height;
            self.surface.configure(&self.device, &self.config);
        }
        let frame = match self.surface.get_current_texture() {
            Ok(frame) => frame,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                self.surface.configure(&self.device, &self.config);
                return false;
            }
            Err(wgpu::SurfaceError::Timeout) => return false,
            Err(error) => {
                self.failed.store(true, Ordering::Relaxed);
                self.status.set_text_content(Some(&format!(
                    "Graphics error: {error}. Reload to restart."
                )));
                return false;
            }
        };
        let view = frame.texture.create_view(&Default::default());
        let mut encoder = self.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Experiment frame"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.012,
                            g: 0.018,
                            b: 0.035,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_pipeline(pipeline);
            pass.set_bind_group(0, uniforms, &[]);
            if let Some(buffer) = vertex_buffer {
                pass.set_vertex_buffer(0, buffer.slice(..));
            }
            pass.draw(0..vertices, 0..instances);
        }
        self.queue.submit([encoder.finish()]);
        frame.present();
        true
    }
}

// The wgpu device-loss callback requires Send. Look up the DOM on invocation
// instead of capturing a browser handle in that callback.
fn report_status(message: &str) {
    if let Some(status) = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.get_element_by_id("status"))
    {
        status.set_text_content(Some(message));
    }
}
