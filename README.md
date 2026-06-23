# Ship the Demo

Playable OpenAI DevDay 2026 ticket-contest entry: a small five-level canvas
arcade sprint where you collect context, tests, Image Gen art, and a playable
link while dodging scope creep and keeping demo heat under control.

The contest prompt asked for a reply with `#OpenAIDevDay2026`, a playable link,
and a quick note on how it was built. This entry is a static browser game made
with Codex, a GPT-5.5 Pro critique pass, and Image Gen art.

Works with keyboard on desktop and tap/drag movement on phone. Hold each target
briefly to lock the artifact. Space or the Dash button gives a short shielded
burst, and skillful dash parries cool the sprint while the hazard pressure rises
by level.

## Local Run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
