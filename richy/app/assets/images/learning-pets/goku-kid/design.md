# Son Goku

The hatched pet uses the exact image chosen by the user, preserving Goku's black spiky hair, red outfit, monkey tail, face and jumping pose. `reference-original.png` preserves the downloaded image unchanged. `reference-transparent.png` removes white background connected to the image border and retains the largest connected character component. Light grayscale pixels directly along the black outer outline are converted from white-matted gray to translucent black to prevent a white halo. Enclosed eye and smile whites are preserved. The disconnected bottom-right publisher logo is excluded from the cutout; the watermark crossing the character remains intact.

Source supplied by the user: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiRLVsbavgudYwaC-sVQYq3XPcNgNou5iyfXb0pbZuwA&s=10

The selection key is `GOKU_KID`. At vocabulary level 21, the intact red egg hints at Goku with spiky black hair, the actual outfit medallion, a staff and a brown monkey tail. At level 22, Son Goku is fully hatched using the supplied image. There is no intermediate cracked-egg stage. Both runtime PNGs are 1024 × 1024 RGBA with transparent background. Each SVG is self-contained and editable; the reference art and medallion are embedded PNGs, while the egg shell, hair motif, tail and staff are native vector paths.

`build-assets.cjs` rebuilds the image cutout and the two stages with Node.js and Sharp. There is deliberately no `pet.json`, so adding the selectable pet does not change Lụm Trứng reward probabilities or collide with Perry's separate reward identifier 21.

## Level 23: Super Saiyan

**Son Goku Siêu Saiyan** unlocks as the independent `GOKU_SSJ1` pet at vocabulary level 23. The ordinary `GOKU_KID` remains selectable: level 21 is its intact egg and level 22 onward is ordinary Goku. Admins may choose every Goku pet at level 0. Each form now has its own saved key so unlocking a later form does not replace the user's selection.

`reference-super-saiyan-original.png` preserves the user's second upload. Built-in Imagegen extracted/reconstructed the character and golden aura onto transparency; that output is retained as `reference-super-saiyan-generated.png`. The exact edit specification is in `super-saiyan-prompt.txt`. `build-super-saiyan.cjs` pads the extraction into a 1024-square `pet-level-23.png` and self-contained SVG, then masks the character out of a separate `super-saiyan-aura.png`/SVG. The supplied source remains unchanged; generated details may differ from it.

Earlier revisions animated a separate golden aura around the still character. The user subsequently requested removal of the golden aura from both SSJ1 and SSJ2. The floating pet, picker and Battle now show SSJ1 without an aura image or golden CSS glow.

The upper silhouette was subsequently completed with a focused Imagegen edit, stored as `reference-super-saiyan-completed.png`. The hair and upper flames end in complete points rather than a flat cropped edge. The previous upload and generated extractions remain unchanged for reference.

The user then selected a new Super Saiyan illustration with a flying-punch pose. That upload is preserved as `reference-super-saiyan-punch-original.png`. An Imagegen edit was rejected, so the final character uses the unchanged original PNG embedded inside a native SVG clip path. The clip path removes only the border-connected white background; enclosed eye and hair highlights remain. The illustration itself is not redrawn.

The earlier flame assets, generated golden-bowl effect, prompts and separate aura exports remain archived. The current SSJ1/SSJ2 builder does not read or embed them and adds no yellow core. Both original character images and their placement remain intact. SSJ1 has no lightning; SSJ2 retains the white-blue lightning described below.

## Level 24: Super Saiyan 2

`reference-super-saiyan-2-original.png` preserves the next user upload. An editable SVG contour clips the character without changing its pixels, retaining the source lighting on the face and outfit. Generated aura sources remain archived, including the completed golden-bowl effect and its prompt, but the current runtime omits all golden aura layers at the user's request.

Two lightning groups flash fully on and off at different repeating intervals while the character stays still. They use filled white ribbons with broad junctions, narrow filaments, pointed tapered tips and a faint blue fringe. A foreground branch passes across the waist without obscuring the face. The self-contained `pet-level-24.svg` keeps lightning animated in the floating pet, picker and Battle; `pet-level-24.png` is the static RGBA export. Use `node build-super-saiyan.cjs --level=24` or `--level=23` to update either form independently.

Both forms are rebuilt by `build-super-saiyan.cjs` from the original uploads. SSJ2 lightning retains `prefers-reduced-motion` support. SSJ1, SSJ2 and SSJ4 share the enlarged 114 × 118 pixel floating wrapper and clickable target. The widget stays at its default or manually dragged position instead of automatically moving to avoid page controls.

## Level 25: Super Saiyan 4

The user's magenta-haired and magenta-furred Goku with a tail unlocks as the independent `GOKU_SSJ4` pet at vocabulary level 25. `reference-super-saiyan-4-original.png` preserves that upload, and `pet-level-25.svg` embeds the same source pixels without redrawing the subject. The runtime uses the transparent 1024-square `pet-level-25.png`, retaining the original purple glow rather than adding the level-23/24 golden aura or lightning. Its floating pet and clickable target are enlarged by 10 pixels to 114 × 118 pixels. The extraction and rebuild details are in `design-level25.md` and `build-super-saiyan-4.cjs`.

## Independent selection

| Saved key | Pet | Unlock level |
| --- | --- | --- |
| `GOKU_KID` | Ordinary Goku (egg at level 21) | 21 |
| `GOKU_SSJ1` | Super Saiyan | 23 |
| `GOKU_SSJ2` | Super Saiyan 2 | 24 |
| `GOKU_SSJ4` | Super Saiyan 4 | 25 |

Unlocks are cumulative. Users at level 25 may select any of the four pets, and their explicit selection remains after reload or further level gains. Admins choose all four without changing their experience. An existing `GOKU_KID` selection now denotes the ordinary Goku pet; users select the new Saiyan keys when they want those forms. All keys use the existing selected-learning-pet field without a schema migration. The Battle egg catalog now includes all five pictured stages through `pet.json`; collecting one in Battle does not unlock or equip the account pet. The backend whitelist, catalog, level validation and Battle identity preserve the separate keys, so deploy the updated JAR together with the frontend.
