//! Update at 60 steps per second, independent of the screen's frame rate.
use crate::{renderer::Renderer, simulation::STEP, state::SharedState};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Document, HtmlCanvasElement, Window};
type Frame = Rc<RefCell<Option<Closure<dyn FnMut(f64)>>>>;

pub fn start(
    window: Window,
    document: Document,
    canvas: HtmlCanvasElement,
    renderer: Renderer,
    state: SharedState,
) -> Result<(), JsValue> {
    let frame: Frame = Rc::new(RefCell::new(None));
    let next = frame.clone();
    let browser = window.clone();
    let mut last_frame = 0.0;
    let mut elapsed = 0.0;
    *frame.borrow_mut() = Some(Closure::new(move |timestamp: f64| {
        let mut delta = ((timestamp - last_frame) / 1000.0).max(0.0) as f32;
        last_frame = timestamp;
        let mut state = state.borrow_mut();
        if state.clock_reset {
            delta = 0.0;
            elapsed = 0.0;
            state.clock_reset = false;
        }
        if document.hidden() || renderer.is_context_lost() {
            elapsed = 0.0;
        } else {
            let width = canvas.client_width() as f32 / canvas.client_height().max(1) as f32;
            if (width - state.simulation.width).abs() > 0.0001 {
                let scale = width / state.simulation.width;
                state.pointer.position.x *= scale;
                state.simulation.resize(width);
                state.dirty = true;
            }
            if state.paused {
                elapsed = 0.0;
            } else {
                // Drop excess time rather than catching up after a slow frame.
                elapsed = (elapsed + delta).min(STEP * 5.0);
                for _ in 0..5 {
                    if elapsed < STEP {
                        break;
                    }
                    let settings = state.settings;
                    let pointer = state.pointer;
                    state.simulation.step(settings, pointer);
                    elapsed -= STEP;
                    state.steps += 1;
                    state.dirty = true;
                }
            }
            if state.dirty || renderer.needs_resize(browser.device_pixel_ratio()) {
                renderer.draw(&state, browser.device_pixel_ratio());
                state.dirty = false;
                let mode = if !state.pointer.active {
                    "inactive"
                } else if state.pointer.attracting {
                    "attract"
                } else {
                    "repel"
                };
                let _ = canvas.set_attribute("data-pointer", mode);
                let _ =
                    canvas.set_attribute("data-count", &state.simulation.birds.len().to_string());
                let _ = canvas.set_attribute("data-steps", &state.steps.to_string());
            }
        }
        drop(state);
        let _ = browser
            .request_animation_frame(next.borrow().as_ref().unwrap().as_ref().unchecked_ref());
    }));
    // One callback holds itself alive for this page; no new closures per frame.
    window.request_animation_frame(frame.borrow().as_ref().unwrap().as_ref().unchecked_ref())?;
    Ok(())
}
