//! Flocking rules. No browser or graphics API code; positions use a world of height 1.
#[path = "grid.rs"]
mod grid;
#[path = "math.rs"]
pub mod math;
use grid::Grid;
use math::{Vec2, offset};

const NEIGHBOR_RADIUS: f32 = 0.12;
const SPACE: f32 = 0.035;
pub const STEP: f32 = 1.0 / 60.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bird {
    pub position: Vec2,
    pub velocity: Vec2,
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Settings {
    pub count: usize,
    pub speed: f32,
    pub separation: f32,
    pub alignment: f32,
    pub cohesion: f32,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            count: 300,
            speed: 1.0,
            separation: 1.5,
            alignment: 1.0,
            cohesion: 1.0,
        }
    }
}
#[derive(Clone, Copy, Default)]
pub struct Pointer {
    pub position: Vec2,
    pub active: bool,
    pub attracting: bool,
}

pub struct Simulation {
    pub birds: Vec<Bird>,
    pub width: f32,
}
impl Simulation {
    pub fn new(count: usize, width: f32) -> Self {
        let mut simulation = Self {
            birds: Vec::new(),
            width: width.max(0.1),
        };
        simulation.reset(count);
        simulation
    }
    pub fn reset(&mut self, count: usize) {
        // Fixed seed: Reset always makes the same starting flock at this size.
        let mut seed = 731_u32;
        let mut random = || {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            (seed >> 8) as f32 / 16777216.0
        };
        self.birds = (0..count)
            .map(|_| {
                let position = Vec2::new(random() * self.width, random());
                let angle = random() * std::f32::consts::TAU;
                Bird {
                    position,
                    velocity: Vec2::new(angle.cos(), angle.sin()) * 0.14,
                }
            })
            .collect();
    }
    pub fn resize(&mut self, width: f32) {
        let width = width.max(0.1);
        for bird in &mut self.birds {
            bird.position.x *= width / self.width;
        }
        self.width = width;
    }
    pub fn step(&mut self, settings: Settings, pointer: Pointer) {
        let grid = Grid::new(&self.birds, self.width, NEIGHBOR_RADIUS);
        // Read the old flock throughout the step, then replace it all at once.
        let next = self
            .birds
            .iter()
            .enumerate()
            .map(|(index, bird)| {
                let force = self.force(index, &grid, settings, pointer);
                let speed = 0.14 * settings.speed;
                let velocity = (bird.velocity + force * STEP).limit(speed);
                Bird {
                    position: (bird.position + velocity * STEP).wrapped(self.width),
                    velocity,
                }
            })
            .collect();
        self.birds = next;
    }
    fn force(&self, index: usize, grid: &Grid, settings: Settings, pointer: Pointer) -> Vec2 {
        let bird = self.birds[index];
        let mut separation = Vec2::default();
        let mut alignment = Vec2::default();
        let mut cohesion = Vec2::default();
        let mut neighbors = 0;
        grid.visit(bird.position, |other| {
            if other == index {
                return;
            }
            let delta = offset(bird.position, self.birds[other].position, self.width);
            let distance = delta.length();
            if distance >= NEIGHBOR_RADIUS || distance < 0.00001 {
                return;
            }
            neighbors += 1;
            alignment += self.birds[other].velocity;
            cohesion += delta;
            if distance < SPACE {
                separation += delta * (-1.0 / (distance * distance));
            }
        });
        let steer = |direction: Vec2| {
            if direction.length() < 0.00001 {
                Vec2::default()
            } else {
                (direction.direction() * (0.14 * settings.speed) - bird.velocity).limit(0.45)
            }
        };
        let mut force = steer(separation) * settings.separation;
        if neighbors > 0 {
            force += steer(alignment * (1.0 / neighbors as f32)) * settings.alignment;
            force += steer(cohesion * (1.0 / neighbors as f32)) * settings.cohesion;
        }
        if pointer.active {
            let delta = offset(bird.position, pointer.position, self.width);
            let distance = delta.length();
            if distance < 0.25 {
                let sign = if pointer.attracting { 1.0 } else { -1.0 };
                force += delta.direction() * (sign * 0.8 * (1.0 - distance / 0.25));
            }
        }
        force.limit(0.8)
    }
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
