# Audio-Dateien

In diesem Ordner liegen die Soundeffekte. Der AudioManager lädt pro Namen **eine** Datei und probiert dabei die Endungen `.ogg`, `.mp3` und `.wav` (in dieser Reihenfolge).

Aktuell sind Platzhalter als kurze stille WAV-Dateien vorhanden. Du kannst sie durch deine eigenen Töne ersetzen – **Dateiname (ohne Endung) beibehalten**, Endung beliebig (OGG, MP3 oder WAV):

| Dateiname    | Verwendung                    |
|-------------|-------------------------------|
| lock        | Stein wird normal abgelegt    |
| lockSoft    | Stein mit Pfeil unten abgelegt|
| lockHard    | Stein mit Leertaste abgelegt  |
| lineClear   | 1–3 Reihen gelöscht           |
| tetris      | 4 Reihen gelöscht             |
| levelUp     | Levelaufstieg                  |
| gameOver    | Spielende                     |
| move        | (optional) Links/Rechts       |
| rotate      | (optional) Drehen             |

Neue Platzhalter erzeugen (falls nötig):  
`node scripts/create-audio-placeholders.js`
