# Cyntho Next font files

Drop the licensed Cyntho Next `.woff2` files in this folder with these exact
names and the app will pick them up automatically (wired via `@font-face` in
`src/app/globals.css` — no code changes needed):

- `CynthoNext-Regular.woff2` (weight 400)
- `CynthoNext-Medium.woff2` (weight 500)
- `CynthoNext-SemiBold.woff2` (weight 600)
- `CynthoNext-Bold.woff2` (weight 700)

Until these files are present, the app falls back to the system UI font
stack — nothing breaks, it just won't be Cyntho Next yet.
