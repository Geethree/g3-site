//! Small 2D vector operations used by the simulation.
use std::ops::{Add, AddAssign, Mul, Sub};

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}
impl Vec2 {
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
    pub fn length(self) -> f32 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
    pub fn limit(self, maximum: f32) -> Self {
        let length = self.length();
        if length > maximum {
            self * (maximum / length)
        } else {
            self
        }
    }
    pub fn direction(self) -> Self {
        let length = self.length();
        if length > 0.00001 {
            self * (1.0 / length)
        } else {
            Self::default()
        }
    }
    pub fn wrapped(self, width: f32) -> Self {
        Self::new(self.x.rem_euclid(width), self.y.rem_euclid(1.0))
    }
}
impl Add for Vec2 {
    type Output = Self;
    fn add(self, b: Self) -> Self {
        Self::new(self.x + b.x, self.y + b.y)
    }
}
impl Sub for Vec2 {
    type Output = Self;
    fn sub(self, b: Self) -> Self {
        Self::new(self.x - b.x, self.y - b.y)
    }
}
impl Mul<f32> for Vec2 {
    type Output = Self;
    fn mul(self, k: f32) -> Self {
        Self::new(self.x * k, self.y * k)
    }
}
impl AddAssign for Vec2 {
    fn add_assign(&mut self, b: Self) {
        *self = *self + b;
    }
}

// Take the shortest path across the wrapped edges.
pub fn offset(from: Vec2, to: Vec2, width: f32) -> Vec2 {
    Vec2::new(
        (to.x - from.x + width * 0.5).rem_euclid(width) - width * 0.5,
        (to.y - from.y + 0.5).rem_euclid(1.0) - 0.5,
    )
}
