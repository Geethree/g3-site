//! Ask the browser for each frame, advance time, then draw.

use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Document, Window};

use crate::{renderer::Renderer, state::SharedState};

// The callback needs a handle to itself to request the next frame.
type Frame = Rc<RefCell<Option<Closure<dyn FnMut(f64)>>>>;

pub fn start(
    window: Window,
    document: Document,
    mut renderer: Renderer,
    state: SharedState,
) -> Result<(), JsValue> {
    let frame: Frame = Rc::new(RefCell::new(None));
    let next = frame.clone();
    let mut last_frame = 0.0;
    let browser = window.clone();

    *frame.borrow_mut() = Some(Closure::new(move |timestamp: f64| {
        // Browser timestamps are milliseconds. Cap the step at 50 ms so
        // returning from an inactive tab doesn't jump the animation forward.
        let delta = ((timestamp - last_frame) / 1000.0).clamp(0.0, 0.05) as f32;
        last_frame = timestamp;
        if !document.hidden() && !renderer.is_unavailable() {
            let mut state = state.borrow_mut();
            if !state.paused {
                state.time += delta;
            }
            // Still draw while paused so pointer and color changes are visible.
            renderer.draw(&state, browser.device_pixel_ratio());
        }
        let _ = browser
            .request_animation_frame(next.borrow().as_ref().unwrap().as_ref().unchecked_ref());
    }));

    // This page has one loop. Its callback keeps itself alive until navigation
    // destroys the page; it doesn't create a new callback on every frame.
    window.request_animation_frame(frame.borrow().as_ref().unwrap().as_ref().unchecked_ref())?;
    Ok(())
}
