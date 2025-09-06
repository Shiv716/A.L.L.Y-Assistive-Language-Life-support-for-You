# Vesta Frontend Design System

A minimal, calm interface designed to feel professional and trustworthy. No color noise, no gradients — only clarity.

## Principles
- Clarity over decoration
- Contrast for hierarchy, not for drama
- Motion is subtle and purposeful
- Fewer borders, more whitespace
- Predictable spacing and consistent rhythm

## Palette
- Background: `#ffffff`
- Background (muted): `#f7f7f7`
- Text (primary): `#111111`
- Text (muted): `#6b6b6b`
- Border: `#e6e6e6`

Brand accents (violet #61459e, light-violet #a78cde) used sparingly for primary actions and focus states.

## Typography
- Font family: Inter (system fallbacks included)
- Font weights used: 400, 500, 600
- H1 (Page Titles): 28px, weight 600, negative letter-spacing (-0.02em)
- H2 (Section Headers): 24px, weight 600
- Body/Normal Text: 20px, weight 400-500, line-height 1.6
- All text consistently uses Inter sans-serif across the application

Load via:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

## Components
- Buttons: 8px radius, 1px border. Primary: violet (#61459e) with white text; Secondary: white with gray hover. All use 20px Inter font.
- Inputs: 1px border, 8px radius; focus uses violet accent border with subtle shadow. 20px Inter font.
- Cards/Containers: white background with 1px `#e6e6e6` border, 12px radius.
- Status Dot: 8px, monochrome fill.
- Labels: 20px Inter, weight 500 for consistent readability.

## Motion
- Sphere: gentle vertical float (8s), subtle pulse ring; speaking uses 1.06 scale — conservative and calm.
- Hover: background shift to `#f7f7f7`; no large lifts/shadows.

## Layout
- Max width: 1200px for companion, 760px for configuration.
- Grid gaps: 16–24px.
- Section dividers: 1px borders with generous spacing.

## Accessibility
- Text contrast ≥ 7:1 for primary; ≥ 4.5:1 for muted text.
- Hit targets ≥ 40px height.
- Motion reduced in prefers-reduced-motion (future addition).

## Do Not
- Use gradients, saturated colors, neumorphism, or cartoonish emojis.
- Add shadows except subtle internal shadow on the sphere.
- Animate on every interaction.

## Notes
- This system is intentionally restrained to emphasize warmth through voice, not visuals.

## Brand Accents
- Accent (violet): `#61459e`
- Accent light (light-violet): `#a78cde`

## Logo Typography
- Logo font: Instrument Serif (for wordmark only)
- Usage: top-left wordmark "ALLY" on login; avoid elsewhere
- Size: 34px for prominence
- CSS
```css
.instrument-serif-regular {
  font-family: "Instrument Serif", serif;
  font-weight: 400;
  font-style: normal;
}

.instrument-serif-regular-italic {
  font-family: "Instrument Serif", serif;
  font-weight: 400;
  font-style: italic;
}
```