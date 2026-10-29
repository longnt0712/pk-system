# Son Goku

The hatched pet uses the exact image chosen by the user, preserving Goku's black spiky hair, red outfit, monkey tail, face and jumping pose. `reference-original.png` preserves the downloaded image unchanged. `reference-transparent.png` removes white background connected to the image border and retains the largest connected character component. Light grayscale pixels directly along the black outer outline are converted from white-matted gray to translucent black to prevent a white halo. Enclosed eye and smile whites are preserved. The disconnected bottom-right publisher logo is excluded from the cutout; the watermark crossing the character remains intact.

Source supplied by the user: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiRLVsbavgudYwaC-sVQYq3XPcNgNou5iyfXb0pbZuwA&s=10

The selection key is `GOKU_KID`. At vocabulary level 21, the intact red egg hints at Goku with spiky black hair, the actual outfit medallion, a staff and a brown monkey tail. At level 22, Son Goku is fully hatched using the supplied image. There is no intermediate cracked-egg stage. Both runtime PNGs are 1024 × 1024 RGBA with transparent background. Each SVG is self-contained and editable; the reference art and medallion are embedded PNGs, while the egg shell, hair motif, tail and staff are native vector paths.

`build-assets.cjs` rebuilds the image cutout and the two stages with Node.js and Sharp. There is deliberately no `pet.json`, so adding the selectable pet does not change Lụm Trứng reward probabilities or collide with Perry's separate reward identifier 21.

## Level 23: Super Saiyan

**Son Goku Siêu Saiyan** unlocks as the independent `GOKU_SSJ1` pet at vocabulary level 23. The ordinary `GOKU_KID` remains selectable: level 21 is its intact egg and level 22 onward is ordinary Goku. Admins may choose every Goku pet at level 0. Each form now has its own saved key so unlocking a later form does not replace the user's selection.

`reference-super-saiyan-original.png` preserves the user's second upload. Built-in Imagegen extracted/reconstructed the character and golden aura onto transparency; that output is retained as `reference-super-saiyan-generated.png`. The exact edit specification is in `super-saiyan-prompt.txt`. `build-super-saiyan.cjs` pads the extraction into a 1024-square `pet-level-23.png` and self-contained SVG, then masks the character out of a separate `super-saiyan-aura.png`/SVG. The supplied source remains unchanged; generated details may differ from it.

CSS gently varies the aura's brightness, opacity and vertical size. The character layer does not move. A shared glow also works in battle avatars, while the floating pet and collection picker layer the animated aura separately. Dragging pauses the floating effect; `prefers-reduced-motion` leaves a still glowing form. Runtime art preserves alpha and includes the aura rather than cropping it to the character.

The upper silhouette was subsequently completed with a focused Imagegen edit, stored as `reference-super-saiyan-completed.png`. The hair and upper flames end in complete points rather than a flat cropped edge. The previous upload and generated extractions remain unchanged for reference.

The user then selected a new Super Saiyan illustration with a flying-punch pose. That upload is preserved as `reference-super-saiyan-punch-original.png`. An Imagegen edit was rejected, so the final character uses the unchanged original PNG embedded inside a native SVG clip path. The clip path removes only the border-connected white background; enclosed eye and hair highlights remain. The illustration itself is not redrawn.

The earlier hollow flame ring (`energy-aura-generated.png`) and first pose-specific effect (`energy-outline-level-23.png`) remain as archived references with their prompts. After approving the completed golden-bowl aura described below for level 24, the user requested the same effect for level 23. Both forms now use `energy-closed-level-24.png`; the level-23 aura is rotated 12 degrees clockwise about the canvas center to align with the flying-punch pose. The original character and its placement remain intact, and level 23 has no lightning. A faint blurred stationary golden core supports the character, while the external energy is composited behind a fixed body-exclusion mask. Level-23 CSS changes brightness and opacity without scaling the baked exclusion mask.

## Level 24: Super Saiyan 2

`reference-super-saiyan-2-original.png` preserves the next user upload. An editable SVG contour clips the character from that image without changing its pixels, retaining the original golden lighting on the face and outfit. The first pose-specific aura, `energy-outline-level-24.png`, remains as a reference. The user subsequently selected the golden-bowl energy style in `reference-super-saiyan-2-aura.png` and requested that its open edges be completed into one closed shape. The current `energy-closed-level-24.png` was created with built-in Imagegen from that style and the character placement guide; the exact prompt is in `energy-closed-level-24-prompt.txt`. It has a rounded luminous lower rim, long rising golden streaks, a soft golden interior and a completed upper crown. A faint stationary golden core supports the character without a bright white silhouette border.

Two lightning groups flash fully on and off at different repeating intervals while the character stays still. They use filled white ribbons with irregular broad junctions, narrow filaments, pointed tapered tips and a faint blue fringe, matching the user's reference more closely than constant-width rounded strokes. A foreground branch passes across the waist without obscuring the face. The final `pet-level-24.svg` is self-contained and animated, so lightning works in the floating pet, collection picker and Battle avatars. `pet-level-24.png` is the static RGBA export; `super-saiyan-2-aura.svg`/PNG expose its separate aura. Use `node build-super-saiyan.cjs --level=24` or `--level=23` to update either form independently.

Both golden forms are rebuilt by `build-super-saiyan.cjs` from the original uploads and the new aura VFX. The animation includes `prefers-reduced-motion` support.

## Level 25: Super Saiyan 4

The user's magenta-haired and magenta-furred Goku with a tail unlocks as the independent `GOKU_SSJ4` pet at vocabulary level 25. `reference-super-saiyan-4-original.png` preserves that upload, and `pet-level-25.svg` embeds the same source pixels without redrawing the subject. The runtime uses the transparent 1024-square `pet-level-25.png`, retaining the original purple glow rather than adding the level-23/24 golden aura or lightning. Its floating pet and clickable target are enlarged by 10 pixels to 114 × 118 pixels. The extraction and rebuild details are in `design-level25.md` and `build-super-saiyan-4.cjs`.

## Independent selection

| Saved key | Pet | Unlock level |
| --- | --- | --- |
| `GOKU_KID` | Ordinary Goku (egg at level 21) | 21 |
| `GOKU_SSJ1` | Super Saiyan | 23 |
| `GOKU_SSJ2` | Super Saiyan 2 | 24 |
| `GOKU_SSJ4` | Super Saiyan 4 | 25 |

Unlocks are cumulative. Users at level 25 may select any of the four pets, and their explicit selection remains after reload or further level gains. Admins choose all four without changing their experience. An existing `GOKU_KID` selection now denotes the ordinary Goku pet; users select the new Saiyan keys when they want those forms. All keys use the existing selected-learning-pet field, without a schema migration or new random egg rewards. The backend whitelist, catalog, level validation and Battle identity preserve the separate keys, so deploy the updated JAR together with the frontend.
