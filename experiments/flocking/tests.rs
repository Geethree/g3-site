use super::*;

fn pair(distance: f32) -> Simulation {
    Simulation {
        width: 1.0,
        birds: vec![
            Bird {
                position: Vec2::new(0.5, 0.5),
                velocity: Vec2::default(),
            },
            Bird {
                position: Vec2::new(0.5 + distance, 0.5),
                velocity: Vec2::new(0.0, 0.14),
            },
        ],
    }
}
fn settings() -> Settings {
    Settings {
        separation: 0.0,
        alignment: 0.0,
        cohesion: 0.0,
        ..Settings::default()
    }
}
fn force(sim: &Simulation, settings: Settings) -> Vec2 {
    sim.force(
        0,
        &Grid::new(&sim.birds, sim.width, NEIGHBOR_RADIUS),
        settings,
        Pointer::default(),
    )
}
#[test]
fn separation_moves_away() {
    assert!(
        force(
            &pair(0.02),
            Settings {
                separation: 1.0,
                ..settings()
            }
        )
        .x < 0.0
    );
}
#[test]
fn alignment_follows_velocity() {
    assert!(
        force(
            &pair(0.08),
            Settings {
                alignment: 1.0,
                ..settings()
            }
        )
        .y > 0.0
    );
}
#[test]
fn cohesion_moves_toward_neighbors() {
    assert!(
        force(
            &pair(0.08),
            Settings {
                cohesion: 1.0,
                ..settings()
            }
        )
        .x > 0.0
    );
}
#[test]
fn edges_are_neighbors_and_positions_wrap() {
    let mut sim = pair(0.08);
    sim.birds[0].position.x = 0.99;
    sim.birds[1].position.x = 0.01;
    assert!(
        force(
            &sim,
            Settings {
                cohesion: 1.0,
                ..settings()
            }
        )
        .x > 0.0
    );
    sim.birds[0].velocity.x = 0.14;
    sim.birds[0].position.x = 0.999;
    sim.step(settings(), Pointer::default());
    assert!(sim.birds[0].position.x < 0.01);
}
#[test]
fn reset_is_repeatable() {
    let mut sim = Simulation::new(300, 1.5);
    let original = sim.birds.clone();
    sim.step(Settings::default(), Pointer::default());
    assert_ne!(sim.birds, original);
    sim.reset(300);
    assert_eq!(sim.birds, original);
}
#[test]
fn updates_do_not_depend_on_order() {
    let mut a = Simulation::new(50, 1.0);
    let mut b = Simulation {
        birds: a.birds.iter().copied().rev().collect(),
        width: a.width,
    };
    a.step(Settings::default(), Pointer::default());
    b.step(Settings::default(), Pointer::default());
    for (a, b) in a.birds.iter().zip(b.birds.iter().rev()) {
        assert!((a.position - b.position).length() < 0.00001);
        assert!((a.velocity - b.velocity).length() < 0.00001);
    }
}
#[test]
fn pointer_attracts_and_repels() {
    let sim = pair(0.08);
    let grid = Grid::new(&sim.birds, 1.0, NEIGHBOR_RADIUS);
    let pointer = Pointer {
        position: Vec2::new(0.6, 0.5),
        active: true,
        attracting: false,
    };
    assert!(sim.force(0, &grid, settings(), pointer).x < 0.0);
    assert!(
        sim.force(
            0,
            &grid,
            settings(),
            Pointer {
                attracting: true,
                ..pointer
            }
        )
        .x > 0.0
    );
}
#[test]
fn crowded_flock_stays_finite() {
    let mut sim = Simulation::new(800, 0.4);
    for _ in 0..120 {
        sim.step(Settings::default(), Pointer::default());
    }
    assert!(sim.birds.iter().all(|b| b.position.x.is_finite()
        && b.position.y.is_finite()
        && b.velocity.length() <= 0.14001));
}
