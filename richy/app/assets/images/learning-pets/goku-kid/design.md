# Goku nhí

The hatched pet uses the exact image chosen by the user, preserving Goku's black spiky hair, red outfit, monkey tail, face and jumping pose. `reference-original.png` preserves the downloaded image unchanged. `reference-transparent.png` removes white background connected to the image border and retains the largest connected character component. Light grayscale pixels directly along the black outer outline are converted from white-matted gray to translucent black to prevent a white halo. Enclosed eye and smile whites are preserved. The disconnected bottom-right publisher logo is excluded from the cutout; the watermark crossing the character remains intact.

Source supplied by the user: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiRLVsbavgudYwaC-sVQYq3XPcNgNou5iyfXb0pbZuwA&s=10

The selection key is `GOKU_KID`. At vocabulary level 21, the intact red egg hints at Goku with spiky black hair, the actual outfit medallion, a staff and a brown monkey tail. At level 22, the cracked shell reveals the hair and face from the same supplied image. At level 23, Goku is fully hatched. All three runtime PNGs are 1024 × 1024 RGBA with transparent background. Each SVG is self-contained and editable; the reference art and medallion are embedded PNGs, while the egg shells, hair motif, tail and staff are native vector paths.

`build-assets.cjs` rebuilds the image cutout and the three stages with Node.js and Sharp. There is deliberately no `pet.json`, so adding the selectable pet does not change Lụm Trứng reward probabilities or collide with Perry's separate reward identifier 21.
