# Ship the Demo

Playable OpenAI DevDay 2026 ticket-contest entry: a five-stage canvas arcade
sprint where you lock context, defend the test run, track moving Image Gen art,
deliver a playable link, and survive final review while keeping demo heat under
control.

The contest prompt asked for a reply with `#OpenAIDevDay2026`, a playable link,
and a quick note on how it was built. This entry is a static browser game made
with Codex, a GPT-5.5 Pro critique pass, a Kimi K3 gameplay and UX pass, and
Image Gen art.

Works with keyboard on desktop and tap/drag movement on phone. Hold each target
briefly to lock the artifact. Space or the Dash button gives a real directional,
shielded burst; skim a hazard edge for a clean-dodge bonus or meet it head-on
for a parry. Press `P` or use the Pause button to freeze the run safely.

Successful launches receive a score breakdown and grade, and only shipped runs
can set the local personal best. The result screen supports replay, native share
where available, and a copy-ready contest build note. Responsive layouts keep
the essential controls docked on small portrait and landscape screens.

## Local Run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
