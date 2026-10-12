//! Start the canvas, controls, and frame loop. The WASM loader calls this once.
mod animation;
mod controls;
mod events;
mod input;
mod renderer;
mod simulation;
mod state;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::HtmlCanvasElement;

#[wasm_bindgen]
pub async fn start() -> Result<(), JsValue> {
    let window = web_sys::window().ok_or("Window unavailable")?;
    let document = window.document().ok_or("Document unavailable")?;
    let canvas: HtmlCanvasElement = document
        .get_element_by_id("flock")
        .ok_or("Canvas missing")?
        .dyn_into()?;
    let renderer = renderer::Renderer::new(canvas.clone()).await?;
    let reduced = window.match_media("(prefers-reduced-motion: reduce)")?;
    let width = canvas.client_width() as f32 / canvas.client_height().max(1) as f32;
    let state = Rc::new(RefCell::new(state::State::new(
        width,
        reduced.is_some_and(|m| m.matches()),
    )));
    input::bind(&document, &canvas, &state)?;
    animation::start(window, document.clone(), canvas.clone(), renderer, state)?;
    canvas.set_attribute("data-ready", "true")?;
    document
        .get_element_by_id("status")
        .ok_or("Status missing")?
        .set_text_content(None);
    Ok(())
}
