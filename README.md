# Donation Plinko

Marketing site for **Donation Plinko**, the custom coin drop kiosk line built by
Boulder Works Inc. in Longmont, Colorado.

Live: https://lorangb.github.io/donationplinko/

## What this is

A static, zero-dependency rebuild of donationplinko.com. Plain HTML, CSS and
vanilla JavaScript. No framework, no build step, no npm. Push to `main` and it
deploys.

## Files

```
index.html      all markup
styles.css      the design system (tokens, layout, responsive)
app.js          nav, scroll reveals, and the Plinko physics demo
favicon.svg     brass coin over a peg field
images/         real product photography, self-hosted
.nojekyll       serve files as-is on GitHub Pages
.github/workflows/deploy.yml
```

## The coin demo

The hero contains a working Plinko simulation, not a video. It runs a
fixed-timestep (1/120s) integrator with gravity, circle-circle peg collisions,
restitution, tangential jitter so coins never balance on a peg, and slot
landing detection. It pauses when scrolled offscreen and skips rendering in a
hidden tab.

The counter is per-session and honest: it counts drops on this page, not a
fundraising total.

## Design system

- **Surfaces:** ink `#0A0C0F`, steel `#141920` / `#1B222B`, cream `#F6F2EA`
- **Accent:** brass `#E3A83C`, light `#F5CE86`, deep `#A6751F`
- **Acrylic LED accent:** `#6FD8E8`, used sparingly
- **Display:** Archivo 800/900
- **Body:** Inter
- **Accent italic:** Instrument Serif
- **Data and labels:** JetBrains Mono

## Content rules

Every product claim on this site comes from Boulder Works' own published copy
(American-made, industrial-grade steel and high-thickness acrylic, weather-tested,
low maintenance, digital counter and cooling options, custom panels on four sides
and the top). No testimonials, statistics or client names were invented. The
Cheyenne Mountain Zoo installation is a real photographed installation.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

Pushing to `main` triggers the GitHub Actions workflow, which uploads the repo
root as a Pages artifact and deploys it.
