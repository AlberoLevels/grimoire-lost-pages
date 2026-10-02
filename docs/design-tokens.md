# Grimoire: Lost Pages — Design Tokens

Este documento define la identidad visual del juego.  
Su objetivo es que cualquier persona que abra el repositorio sepa cómo debe verse el juego final, sin depender de recuerdos ni de conversaciones externas.

---

## 1. Concepto visual

Grimoire: Lost Pages es un deckbuilder oscuro, arcano y ritualista.

La interfaz debe sentirse como un grimorio viviente:

- fondo profundo, casi negro azulado;
- acentos violetas y azules de tinta arcana;
- detalles dorados como runas o inscripciones;
- símbolos de estrella/destello como motivo de marca;
- jerarquía clara, legible en móvil vertical y cómoda en PC horizontal.

El juego no debe parecer una app genérica. Debe parecer un ritual interactivo.

---

## 2. Paleta oficial

### Fondos

| Token | Valor | Uso |
|---|---:|---|
| `--bg-deep` | `#05070f` | Fondo más profundo, base del mundo |
| `--bg-night` | `#0f172a` | Fondo principal de pantalla |
| `--bg-panel` | `rgba(15, 23, 42, 0.86)` | Paneles HUD |
| `--bg-panel-strong` | `rgba(2, 6, 23, 0.94)` | Paneles oscuros intensos |

### Papel / pergamino arcana

| Token | Valor | Uso |
|---|---:|---|
| `--parchment` | `#e8dcc4` | Texto cálido, etiquetas de página |
| `--parchment-dim` | `rgba(232, 220, 196, 0.72)` | Texto secundario cálido |

### Dorado ritual

| Token | Valor | Uso |
|---|---:|---|
| `--gold` | `#fbbf24` | Bordes, costes, acentos de marca |
| `--gold-soft` | `rgba(251, 191, 36, 0.82)` | Etiquetas y títulos suaves |
| `--gold-border` | `rgba(251, 191, 36, 0.34)` | Bordes de panel |

### Tinta arcana

| Token | Valor | Uso |
|---|---:|---|
| `--ink` | `#60a5fa` | Tinta Arcana, energía, brillos fríos |
| `--ink-glow` | `rgba(96, 165, 250, 0.35)` | Glow de tinta |

### Violeta de grimorio

| Token | Valor | Uso |
|---|---:|---|
| `--purple` | `#a855f7` | Poder, avatar enemigo, motivo estelar |
| `--purple-light` | `#c084fc` | Puntas brillantes del destello |
| `--purple-deep` | `#4c1d95` | Fondos profundos de cartas de poder |
| `--purple-glow` | `rgba(168, 85, 247, 0.28)` | Glow arcano |

### Combate

| Token | Valor | Uso |
|---|---:|---|
| `--blood` | `#ef4444` | Vida, daño, ataque |
| `--blood-deep` | `#7f1d1d` | Fondo de cartas de ataque |
| `--blood-glow` | `rgba(239, 68, 68, 0.25)` | Glow de daño |
| `--heal` | `#22c55e` | Curación |
| `--heal-deep` | `#14532d` | Fondo de curación |
| `--heal-glow` | `rgba(34, 197, 94, 0.22)` | Glow de curación |
| `--shield` | `#38bdf8` | Bloqueo |
| `--shield-deep` | `#1e3a8a` | Fondo frío de defensa |
| `--corrupt` | `#65a30d` | Corrupción / maldición orgánica |
| `--corrupt-deep` | `#1a2e05` | Fondo de corrupción |

### Texto

| Token | Valor | Uso |
|---|---:|---|
| `--text` | `#f8fafc` | Texto principal |
| `--text-dim` | `rgba(248, 250, 252, 0.78)` | Texto secundario |
| `--text-faint` | `rgba(248, 250, 252, 0.52)` | Texto terciario |

---

## 3. Degradado de marca del logotipo

El wordmark del icono usa un degradado vertical que va del dorado cálido al violeta arcano.

Referencia visual aproximada:

```css
background: linear-gradient(180deg, #fbbf24 0%, #a855f7 100%);
