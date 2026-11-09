# S-01 to S-20 themes (app and website)

Source of truth for the 20 themes shown in the draft pictures S-01..S-20 (same folder, one level up).
Token values are in `S-01-to-S-20-themes.json` (20 entries, `default: true` on S-19).

## Requested by Jom, 9 Nov 2026
- App: Settings > Theme lists S-01..S-20 by number and name (replaces the old theme choices). Each user's pick is saved; Save / Cancel like every setting.
- Default for everyone: S-19 Charcoal and Lime.
- Website: S-19 on every page (index, Log-in, all pages). No theme picker on the public site.
- Animations everywhere it is sensible in website and app, all honouring prefers-reduced-motion and with a pause control on looping ones.

## Defaults picked (change if Jom says otherwise)
- The top-bar moon (dark/light) button stays. On a dark theme it switches to S-02 Clean Light; on a light theme to S-19. Settings > Theme still decides the main theme.
- Prints and PDFs never use a dark theme (existing rule): print uses S-02 colours.
- The Navy A-16 Home hero already built is recoloured to S-19 tokens (ring = accent, figures = text/muted, alert = bad).
- Fonts are all SIL OFL (commercial use allowed) and must be self-hosted: Inter (incl. Display), JetBrains Mono, Barlow Semi Condensed, Caladea.

## Token meaning
bg page background · panel / panel2 cards · line borders · text / muted type · accent buttons and highlights (accentText on top) · ok / warn / bad status · plan planned-vs-actual line · canvas outside frame · mark / markIn logo shield and its letter · radius corner px.
