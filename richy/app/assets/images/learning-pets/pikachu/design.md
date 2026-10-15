# Pikachu pet artwork

The hatched character uses the user's jumping Pikachu poster, preserved as `reference-jumping-original.png`. SVG clipping removes the poster background while retaining the actual character pixels, including its face, colors, raised-arm jumping pose and attached yellow tail. No replacement character or lightning is drawn.

## Evolution

| Vocabulary level | SVG source | Runtime PNG | Appearance |
| --- | --- | --- | --- |
| 18 | `egg-level-18.svg` | `egg-level-18.png` | Unbroken yellow egg, splayed black-tipped ears, red cheek markings, orange cel shading and a lightning tail matching the reference |
| 19 | `egg-level-19.svg` | `egg-level-19.png` | Cracked shell using the actual reference head and ears, with small paws holding the rim |
| 20 and later | `pet-level-20.svg` | `pet-level-20.png` | Jumping Pikachu extracted from the latest supplied poster |

Selection key: `CUTE_PIKACHU`. Administrators can choose the fully hatched form at any real level, without gaining vocabulary experience.

## Design references

The existing Tom, Jerry and Tuffy egg stages inform the progression: an intact shell carries the character's ears, colors and distinctive markings; the cracked stage exposes the head and paws; the hatched stage shows the full character. The egg illustrations retain their previous reference and progression. The new hatched artwork keeps the latest poster's yellow/orange shading, black outlines, red cheeks, eye highlights, open mouth and jumping pose.

The earlier uploaded 308 × 350 PNG remains preserved as `reference-original.png`, with its cutout in `reference-transparent.png` for the egg artwork. The latest uploaded 640 × 1138 poster is preserved separately as `reference-jumping-original.png`.

All SVGs use a 1024 × 1024 viewBox. The new SVGs reference the packaged poster in the same directory; export tools must resolve that image or embed it when rendering. All runtime PNGs are square RGBA images with actual transparent pixels. The body and lightning use the identical `translate(112 15) scale(1.16)` composition so their pixels align. No external image service is used at runtime.

## Assistant animation

The hatched assistant shows one stationary, complete `pet-level-20.png`. There is no waving, arm/shoulder layer, body bobbing or electric ring.

`pet-lightning.svg` selects three existing white streaks from the poster: the upper curved streak, the left vertical bolt and the lower-right angular streak. Its clipping regions and near-white pixel filter isolate source artwork instead of rendering new bolt shapes. The matching `pet-lightning.png` overlays the body and receives a brief white/gold CSS glow twice during a 7.2-second cycle, after a long quiet interval. The effect ignores pointer events, pauses during dragging and stays hidden under reduced motion. Selection thumbnails and battle portraits automatically use the updated body through the existing versioned URL; the lightning is only part of the floating assistant.
