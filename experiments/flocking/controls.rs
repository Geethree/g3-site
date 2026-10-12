//! Sliders change settings immediately. Count rebuilds the starting flock.
use crate::{
    events::{element, listen},
    state::SharedState,
};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Document, Event, HtmlInputElement};

pub fn bind(document: &Document, state: &SharedState) -> Result<(), JsValue> {
    for id in ["count", "speed", "separation", "alignment", "cohesion"] {
        let input: HtmlInputElement = element(document, id)?.dyn_into()?;
        let slider = input.clone();
        let shared = state.clone();
        let page = document.clone();
        listen::<Event>(input.as_ref(), "input", move |_| {
            let value = slider.value_as_number() as f32;
            if !value.is_finite() {
                return;
            }
            let mut state = shared.borrow_mut();
            match id {
                "count" => {
                    state.settings.count =
                        ((value.clamp(50.0, 800.0) / 50.0).round() * 50.0) as usize;
                    let count = state.settings.count;
                    state.simulation.reset(count);
                    state.steps = 0;
                }
                "speed" => state.settings.speed = value.clamp(0.5, 2.0),
                "separation" => state.settings.separation = value.clamp(0.0, 3.0),
                "alignment" => state.settings.alignment = value.clamp(0.0, 3.0),
                "cohesion" => state.settings.cohesion = value.clamp(0.0, 3.0),
                _ => {}
            }
            state.dirty = true;
            drop(state);
            let _ = sync(&page, &shared);
        })?;
    }
    let shared = state.clone();
    let page = document.clone();
    listen::<Event>(element(document, "pause")?.as_ref(), "click", move |_| {
        let mut state = shared.borrow_mut();
        state.paused = !state.paused;
        state.clock_reset = true;
        state.dirty = true;
        drop(state);
        let _ = sync(&page, &shared);
    })?;
    let shared = state.clone();
    let page = document.clone();
    listen::<Event>(element(document, "reset")?.as_ref(), "click", move |_| {
        shared.borrow_mut().reset();
        let _ = sync(&page, &shared);
    })?;
    sync(document, state)
}
fn sync(document: &Document, shared: &SharedState) -> Result<(), JsValue> {
    let state = shared.borrow();
    let settings = state.settings;
    for (id, value) in [
        ("count", settings.count as f32),
        ("speed", settings.speed),
        ("separation", settings.separation),
        ("alignment", settings.alignment),
        ("cohesion", settings.cohesion),
    ] {
        let input: HtmlInputElement = element(document, id)?.dyn_into()?;
        input.set_value_as_number(value as f64);
        let text = if id == "count" {
            format!("{}", settings.count)
        } else if id == "speed" {
            format!("{value:.1}×")
        } else {
            format!("{value:.1}")
        };
        element(document, &format!("{id}-value"))?.set_text_content(Some(&text));
    }
    let pause = element(document, "pause")?;
    pause.set_text_content(Some(if state.paused { "Play" } else { "Pause" }));
    pause.set_attribute("aria-pressed", if state.paused { "true" } else { "false" })
}
