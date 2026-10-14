# Pikachu pet artwork

The user supplied a specific Pikachu reference and requested that the pet match it exactly. The hatched character uses that actual image, with its background removed and its placement normalized. The previous SVG authoring choice remains in effect for the egg artwork; no image generation was used for this revision.

## Evolution

| Vocabulary level | SVG source | Runtime PNG | Appearance |
| --- | --- | --- | --- |
| 18 | `egg-level-18.svg` | `egg-level-18.png` | Unbroken yellow egg, splayed black-tipped ears, red cheek markings, orange cel shading and a lightning tail matching the reference |
| 19 | `egg-level-19.svg` | `egg-level-19.png` | Cracked shell using the actual reference head and ears, with small paws holding the rim |
| 20 and later | `pet-level-20.svg` | `pet-level-20.png` | The exact supplied Pikachu illustration, keeping its face, colors, silhouette and pose |

Selection key: `CUTE_PIKACHU`. Administrators can choose the fully hatched form at any real level, without gaining vocabulary experience.

## Design references

The existing Tom, Jerry and Tuffy egg stages inform the progression: an intact shell carries the character's ears, colors and distinctive markings; the cracked stage exposes the head and paws; the hatched stage shows the full character. The user's Pikachu image defines the yellow (#f7df00), orange shading (#e38900), black outlines, red cheeks and character features used across the stages. The egg illustrations no longer use the earlier chibi face, pale belly patch or glossy gradients.

The original uploaded 308 × 350 PNG is preserved as `reference-original.png`. Its background is separated into transparency in `reference-transparent.png`, preserving the small eye highlights and the illustration's colored pixels. The two stages that show Pikachu embed that transparent raster directly in their SVGs; the egg shells and paws remain editable vector shapes. Thus these SVGs contain raster artwork rather than a vector redraw of Pikachu.

All SVGs use a 1024 × 1024 viewBox. All runtime PNGs are square RGBA images with actual transparent pixels, stored locally alongside their SVG sources. Resizing the supplied raster does not add detail to its original resolution. The application does not request image assets from external servers.
