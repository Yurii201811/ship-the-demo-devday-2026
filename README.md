# Ship the Demo

Playable OpenAI DevDay 2026 ticket-contest entry: a small canvas arcade sprint
where you collect context, tests, Image Gen art, and a playable link while
dodging scope creep and keeping demo heat under control.

The contest prompt asked for a reply with `#OpenAIDevDay2026`, a playable link,
and a quick note on how it was built. This entry is a static browser game made
with Codex, an Oracle/GPT-5.5 Pro design critique pass, and Image Gen art.

Works with keyboard on desktop and tap/drag movement on phone. Space or the
Dash button gives a short shielded burst.

## Local Run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
