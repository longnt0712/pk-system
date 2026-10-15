# Pikachu pet artwork

The hatched character uses the user's jumping Pikachu poster, preserved as `reference-jumping-original.png`. SVG clipping removes the poster background while retaining the actual character pixels, including its face, colors, raised-arm jumping pose and attached yellow tail. No replacement character or lightning is drawn.

## Evolution

| Vocabulary level | SVG source | Runtime PNG | Appearance |
| --- | --- | --- | --- |
| 18 | `egg-level-18.svg` | `egg-level-18.png` | Golden-yellow shell with orange shading and coral cheek markings; actual tall left ear, swept-right ear and tail from the latest poster |
| 19 | `egg-level-19.svg` | `egg-level-19.png` | Matching cracked shell, with the latest poster's actual brown-eyed face and ears emerging above the rim and two stationary paws |
| 20 and later | `pet-level-20.svg` | `pet-level-20.png` | Jumping Pikachu extracted from the latest supplied poster |

Selection key: `CUTE_PIKACHU`. Administrators can choose the fully hatched form at any real level, without gaining vocabulary experience.

## Design references

The existing Tom, Jerry and Tuffy egg stages inform the progression: an intact shell carries the character's ears, colors and distinctive markings; the cracked stage exposes the head and paws; the hatched stage shows the full character. All three Pikachu stages now follow the latest poster: golden yellow, warm orange cel shading, navy-black ear tips and coral red cheeks. Both egg stages reuse the poster's actual ear and tail pixels; the cracked stage also reuses its actual face. The shells and stationary rim paws remain editable SVG shapes.

The earlier uploaded 308 × 350 PNG remains preserved as `reference-original.png`, with its old cutout in `reference-transparent.png` for archival reference. All current stages use the latest uploaded 640 × 1138 poster, preserved as `reference-jumping-original.png`.

All SVGs use a 1024 × 1024 viewBox. The new SVGs reference the packaged poster in the same directory; export tools must resolve that image or embed it when rendering. All runtime PNGs are square RGBA images with actual transparent pixels. The body and lightning use the identical `translate(112 15) scale(1.16)` composition so their pixels align. No external image service is used at runtime.

Unlock levels and filenames stay unchanged: intact egg at level 18, cracked egg at level 19, and the hatched character from level 20. Versioned shared image URLs update the assistant, picker, battle portraits and reward previews together. The existing egg idle motion is retained; neither egg has waving or the hatched character's flashing-lightning layer.

## Assistant animation

The hatched assistant shows one stationary, complete `pet-level-20.png`. There is no waving, arm/shoulder layer, body bobbing or electric ring.

`pet-lightning.svg` selects three existing white streaks from the poster: the upper curved streak, the left vertical bolt and the lower-right angular streak. Its clipping regions and near-white pixel filter isolate source artwork instead of rendering new bolt shapes. The matching `pet-lightning.png` overlays the body and receives a brief white/gold CSS glow twice during a 7.2-second cycle, after a long quiet interval. The effect ignores pointer events, pauses during dragging and stays hidden under reduced motion. Selection thumbnails and battle portraits automatically use the updated body through the existing versioned URL; the lightning is only part of the floating assistant.
