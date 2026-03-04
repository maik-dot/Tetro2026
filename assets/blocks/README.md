# Block-Sprites

Hier kannst du PNG-Grafiken für die einzelnen Materialien hinterlegen.  
Die Engine lädt die Dateien beim Start vor und verwendet sie beim Rendern der Blöcke.

## Neues Namensschema (empfohlen)

Für **jedes Material** (`wood`, `glass`, `stone`, `metal`, `grass`, `slime`) kannst du beliebig viele Texturvarianten anlegen:

- `wood_01.png`, `wood_02.png`, `wood_03.png`, …  
- `glass_01.png`, `glass_02.png`, …  
- `stone_01.png`, `stone_02.png`, …  
- `metal_01.png`, `metal_02.png`, …  
- `grass_01.png`, `grass_02.png`, …  
- `slime_01.png`, `slime_02.png`, …

Regeln:

- Die Zahl ist **zweistellig und inkrementell** (01, 02, 03, …).  
- Die Engine versucht für jedes Material ab `_01` aufwärts zu laden und bricht beim ersten fehlenden Index ab.  
- Alle gefundenen Varianten werden in einer Liste gesammelt und **zufällig/seed-basiert** pro Block gewählt.
  - Tetrominos bestehen damit aus zufällig texturierten Blöcken *des gleichen Materials*.

## Fallbacks / Kompatibilität

- Falls **keine** `material_XX.png`-Dateien gefunden werden, wird (falls vorhanden) ein Basissprite `material.png` verwendet, z. B.:
  - `wood.png`, `glass.png`, `stone.png`, `metal.png`, `grass.png`, `slime.png`
- Falls auch dieses fehlt, rendert die Engine den Block weiterhin als Canvas-Gradient mit Material-Details.

> Hinweis: Die früher genutzten Dateien wie `wood_hp1.png`, `stone_hp2.png` etc. werden aktuell
> nicht mehr für die Darstellung verwendet. Du kannst sie ignorieren oder später wieder für ein
> visuelles Schadensmodell reaktivieren.

## Empfehlungen

- Quadratische PNGs mit transparentem Hintergrund, z. B. 128×128 oder 256×256.
- Comic-Stil mit klar erkennbaren Materialien und leicht variierenden Details zwischen den Varianten.

