//! Pointer and keyboard input use the same world coordinates as the birds.
use crate::{
    controls,
    events::{element, listen},
    simulation::math::Vec2,
    state::SharedState,
};
use wasm_bindgen::prelude::*;
use web_sys::{Document, Event, HtmlCanvasElement, KeyboardEvent, PointerEvent};

pub fn bind(
    document: &Document,
    canvas: &HtmlCanvasElement,
    state: &SharedState,
) -> Result<(), JsValue> {
    controls::bind(document, state)?;
    for name in [
        "pointermove",
        "pointerdown",
        "pointerup",
        "pointercancel",
        "pointerleave",
        "lostpointercapture",
    ] {
        let shared = state.clone();
        let surface = canvas.clone();
        listen::<PointerEvent>(canvas.as_ref(), name, move |event| {
            let mut state = shared.borrow_mut();
            let rect = surface.get_bounding_client_rect();
            state.pointer.position = Vec2::new(
                ((event.client_x() as f64 - rect.left()) / rect.width()) as f32
                    * state.simulation.width,
                (1.0 - (event.client_y() as f64 - rect.top()) / rect.height()) as f32,
            );
            match name {
                "pointerdown" => {
                    state.pointer.active = true;
                    state.pointer.attracting = true;
                    let _ = surface.set_pointer_capture(event.pointer_id());
                    let _ = surface.focus();
                    event.prevent_default();
                }
                "pointerup" | "pointercancel" | "lostpointercapture" => {
                    state.pointer.attracting = false;
                    state.pointer.active = event.pointer_type() == "mouse"
                        && name != "pointercancel"
                        && name != "lostpointercapture";
                }
                "pointerleave" => {
                    if !state.pointer.attracting {
                        state.pointer.active = false;
                    }
                }
                _ => {
                    state.pointer.active = true;
                }
            }
            state.dirty = true;
        })?;
    }
    let shared = state.clone();
    listen::<KeyboardEvent>(canvas.as_ref(), "keydown", move |event| {
        let mut state = shared.borrow_mut();
        if !["Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]
            .contains(&event.key().as_str())
        {
            return;
        }
        if !state.pointer.active {
            state.pointer.position = Vec2::new(state.simulation.width * 0.5, 0.5);
        }
        match event.key().as_str() {
            "Enter" => {
                if !event.repeat() {
                    state.pointer.attracting = !state.pointer.attracting;
                }
            }
            "ArrowLeft" => state.pointer.position.x -= 0.03,
            "ArrowRight" => state.pointer.position.x += 0.03,
            "ArrowUp" => state.pointer.position.y += 0.03,
            _ => state.pointer.position.y -= 0.03,
        }
        state.pointer.position = state.pointer.position.wrapped(state.simulation.width);
        state.pointer.active = true;
        state.dirty = true;
        event.prevent_default();
    })?;
    let shared = state.clone();
    listen::<Event>(canvas.as_ref(), "blur", move |_| {
        let mut state = shared.borrow_mut();
        state.pointer.active = false;
        state.pointer.attracting = false;
        state.dirty = true;
    })?;
    let shared = state.clone();
    let page = document.clone();
    listen::<Event>(document.as_ref(), "visibilitychange", move |_| {
        shared.borrow_mut().clock_reset = true;
        if page.hidden() {
            let mut state = shared.borrow_mut();
            state.pointer.active = false;
            state.pointer.attracting = false;
        }
    })?;
    let status = element(document, "status")?;
    listen::<Event>(canvas.as_ref(), "webglcontextlost", move |event| {
        event.prevent_default();
        status.set_text_content(Some("Graphics context lost. Reload to restart."));
    })
}
