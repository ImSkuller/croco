//! The Croco logo (see app-icon.svg) rasterised for the terminal with
//! half-block characters. The shapes are the same ones the SVG draws, sampled
//! at a coarse grid; the greens are re-derived from the current accent colour
//! so the logo follows the theme (green by day, light blue by night, …).

use crate::ui::accent_rgb;

type Rgb = (u8, u8, u8);

const WHITE: Rgb = (255, 255, 255);
const BLACK: Rgb = (17, 17, 17);

// The artwork's bounding box inside the SVG's 1024×1024 canvas.
const X0: f32 = 172.0;
const X1: f32 = 852.0;
const Y0: f32 = 250.0;
const Y1: f32 = 870.0;

enum Shape {
    Ellipse { cx: f32, cy: f32, rx: f32, ry: f32 },
    Rect { x: f32, y: f32, w: f32, h: f32, r: f32 },
}

impl Shape {
    fn hit(&self, px: f32, py: f32) -> bool {
        match *self {
            Shape::Ellipse { cx, cy, rx, ry } => {
                let (dx, dy) = ((px - cx) / rx, (py - cy) / ry);
                dx * dx + dy * dy <= 1.0
            }
            Shape::Rect { x, y, w, h, r } => {
                if px < x || px > x + w || py < y || py > y + h { return false; }
                // rounded corners
                let cx = px.clamp(x + r, x + w - r);
                let cy = py.clamp(y + r, y + h - r);
                (px - cx).powi(2) + (py - cy).powi(2) <= r * r
            }
        }
    }
}

fn circle(cx: f32, cy: f32, r: f32) -> Shape { Shape::Ellipse { cx, cy, rx: r, ry: r } }

fn scale(c: Rgb, f: f32) -> Rgb {
    let s = |v: u8| ((v as f32 * f).round().clamp(0.0, 255.0)) as u8;
    (s(c.0), s(c.1), s(c.2))
}

fn shapes(accent: Rgb) -> Vec<(Shape, Rgb)> {
    let body = scale(accent, 0.74);
    let socket = scale(accent, 0.52);
    let snout = scale(accent, 0.92);
    let dark = scale(accent, 0.36);
    vec![
        (Shape::Ellipse { cx: 512.0, cy: 560.0, rx: 340.0, ry: 310.0 }, body),
        (circle(370.0, 370.0, 110.0), socket),
        (circle(654.0, 370.0, 110.0), socket),
        (circle(370.0, 370.0, 80.0), WHITE),
        (circle(654.0, 370.0, 80.0), WHITE),
        (circle(388.0, 390.0, 46.0), BLACK),
        (circle(672.0, 390.0, 46.0), BLACK),
        (Shape::Ellipse { cx: 512.0, cy: 680.0, rx: 210.0, ry: 140.0 }, snout),
        (circle(456.0, 610.0, 26.0), dark),
        (circle(568.0, 610.0, 26.0), dark),
        (Shape::Rect { x: 418.0, y: 668.0, w: 52.0, h: 72.0, r: 22.0 }, WHITE),
        (Shape::Rect { x: 554.0, y: 668.0, w: 52.0, h: 72.0, r: 22.0 }, WHITE),
    ]
}

fn sample(list: &[(Shape, Rgb)], px: f32, py: f32) -> Option<Rgb> {
    let mut hit = None;
    for (shape, color) in list {
        if shape.hit(px, py) { hit = Some(*color); }
    }
    hit
}

/// Render the logo `cols` characters wide. Each text row packs two pixel rows
/// (upper/lower half block), so the result is about `cols * 0.46` rows tall.
pub fn render(cols: usize) -> Vec<String> {
    let cols = cols.max(6);
    let aspect = (Y1 - Y0) / (X1 - X0);
    let mut px_h = (cols as f32 * aspect).round() as usize;
    if px_h % 2 == 1 { px_h += 1; }
    let list = shapes(accent_rgb());

    let at = |col: usize, row: usize| {
        let x = X0 + (col as f32 + 0.5) / cols as f32 * (X1 - X0);
        let y = Y0 + (row as f32 + 0.5) / px_h as f32 * (Y1 - Y0);
        sample(&list, x, y)
    };

    (0..px_h / 2)
        .map(|r| {
            let mut line = String::new();
            for c in 0..cols {
                match (at(c, r * 2), at(c, r * 2 + 1)) {
                    (None, None) => line.push(' '),
                    (Some(u), None) => line.push_str(&format!("\x1b[38;2;{};{};{}m▀\x1b[0m", u.0, u.1, u.2)),
                    (None, Some(l)) => line.push_str(&format!("\x1b[38;2;{};{};{}m▄\x1b[0m", l.0, l.1, l.2)),
                    (Some(u), Some(l)) => line.push_str(&format!(
                        "\x1b[38;2;{};{};{};48;2;{};{};{}m▀\x1b[0m",
                        u.0, u.1, u.2, l.0, l.1, l.2
                    )),
                }
            }
            line
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_a_plausible_croc_face() {
        let rows = render(26);
        assert!((10..=14).contains(&rows.len()));
        // white eyes are part of the artwork
        assert!(rows.iter().any(|r| r.contains("255;255;255")));
    }
}
