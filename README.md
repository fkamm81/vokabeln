
# Vokabelhelden (PWA)

Mobile‑optimierte, offline‑fähige Lern‑Web‑App zum Trainieren von Latein‑ und Englischvokabeln
für Kinder (10–12). Enthält Flashcards (Spaced Repetition), Quiz, Hören, Sprechen, Zuordnen und Schreiben,
mit XP, Streaks, täglichen Zielen und Elternbereich. Daten bleiben **lokal** im Browser (LocalStorage).

## Features
- PWA: Installierbar auf iPhone/iPad/Android, funktioniert offline
- Spaced Repetition (SM‑2 light)
- Gamification: XP, Streak, Maskottchen mit Sprüchen
- Aktivitäten: Flashcards, Quiz (MC), Hören (TTS), Sprechen (Web Speech, Fallback), Zuordnen, Schreiben
- Import: CSV oder JSON (de/latein/englisch & lektion werden automatisch erkannt)
- Elternbereich: Ziele pro Tag (Lektionen & Minuten), Fortschrittsübersicht
- Themebar (Hell/Dunkel), ohne Scrolling auf Mobile (1‑Screen Layout)
- Datenschutz: Keine Server, alles lokal

## Deploy (GitHub Pages)
1. Repository erstellen: `vocab-pwa`
2. Inhalt dieses Ordners committen.
3. GitHub Pages aktivieren: Settings → Pages → von `main` root.
4. App aufrufen: `https://<user>.github.io/vocab-pwa/`. Beim ersten Aufruf „Zum Home‑Bildschirm“ hinzufügen.

## CSV Hinweise
Spalten werden flexibel erkannt. Übliche Namen:
- Deutsch: `deutsch`, `de`
- Latein: `latein`, `latin`, `lat`, `la`
- Englisch: `englisch`, `english`, `en`
- Lektion: `lektion`, `lesson`, `kapitel`

## Erinnerungen
Echte zeitgesteuerte Lokal‑Benachrichtigungen sind im Web eingeschränkt. Diese App löst eine tägliche Erinnerung aus,
wenn sie nach 17:00 geöffnet ist. Für echte Push‑Erinnerungen braucht man einen kleinen Push‑Server (VAPID).
Alternativen:
- iOS: Eigene Kurzbefehle‑Automation, die um 17:00 eine Mitteilung schickt und die App‑URL öffnet.
- Kalender‑Erinnerung anlegen (täglich, Link zur App).

## Datenmodell
Alle Einträge: `{ id, lesson, de, la, en }`. Lernstände: `perCard[id] = {EF, interval, due, reps}`.
Persistenz in `localStorage` unter Schlüssel `vocab-helden-v1`.

Viel Spaß! 🐢 🐸 🐑
