# Son Goku

The hatched pet uses the exact image chosen by the user, preserving Goku's black spiky hair, red outfit, monkey tail, face and jumping pose. `reference-original.png` preserves the downloaded image unchanged. `reference-transparent.png` removes white background connected to the image border and retains the largest connected character component. Light grayscale pixels directly along the black outer outline are converted from white-matted gray to translucent black to prevent a white halo. Enclosed eye and smile whites are preserved. The disconnected bottom-right publisher logo is excluded from the cutout; the watermark crossing the character remains intact.

Source supplied by the user: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiRLVsbavgudYwaC-sVQYq3XPcNgNou5iyfXb0pbZuwA&s=10

The selection key is `GOKU_KID`. At vocabulary level 21, the intact red egg hints at Goku with spiky black hair, the actual outfit medallion, a staff and a brown monkey tail. At level 22, Son Goku is fully hatched using the supplied image. There is no intermediate cracked-egg stage. Both runtime PNGs are 1024 × 1024 RGBA with transparent background. Each SVG is self-contained and editable; the reference art and medallion are embedded PNGs, while the egg shell, hair motif, tail and staff are native vector paths.

`build-assets.cjs` rebuilds the image cutout and the two stages with Node.js and Sharp. There is deliberately no `pet.json`, so adding the selectable pet does not change Lụm Trứng reward probabilities or collide with Perry's separate reward identifier 21.

## Level 23: Super Saiyan

The existing `GOKU_KID` selection transforms automatically into **Son Goku Siêu Saiyan** at vocabulary level 23. Levels 21 (intact egg) and 22 (ordinary Goku) retain their current artwork. Admins may preview the final form at level 0. This is a frontend evolution of the existing key; it requires no new backend pet key, catalog entry, or egg reward.

`reference-super-saiyan-original.png` preserves the user's second upload. Built-in Imagegen extracted/reconstructed the character and golden aura onto transparency; that output is retained as `reference-super-saiyan-generated.png`. The exact edit specification is in `super-saiyan-prompt.txt`. `build-super-saiyan.cjs` pads the extraction into a 1024-square `pet-level-23.png` and self-contained SVG, then masks the character out of a separate `super-saiyan-aura.png`/SVG. The supplied source remains unchanged; generated details may differ from it.

CSS gently varies the aura's brightness, opacity and vertical size. The character layer does not move. A shared glow also works in battle avatars, while the floating pet and collection picker layer the animated aura separately. Dragging pauses the floating effect; `prefers-reduced-motion` leaves a still glowing form. Runtime art preserves alpha and includes the aura rather than cropping it to the character.

The upper silhouette was subsequently completed with a focused Imagegen edit, stored as `reference-super-saiyan-completed.png`. The hair and upper flames end in complete points rather than a flat cropped edge. The previous upload and generated extractions remain unchanged for reference.

The user then selected a new Super Saiyan illustration with a flying-punch pose. That upload is preserved as `reference-super-saiyan-punch-original.png`. An Imagegen edit was rejected, so the final character uses the unchanged original PNG embedded inside a native SVG clip path. The clip path removes only the border-connected white background; enclosed eye and hair highlights remain. The illustration itself is not redrawn.

Following the user's clarification, the aura is newly generated as an independent VFX asset rather than taken from a cut-out image. `energy-aura-generated.png` contains a complete golden flame corona on transparency, created with built-in Imagegen using `reference-golden-aura.png` only as a rendering-style and palette reference. The full prompt is in `energy-aura-prompt.txt`. The builder places this new aura around both original illustrations, with the character masked out of the moving layer.

## Level 24: Super Saiyan 2

`reference-super-saiyan-2-original.png` preserves the next user upload. An editable SVG contour clips the character from that image without changing its pixels, retaining the original golden lighting on the face and outfit. The same golden aura surrounds it. Two lightning groups pulse at different repeating intervals, while the character stays still. Following the user's lightning reference, arcs have irregular curved and angular branches, widened white junctions and a soft pale-blue glow, rather than repeated bolt symbols. The final `pet-level-24.svg` is self-contained and animated, so lightning works in the floating pet, collection picker and Battle avatars. `pet-level-24.png` is the static RGBA export; `super-saiyan-2-aura.svg`/PNG expose its separate aura.

Both new forms are rebuilt by `build-super-saiyan.cjs` from the original uploads and the new aura VFX. The animation includes `prefers-reduced-motion` support. The existing key remains `GOKU_KID`, with no backend or reward-catalog change: level 21 is an egg, level 22 is ordinary Goku, level 23 is Super Saiyan and level 24 is Super Saiyan 2.
