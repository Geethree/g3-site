//! Bucket bird numbers by position so each bird only checks nearby cells.
use super::{Bird, math::Vec2};

pub struct Grid {
    cells: Vec<Vec<usize>>,
    columns: usize,
    rows: usize,
    width: f32,
}
impl Grid {
    pub fn new(birds: &[Bird], width: f32, radius: f32) -> Self {
        // Cells are at least as wide as the search radius. Check the 3x3 cells.
        let columns = (width / radius).floor().max(1.0) as usize;
        let rows = (1.0 / radius).floor().max(1.0) as usize;
        let mut grid = Self {
            cells: vec![Vec::new(); columns * rows],
            columns,
            rows,
            width,
        };
        for (index, bird) in birds.iter().enumerate() {
            let (x, y) = grid.cell(bird.position);
            grid.cells[y * columns + x].push(index);
        }
        grid
    }
    fn cell(&self, p: Vec2) -> (usize, usize) {
        (
            ((p.x / self.width * self.columns as f32) as usize).min(self.columns - 1),
            ((p.y * self.rows as f32) as usize).min(self.rows - 1),
        )
    }
    pub fn visit(&self, position: Vec2, mut visit: impl FnMut(usize)) {
        let (x, y) = self.cell(position);
        let mut seen = [usize::MAX; 9];
        let mut count = 0;
        for dy in -1..=1 {
            for dx in -1..=1 {
                let column = (x as isize + dx).rem_euclid(self.columns as isize) as usize;
                let row = (y as isize + dy).rem_euclid(self.rows as isize) as usize;
                let cell = row * self.columns + column;
                // Small worlds can wrap several offsets onto the same cell.
                if seen[..count].contains(&cell) {
                    continue;
                }
                seen[count] = cell;
                count += 1;
                for &index in &self.cells[cell] {
                    visit(index);
                }
            }
        }
    }
}
