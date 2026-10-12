//! Set up WebGL2 and send the current state to the shaders on each draw.
//! The GPU computes the point positions; Rust doesn't store a particle array.

use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlProgram, WebGlShader};

use crate::state::State;

pub struct Renderer {
    canvas: HtmlCanvasElement,
    gl: Gl,
    program: WebGlProgram,
}

impl Renderer {
    pub fn new(canvas: HtmlCanvasElement) -> Result<Self, JsValue> {
        let gl: Gl = canvas
            .get_context("webgl2")?
            .ok_or("WebGL2 is unavailable in this browser")?
            .dyn_into()?;
        let program = gl.create_program().ok_or("Could not create program")?;
        // include_str! puts the shader source inside the WASM at build time.
        gl.attach_shader(
            &program,
            &compile_shader(&gl, Gl::VERTEX_SHADER, include_str!("field.vert"))?,
        );
        gl.attach_shader(
            &program,
            &compile_shader(&gl, Gl::FRAGMENT_SHADER, include_str!("field.frag"))?,
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
        // Add overlapping points' light together instead of covering them up.
        gl.enable(Gl::BLEND);
        gl.blend_func(Gl::SRC_ALPHA, Gl::ONE);
        Ok(Self {
            canvas,
            gl,
            program,
        })
    }

    pub fn is_context_lost(&self) -> bool {
        self.gl.is_context_lost()
    }

    pub fn draw(&self, state: &State, device_pixel_ratio: f64) {
        // CSS sets the display size. Match the pixel size for sharp rendering,
        // but cap it at 2x to limit work on high-resolution screens.
        let scale = device_pixel_ratio.min(2.0);
        let width = (self.canvas.client_width() as f64 * scale).max(1.0) as u32;
        let height = (self.canvas.client_height() as f64 * scale).max(1.0) as u32;
        if self.canvas.width() != width || self.canvas.height() != height {
            self.canvas.set_width(width);
            self.canvas.set_height(height);
        }
        let gl = &self.gl;
        gl.viewport(0, 0, width as i32, height as i32);
        gl.clear_color(0.012, 0.018, 0.035, 1.0);
        gl.clear(Gl::COLOR_BUFFER_BIT);

        // Uniforms are values shared by all points in this draw.
        self.set_pair("u_resolution", [width as f32, height as f32]);
        self.set_pair("u_pointer", state.pointer);
        self.set_pair("u_pulse_origin", state.pulse_origin);
        self.set_number("u_time", state.time);
        self.set_number("u_pulse_age", state.time - state.pulse_time);
        self.set_number("u_palette", state.palette);
        // 96 strands, 420 points each. These counts must match field.vert.
        gl.draw_arrays(Gl::POINTS, 0, 96 * 420);
    }

    fn set_number(&self, name: &str, value: f32) {
        let location = self.gl.get_uniform_location(&self.program, name);
        self.gl.uniform1f(location.as_ref(), value);
    }

    fn set_pair(&self, name: &str, value: [f32; 2]) {
        let location = self.gl.get_uniform_location(&self.program, name);
        self.gl.uniform2f(location.as_ref(), value[0], value[1]);
    }
}

fn compile_shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, JsValue> {
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
