# Audio-Dateien

In diesem Ordner liegen die Soundeffekte. Der AudioManager lädt pro Namen **eine** Datei und probiert dabei die Endungen `.ogg`, `.mp3` und `.wav` (in dieser Reihenfolge).

Aktuell sind Platzhalter als kurze stille WAV-Dateien vorhanden. Du kannst sie durch deine eigenen Töne ersetzen – **Dateiname (ohne Endung) beibehalten**, Endung beliebig (OGG, MP3 oder WAV):

| Dateiname          | Verwendung                                       |
|--------------------|--------------------------------------------------|
| lock               | Stein wird normal abgelegt                       |
| lockSoft           | Stein mit Pfeil unten abgelegt                   |
| lockHard           | Stein mit Leertaste abgelegt                     |
| lineClear          | 1–3 Reihen gelöscht                              |
| tetris             | 4 Reihen gelöscht                                |
| levelUp            | Levelaufstieg                                    |
| gameOver           | Spielende                                        |
| move               | (optional) Links/Rechts                          |
| rotate             | (optional) Drehen                                |
| metalImpactHeavy   | Metall auf Metall (starker Funken-Impact)        |
| metalImpactMedium  | Stein auf Metall (mittlerer Funken-Impact)       |
| metalImpactLight   | Glas auf Metall (leichter Funken-Impact)         |
| woodBreak          | Holzblock zerbricht (Späne/Splitter)             |
| glassBreak         | Glasblock zerbricht (Scherben)                   |
| stoneBreak         | Steinblock zerbricht in Geröll                   |
| stoneImpactStone   | Stein auf Stein (Bruchstücke + viel Staub)       |
| stoneImpactMetal   | Stein auf Metall (Bruchstücke + mittlerer Staub) |
| stoneImpactGlass   | Stein auf Glas (wenige Bruchstücke + Staub)      |
| stoneImpactWood    | Stein auf Holz (wenige Bruchstücke, dumpfer Hit) |

Neue Platzhalter erzeugen (falls nötig):  
`node scripts/create-audio-placeholders.js`
