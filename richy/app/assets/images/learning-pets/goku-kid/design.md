# Son Goku

The hatched pet uses the exact image chosen by the user, preserving Goku's black spiky hair, red outfit, monkey tail, face and jumping pose. `reference-original.png` preserves the downloaded image unchanged. `reference-transparent.png` removes white background connected to the image border and retains the largest connected character component. Light grayscale pixels directly along the black outer outline are converted from white-matted gray to translucent black to prevent a white halo. Enclosed eye and smile whites are preserved. The disconnected bottom-right publisher logo is excluded from the cutout; the watermark crossing the character remains intact.

Source supplied by the user: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiRLVsbavgudYwaC-sVQYq3XPcNgNou5iyfXb0pbZuwA&s=10

The selection key is `GOKU_KID`. At vocabulary level 21, the intact red egg hints at Goku with spiky black hair, the actual outfit medallion, a staff and a brown monkey tail. At level 22, Son Goku is fully hatched using the supplied image. There is no intermediate cracked-egg stage. Both runtime PNGs are 1024 × 1024 RGBA with transparent background. Each SVG is self-contained and editable; the reference art and medallion are embedded PNGs, while the egg shell, hair motif, tail and staff are native vector paths.

`build-assets.cjs` rebuilds the image cutout and the two stages with Node.js and Sharp. There is deliberately no `pet.json`, so adding the selectable pet does not change Lụm Trứng reward probabilities or collide with Perry's separate reward identifier 21.

## Level 23: Super Saiyan

The existing `GOKU_KID` selection transforms automatically into **Son Goku Siêu Saiyan** at vocabulary level 23. Levels 21 (intact egg) and 22 (ordinary Goku) retain their current artwork. Admins may preview the final form at level 0. This is a frontend evolution of the existing key; it requires no new backend pet key, catalog entry, or egg reward.

`reference-super-saiyan-original.png` preserves the user's second upload. Built-in Imagegen extracted/reconstructed the character and golden aura onto transparency; that output is retained as `reference-super-saiyan-generated.png`. The exact edit specification is in `super-saiyan-prompt.txt`. `build-super-saiyan.cjs` pads the extraction into a 1024-square `pet-level-23.png` and self-contained SVG, then masks the character out of a separate `super-saiyan-aura.png`/SVG. The supplied source remains unchanged; generated details may differ from it.

CSS gently varies the aura's brightness, opacity and vertical size. The character layer does not move. A shared glow also works in battle avatars, while the floating pet and collection picker layer the animated aura separately. Dragging pauses the floating effect; `prefers-reduced-motion` leaves a still glowing form. Runtime art preserves alpha and includes the aura rather than cropping it to the character.
