//! Shared values for input, animation, and drawing.
use crate::simulation::{Pointer, Settings, Simulation};
use std::{cell::RefCell, rc::Rc};

pub type SharedState = Rc<RefCell<State>>;
pub struct State {
    pub simulation: Simulation,
    pub settings: Settings,
    pub pointer: Pointer,
    pub paused: bool,
    pub dirty: bool,
    pub clock_reset: bool,
    pub steps: u64,
}
impl State {
    pub fn new(width: f32, paused: bool) -> Self {
        Self {
            simulation: Simulation::new(300, width),
            settings: Settings::default(),
            pointer: Pointer::default(),
            paused,
            dirty: true,
            clock_reset: true,
            steps: 0,
        }
    }
    pub fn reset(&mut self) {
        self.settings = Settings::default();
        self.simulation.reset(self.settings.count);
        self.pointer = Pointer::default();
        self.steps = 0;
        self.clock_reset = true;
        self.dirty = true;
    }
}
