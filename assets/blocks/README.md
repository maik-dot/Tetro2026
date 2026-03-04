# Block-Sprites

Hier kannst du PNG-Grafiken für die einzelnen Materialien und Haltbarkeitsstufen der Blöcke hinterlegen. Die Engine lädt die Dateien beim Start vor und verwendet sie beim Rendern.

## Dateinamen

Basis-Sprites pro Material:

- `wood.png`
- `glass.png`
- `stone.png`
- `metal.png`
- `grass.png`
- `slime.png`

Optionale Varianten pro Haltbarkeits-Stufe (HP):

- `wood_hp1.png`, `wood_hp2.png`, …
- `glass_hp1.png`, …
- `stone_hp1.png`, `stone_hp2.png`, `stone_hp3.png`
- `metal_hp1.png`, `metal_hp2.png`, `metal_hp3.png`, `metal_hp4.png`
- `grass_hp1.png` (Gras hat 1 HP)
- `slime_hp1.png` (Schleim hat 1 HP)

Die Engine versucht zuerst für einen Block mit Material `X` und aktueller `hp` ein Sprite:

1. `X_hp<hp>.png`  
2. Falls nicht vorhanden: `X.png`
3. Falls ebenfalls nicht vorhanden: Fallback auf die bisherige Canvas-Grafik (Gradient + Kanten + Risse).

Empfehlungen:

- Quadratische PNGs mit transparentem Hintergrund, z. B. 128×128 oder 256×256.
- Comic-Stil mit klar erkennbaren Materialien und optional bereits eingezeichneten Schadensstufen pro `hp`.

