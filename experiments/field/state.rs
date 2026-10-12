//! Values shared by the controls and the renderer. No browser or GPU code here.

use std::{cell::RefCell, rc::Rc};

// Each callback holds a clone of this handle, all pointing to the same State.
// RefCell lets one callback borrow and change it at a time.
pub type SharedState = Rc<RefCell<State>>;

pub struct State {
    // Canvas coordinates: left/bottom = -1, center = 0, right/top = 1.
    pub pointer: [f32; 2],
    pub pulse_origin: [f32; 2],
    // Seconds of animation, frozen while paused or hidden.
    pub time: f32,
    pub pulse_time: f32,
    pub palette: f32,
    pub paused: bool,
}

impl State {
    pub fn new(paused: bool) -> Self {
        Self {
            pointer: [0.0; 2],
            pulse_origin: [0.0; 2],
            time: 0.0,
            // Start far enough in the past that the shader shows no pulse.
            pulse_time: -100.0,
            palette: 0.0,
            paused,
        }
    }

    pub fn pulse(&mut self, origin: [f32; 2]) {
        self.pulse_origin = origin;
        self.pulse_time = self.time;
    }

    pub fn reset(&mut self) {
        // Keep the user's current play/pause choice.
        *self = Self::new(self.paused);
    }
}
