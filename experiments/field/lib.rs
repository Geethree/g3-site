//! Entry point for the field. The page's WASM loader calls `start` once.
//! Input changes shared state; the animation loop passes it to the renderer.

mod animation;
mod input;
mod renderer;
mod state;

use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::HtmlCanvasElement;

#[wasm_bindgen]
pub async fn start() -> Result<(), JsValue> {
    let window = web_sys::window().ok_or("Window unavailable")?;
    let document = window.document().ok_or("Document unavailable")?;
    let canvas: HtmlCanvasElement = document
        .get_element_by_id("field")
        .ok_or("Canvas missing")?
        .dyn_into()?;
    let renderer = renderer::Renderer::new(canvas.clone()).await?;
    let reduced = window.match_media("(prefers-reduced-motion: reduce)")?;
    let state = Rc::new(RefCell::new(state::State::new(
        reduced.as_ref().is_some_and(|m| m.matches()),
    )));

    input::bind(&document, &canvas, &state)?;
    animation::start(window, document.clone(), renderer, state)?;

    canvas.set_attribute("data-ready", "true")?;
    document
        .get_element_by_id("status")
        .ok_or("Status missing")?
        .set_text_content(None);
    Ok(())
}
