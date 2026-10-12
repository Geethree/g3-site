//! Upload bird positions and velocities, then draw all triangles in one call.
use crate::state::State;
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{
    HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlBuffer, WebGlProgram, WebGlShader,
};

pub struct Renderer {
    canvas: HtmlCanvasElement,
    gl: Gl,
    program: WebGlProgram,
    buffer: WebGlBuffer,
}
impl Renderer {
    pub fn new(canvas: HtmlCanvasElement) -> Result<Self, JsValue> {
        let gl: Gl = canvas
            .get_context("webgl2")?
            .ok_or("WebGL2 is unavailable in this browser")?
            .dyn_into()?;
        let program = gl.create_program().ok_or("Could not create program")?;
        gl.attach_shader(
            &program,
            &shader(&gl, Gl::VERTEX_SHADER, include_str!("bird.vert"))?,
        );
        gl.attach_shader(
            &program,
            &shader(&gl, Gl::FRAGMENT_SHADER, include_str!("bird.frag"))?,
        );
        gl.link_program(&program);
        if gl
            .get_program_parameter(&program, Gl::LINK_STATUS)
            .as_bool()
            != Some(true)
        {
            return Err(gl.get_program_info_log(&program).unwrap_or_default().into());
        }
        gl.use_program(Some(&program));
        let buffer = gl.create_buffer().ok_or("Could not create bird buffer")?;
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&buffer));
        // Each instance gets four floats: position XY and velocity XY.
        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 4, Gl::FLOAT, false, 16, 0);
        gl.vertex_attrib_divisor(0, 1);
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::SRC_ALPHA, Gl::ONE);
        Ok(Self {
            canvas,
            gl,
            program,
            buffer,
        })
    }
    fn size(&self, ratio: f64) -> (u32, u32) {
        let ratio = ratio.min(2.0);
        (
            (self.canvas.client_width() as f64 * ratio).max(1.0) as u32,
            (self.canvas.client_height() as f64 * ratio).max(1.0) as u32,
        )
    }
    pub fn needs_resize(&self, ratio: f64) -> bool {
        self.size(ratio) != (self.canvas.width(), self.canvas.height())
    }
    pub fn is_context_lost(&self) -> bool {
        self.gl.is_context_lost()
    }
    pub fn draw(&self, state: &State, ratio: f64) {
        let (width, height) = self.size(ratio);
        if self.needs_resize(ratio) {
            self.canvas.set_width(width);
            self.canvas.set_height(height);
        }
        let gl = &self.gl;
        gl.viewport(0, 0, width as i32, height as i32);
        gl.clear_color(0.012, 0.018, 0.035, 1.0);
        gl.clear(Gl::COLOR_BUFFER_BIT);
        let birds: Vec<f32> = state
            .simulation
            .birds
            .iter()
            .flat_map(|b| [b.position.x, b.position.y, b.velocity.x, b.velocity.y])
            .collect();
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&self.buffer));
        gl.buffer_data_with_array_buffer_view(
            Gl::ARRAY_BUFFER,
            &js_sys::Float32Array::from(birds.as_slice()),
            Gl::DYNAMIC_DRAW,
        );
        gl.uniform2f(
            gl.get_uniform_location(&self.program, "u_world").as_ref(),
            state.simulation.width,
            1.0,
        );
        gl.uniform1f(
            gl.get_uniform_location(&self.program, "u_pixel").as_ref(),
            1.0 / self.canvas.client_height().max(1) as f32,
        );
        gl.draw_arrays_instanced(Gl::TRIANGLES, 0, 3, state.simulation.birds.len() as i32);
    }
}
fn shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let shader = gl.create_shader(kind).ok_or("Could not create shader")?;
    gl.shader_source(&shader, source);
    gl.compile_shader(&shader);
    if gl
        .get_shader_parameter(&shader, Gl::COMPILE_STATUS)
        .as_bool()
        != Some(true)
    {
        return Err(gl.get_shader_info_log(&shader).unwrap_or_default().into());
    }
    Ok(shader)
}
