# Official K.I.N.G.S. Author's Forge brand asset

The owner-supplied K.I.N.G.S. Author's Forge artwork is the locked canonical visual identity for this application. Production UI must not redraw, reinterpret, replace, or substitute the crest/logo.

`kings-authors-forge-official-192.base64` is a faithful runtime derivative of the locked owner-supplied master artwork. Its decoded PNG SHA-256 is pinned in `scripts/generate-launcher-icons.js`; the build fails if the checked asset is missing or altered.

The build deterministically writes the official art to these runtime/package surfaces:

- `public/assets/brand/kings-authors-forge-official-192.png`
- `public/assets/brand/kings-authors-forge-official-512.png`
- `native-shell/assets/brand/kings-authors-forge-official-512.png`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/icon-maskable-512.png`

The 512px files are delivery-sized resamples of the same official artwork; they are not alternate logo designs. The original owner-supplied master remains the source of truth for future higher-resolution exports. Encoding or delivery-size changes must preserve the same artwork, composition, wording, colors, and identity.
