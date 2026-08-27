# FFmpeg Konverter

Benutzerfreundlicher Video- und Audio-Konverter für Windows und macOS auf Basis von FFmpeg (Electron + React + TypeScript). Deutsch/Englisch umschaltbar.

## Funktionen

- Video-Formate: MP4, MKV, MOV, WebM, AVI, FLV, WMV, GIF
- Audio-Formate: MP3, M4A/AAC, WAV, FLAC, OGG, Opus, WMA
- Codecs: H.264, H.265/HEVC, VP9, AV1 (Video); AAC, MP3, Opus, Vorbis, FLAC, PCM, WMA (Audio)
- Up- und Downscaling mit Presets (480p–8K) oder freier Auflösung, Seitenverhältnis wahlweise beibehalten
- Qualität per CRF-Regler oder fester Bitrate, Framerate-Auswahl
- Stapelverarbeitung (Batch) mit Fortschrittsanzeige, Geschwindigkeit/ETA, wählbarer Parallelität
- Schnellprofile (kompatibel, kleinste Datei, beste Qualität, nur Audio, verlustfreies Audio, GIF) + eigene Profile
- Zielordner, Dateinamensmuster und Konfliktbehandlung frei konfigurierbar

## Entwicklung

Voraussetzung: Node.js 20+.

```bash
npm install
npm run gen:icons   # einmalig: App-Icons aus build/icon-source.svg erzeugen
npm run dev          # startet die App im Entwicklungsmodus
```

## Builds

```bash
npm run build:mac   # .dmg + .zip (nur auf macOS ausführbar)
npm run build:win   # .exe (NSIS) + .zip (auf Windows oder via CI)
npm run build:all   # beides zusammen (benötigt macOS + entsprechendes Tooling für Windows-Signierung/Wine)
```

Da hier nur ein Mac zur Verfügung steht, baut der Workflow unter `.github/workflows/build.yml`
bei jedem Tag-Push (`v*`) oder manuell über den "Run workflow"-Button automatisch sowohl die
macOS- als auch die Windows-Version und stellt sie als Artefakte zum Download bereit.

Hinweis: Die erzeugten Pakete sind nicht codesigniert. macOS zeigt beim ersten Start eine
Gatekeeper-Warnung ("nicht verifizierter Entwickler"); über Rechtsklick → "Öffnen" lässt sich
das bestätigen. Für eine signierte/notarisierte Verteilung wird eine Apple-Developer- bzw.
Windows-Codesigning-Zertifikat benötigt.

## Architektur

- `src/main` – Electron-Hauptprozess (Fenster, FFmpeg-Warteschlange, IPC, Menü, Einstellungen)
- `src/preload` – abgesicherte `window.api`-Bridge (contextIsolation, kein nodeIntegration)
- `src/renderer` – React-UI
- `src/shared` – gemeinsame Typen und Format-/Codec-Definitionen
