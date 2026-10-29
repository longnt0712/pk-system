# Level 25 — Son Goku Siêu Saiyan 4

`reference-super-saiyan-4-original.png` preserves the user's upload unchanged (1199 × 1593). `pet-level-25.svg` embeds those exact original PNG bytes and applies a native SVG luminance mask; the character is not redrawn, recolored, restyled or generated. Hair, face, clothing, feet, complete tail and the original magenta/purple rim glow remain. Watermarks crossing the character remain intact.

The SVG mask selects the largest connected bright component, excluding the separate publisher mark at the left together with the black background. Enclosed colored interiors and small ink/shadow gaps stay opaque, while the real dark opening beside the tail remains transparent. The faint exterior black matte is keyed out; the original bright purple rim fades into alpha rather than retaining a rectangular black backdrop. The mask changes alpha only, leaving the embedded source's RGB pixels unchanged.

`build-super-saiyan-4.cjs` rebuilds both self-contained SVG and 1024 × 1024 RGBA PNG using Node.js and Sharp. The nonzero subject/glow bounds fit inside a centered 904-pixel envelope, leaving 60-pixel margins. It modifies no other levels or runtime selection logic. The standalone original image and native SVG mask are the editable sources.
