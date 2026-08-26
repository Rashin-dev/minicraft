# ⛏ MiniCraft

**An infinite, cinematic voxel sandbox — Minecraft's soul, supercharged.** Runs in any browser, buttery smooth on a 4 GB RAM phone, and ships with an **AI Architect** that builds palaces from a single sentence.

![mode](https://img.shields.io/badge/mode-creative%20%2B%20survival-brightgreen) ![engine](https://img.shields.io/badge/engine-WebGL%20%2B%20WebWorker-blue)

---

## ✨ Highlights

### Cinematic graphics (the jaw-drop pass)
- **RGB voxel lighting** — torches glow warm, amethyst glows purple, lava glows orange; light floods caves and bleeds through doorways with smooth per-vertex interpolation + baked ambient occlusion
- **Cinematic sky** — physical-feeling gradient dome, HDR sun with halo, **moon with real phases**, twinkling procedural starfield, and **aurora borealis** curtains at night (strongest in snowy biomes)
- **Volumetric sun shafts (godrays)** — radial-light scattering at sunrise/sunset, plus **HDR bloom** on every emissive surface
- **Living water** — Gerstner-style waves, fresnel sky reflection, sun glitter, depth tint; underwater gets its own fog + wobble
- **Weather** — rain, snow, thunderstorms with lightning flashes; fog and cloud cover react
- **Wind** — leaves and grass sway in the breeze
- **ACES tone mapping**, vignette, dusk color grading, damage/sleep/flash effects
- **Biomes** — plains, forest, birch forest, desert, snowy peaks, mountains, and **cherry groves** with falling-pink canopies; worm tunnels + cheese caverns underground with **amethyst clusters** and **lava lakes**

### Everything you love from Minecraft
- Creative **and** Survival: hearts, hunger, drowning, fall damage, regen, death/respawn
- Mine → **drops** → inventory (36 slots) → **crafting** (tools in 4 tiers, torches, glass, beds, TNT…)
- Tools matter: pickaxe/axe/shovel/sword speed & damage per tier
- **Hostile mobs**: zombies (chase + burn at dawn), skeletons (archers), **creepers** (hiss → flash → boom). Passive pigs, sheep, cows, chickens with drops
- Beds (sleep + set spawn), TNT with chain reactions, day/night on a real clock
- Infinite terrain streamed in a **Web Worker** — zero frame hitches

### MiniCraft exclusives (vanilla doesn't have these)
- ✦ **AI Architect** — type *"build a big palace"* and watch it rise block by block
- ✦ **MCP bridge** — connect an external AI agent to drive the world (see below)
- ✦ Minimap + waypoints with teleport
- ✦ Vertical slabs, colored light, auto-graphics scaling

---

## 🤖 AI Architect

Three ways to let AI build for you:

### 1. Built-in offline architect (no internet needed)
Open the chat (`T` or 💬) and type naturally:
```
build a big palace
grow a cherry forest
make a huge glass dome
build a castle with a maze
```
A local parser understands structures (palace, castle, house, tower, dome, pyramid, bridge, garden, maze, fountain, statue, forests), sizes (tiny→massive), and materials — then constructs it with an animated bottom-up build and progress bar.

### 2. Connect any AI (OpenAI-compatible API)
Pause menu → **AI Architect → connect AI** → enable, paste any `/v1/chat/completions` endpoint + API key + model (OpenAI, local LLM servers, etc.). Free-form prompts are sent to the model with a build-plan schema; the returned plan is validated, sandboxed (coordinate + budget clamps), and built in your world.

### 3. MCP bridge (drive the game from an agent)
The game connects out to any WebSocket JSON-RPC endpoint — perfect for an MCP server on your desktop. **Protocol docs: [AI_MCP.md](./AI_MCP.md)**

---

## 🎮 Controls

| Desktop | Mobile |
|---|---|
| WASD move · Shift sprint · Ctrl sneak | Joystick move (push far = sprint) |
| Space jump · **double-Space fly** | ⬆ jump · 🕊 fly · double-tap ⬆ to fly |
| LMB mine (hold) · RMB place / eat / sleep | hold to mine · tap to place |
| Scroll / 1-9 hotbar · E inventory · T chat | tap hotbar · ▦ inventory · 💬 chat |
| F3 debug info | — |

---

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production bundle in dist/
```

## ⚡ Performance (built for 4 GB RAM phones)

- Terrain generation, lighting (4-channel flood-fill BFS) and meshing run in a **Web Worker** with zero-copy transferable buffers
- **Dynamic resolution scaling** + adaptive render distance keep FPS locked; quality tiers gate godrays/bloom automatically
- One draw call per chunk per layer; packed vertex formats (light+AO in bytes); fog hides chunk edges
- Greedy face culling, pooled point lights, capped particles, mob culling by distance

## 🏗 Tech

React 19 · TypeScript · Vite 7 · Three.js · Tailwind · Web Workers · Web Audio (all sounds & music are procedurally synthesized — zero assets)

---

*Built with ❤ by Rashin — go build something beautiful.*
