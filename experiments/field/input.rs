//! Connect browser events to State. Drawing happens in renderer.rs.

use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{
    Document, Element, Event, EventTarget, HtmlCanvasElement, KeyboardEvent, PointerEvent,
};

use crate::state::SharedState;

pub fn bind(
    document: &Document,
    canvas: &HtmlCanvasElement,
    state: &SharedState,
) -> Result<(), JsValue> {
    bind_pointer(canvas, state)?;
    bind_keyboard(canvas, state)?;
    bind_buttons(document, state)?;

    let status = element(document, "status")?;
    listen::<Event>(canvas.as_ref(), "webglcontextlost", move |event| {
        event.prevent_default();
        status.set_text_content(Some("Graphics context lost. Reload to restart."));
    })
}

fn bind_pointer(canvas: &HtmlCanvasElement, state: &SharedState) -> Result<(), JsValue> {
    let shared = state.clone();
    let surface = canvas.clone();
    listen::<PointerEvent>(canvas.as_ref(), "pointermove", move |event| {
        shared.borrow_mut().pointer = position(&surface, &event);
    })?;
    let shared = state.clone();
    let surface = canvas.clone();
    listen::<PointerEvent>(canvas.as_ref(), "pointerdown", move |event| {
        shared.borrow_mut().pulse(position(&surface, &event));
    })
}

fn position(canvas: &HtmlCanvasElement, event: &PointerEvent) -> [f32; 2] {
    // Convert screen pixels to shader coordinates. Screen Y runs down;
    // shader Y runs up, so flip it.
    let rect = canvas.get_bounding_client_rect();
    [
        ((event.client_x() as f64 - rect.left()) / rect.width() * 2.0 - 1.0) as f32,
        (1.0 - (event.client_y() as f64 - rect.top()) / rect.height() * 2.0) as f32,
    ]
}

fn bind_keyboard(canvas: &HtmlCanvasElement, state: &SharedState) -> Result<(), JsValue> {
    let shared = state.clone();
    listen::<KeyboardEvent>(canvas.as_ref(), "keydown", move |event| {
        let mut state = shared.borrow_mut();
        match event.key().as_str() {
            "Enter" => {
                let origin = state.pointer;
                state.pulse(origin);
            }
            "ArrowLeft" => state.pointer[0] -= 0.1,
            "ArrowRight" => state.pointer[0] += 0.1,
            "ArrowUp" => state.pointer[1] += 0.1,
            "ArrowDown" => state.pointer[1] -= 0.1,
            _ => return,
        }
        state.pointer[0] = state.pointer[0].clamp(-1.0, 1.0);
        state.pointer[1] = state.pointer[1].clamp(-1.0, 1.0);
        event.prevent_default();
    })
}

fn bind_buttons(document: &Document, state: &SharedState) -> Result<(), JsValue> {
    let pause = element(document, "pause")?;
    update_pause(&pause, state.borrow().paused)?;
    let shared = state.clone();
    let button = pause.clone();
    listen::<Event>(pause.as_ref(), "click", move |_| {
        let mut state = shared.borrow_mut();
        state.paused = !state.paused;
        let _ = update_pause(&button, state.paused);
    })?;

    let shared = state.clone();
    listen::<Event>(element(document, "color")?.as_ref(), "click", move |_| {
        shared.borrow_mut().palette += 1.0;
    })?;
    let shared = state.clone();
    listen::<Event>(element(document, "reset")?.as_ref(), "click", move |_| {
        shared.borrow_mut().reset();
    })
}

fn update_pause(button: &Element, paused: bool) -> Result<(), JsValue> {
    button.set_text_content(Some(if paused { "Play" } else { "Pause" }));
    button.set_attribute("aria-pressed", if paused { "true" } else { "false" })
}

fn element(document: &Document, id: &str) -> Result<Element, JsValue> {
    document
        .get_element_by_id(id)
        .ok_or_else(|| format!("Missing element: {id}").into())
}

fn listen<E: JsCast + 'static>(
    target: &EventTarget,
    name: &str,
    mut action: impl FnMut(E) + 'static,
) -> Result<(), JsValue> {
    // JS calls this Rust closure later. Convert its Event to the type expected
    // by the handler (PointerEvent, KeyboardEvent, or plain Event).
    let callback = Closure::<dyn FnMut(Event)>::new(move |event: Event| {
        if let Ok(event) = event.dyn_into::<E>() {
            action(event);
        }
    });
    target.add_event_listener_with_callback(name, callback.as_ref().unchecked_ref())?;
    // Keep the callback alive for this page. Dropping it here would leave JS
    // with a function it can no longer call. Navigation frees the page.
    callback.forget();
    Ok(())
}
