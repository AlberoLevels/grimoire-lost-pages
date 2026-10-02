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
|---|---|---|
| --bg-deep | #05070f | Fondo más profundo, base del mundo |
| --bg-night | #0f172a | Fondo principal de pantalla |
| --bg-panel | rgba(15, 23, 42, 0.86) | Paneles HUD |
| --bg-panel-strong | rgba(2, 6, 23, 0.94) | Paneles oscuros intensos |

### Papel / pergamino arcana

| Token | Valor | Uso |
|---|---|---|
| --parchment | #e8dcc4 | Texto cálido, etiquetas de página |
| --parchment-dim | rgba(232, 220, 196, 0.72) | Texto secundario cálido |

### Dorado ritual

| Token | Valor | Uso |
|---|---|---|
| --gold | #fbbf24 | Bordes, costes, acentos de marca |
| --gold-soft | rgba(251, 191, 36, 0.82) | Etiquetas y títulos suaves |
| --gold-border | rgba(251, 191, 36, 0.34) | Bordes de panel |

### Tinta arcana

| Token | Valor | Uso |
|---|---|---|
| --ink | #60a5fa | Tinta Arcana, energía, brillos fríos |
| --ink-glow | rgba(96, 165, 250, 0.35) | Glow de tinta |

### Violeta de grimorio

| Token | Valor | Uso |
|---|---|---|
| --purple | #a855f7 | Poder, avatar enemigo, motivo estelar |
| --purple-light | #c084fc | Puntas brillantes del destello |
| --purple-deep | #4c1d95 | Fondos profundos de cartas de poder |
| --purple-glow | rgba(168, 85, 247, 0.28) | Glow arcano |

### Combate

| Token | Valor | Uso |
|---|---|---|
| --blood | #ef4444 | Vida, daño, ataque |
| --blood-deep | #7f1d1d | Fondo de cartas de ataque |
| --blood-glow | rgba(239, 68, 68, 0.25) | Glow de daño |
| --heal | #22c55e | Curación |
| --heal-deep | #14532d | Fondo de curación |
| --heal-glow | rgba(34, 197, 94, 0.22) | Glow de curación |
| --shield | #38bdf8 | Bloqueo |
| --shield-deep | #1e3a8a | Fondo frío de defensa |
| --corrupt | #65a30d | Corrupción / maldición orgánica |
| --corrupt-deep | #1a2e05 | Fondo de corrupción |

### Texto

| Token | Valor | Uso |
|---|---|---|
| --text | #f8fafc | Texto principal |
| --text-dim | rgba(248, 250, 252, 0.78) | Texto secundario |
| --text-faint | rgba(248, 250, 252, 0.52) | Texto terciario |

---

## 3. Degradado de marca del logotipo

El wordmark del icono usa un degradado vertical que va del dorado cálido al violeta arcano.

Referencia visual aproximada:

background: linear-gradient(180deg, #fbbf24 0%, #a855f7 100%);

Variantes útiles:

/* Dorado a violeta claro, más brillante */
background: linear-gradient(180deg, #fbbf24 0%, #c084fc 100%);

/* Violeta profundo a tinta, para fondos oscuros */
background: linear-gradient(135deg, #4c1d95 0%, #60a5fa 100%);

Este degradado se reserva principalmente para:

- logotipo;
- títulos de pantalla de inicio;
- elementos de marca muy destacados.

No debe usarse en todo el texto del juego, para no perder jerarquía.

---

## 4. Tipografía

### Fuente de marca

La fuente de marca es:

OPTIColumna Solid

Archivo web:

fonts/opticolumna-solid.woff2

Declaración CSS:

@font-face {
  font-family: "OPTIColumna Solid";
  src: url("./fonts/opticolumna-solid.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

Variable:

--font-title: "OPTIColumna Solid", Georgia, "Times New Roman", serif;

### Uso de la fuente de marca

Se usa en:

- título de la intro (#intro-title);
- nombres de cartas/páginas (.page-name, .deck-item-name);
- etiquetas de panel tipo “Vitalidad”, “Tinta Arcana” (.panel-label);
- nombres de enemigo (.enemy-name);
- títulos de overlays (.overlay-card h1/h2);
- textos ceremoniales cortos (.battle-message).

### Peso único

La familia disponible es solo Solid.

Por tanto:

- no usar font-weight: bold en elementos con --font-title;
- no usar font-style: italic en elementos con --font-title;
- si se necesita énfasis, usar color, tamaño, letter-spacing o glow, no bold/italic sintéticos.

Regla práctica:

font-weight: 400;
font-style: normal;

### Fuente de interfaz

Para cuerpo de texto, descripciones y UI general:

--font-ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

### Fuente numérica / fuerte

Para costes, valores numéricos y botones principales:

--font-strong: "Arial Black", "Segoe UI", Impact, sans-serif;

---

## 5. Motivo de marca: la estrella arcana

El símbolo principal del icono es una estrella/destello de cuatro puntas con curvas cóncavas, en violeta luminoso.

Este motivo debe considerarse el símbolo recurrente del juego.

Puede aparecer como:

- avatar enemigo (#enemy-avatar, actualmente usa el carácter ✦);
- glow en cartas de poder (.is-power);
- separadores rituales;
- indicador de selección;
- pantalla de carga;
- partículas flotantes;
- borde interior de paneles importantes.

Descripción visual:

- forma de spark / destello de 4 puntas;
- centro violeta brillante (--purple);
- halo suave morado/azul (--purple-glow, --ink-glow);
- sensación de magia concentrada;
- siempre sobre fondo oscuro.

No sustituir este motivo por iconos genéricos de videojuego. Es parte de la identidad.

---

## 6. Fondos y atmósfera

El fondo general debe mantener profundidad arcana:

background:
  radial-gradient(circle at 18% 18%, rgba(88, 28, 135, 0.18), transparent 28%),
  radial-gradient(circle at 82% 24%, rgba(30, 64, 175, 0.16), transparent 30%),
  radial-gradient(circle at 50% 82%, rgba(120, 53, 15, 0.10), transparent 35%),
  linear-gradient(180deg, #05070f, #0f172a);

El campo de ritual (.battlefield) puede incluir:

- círculo rúnico giratorio muy lento (.battlefield::before, animación slowSpin);
- viñeta oscura (.battlefield::after);
- glow violeta central;
- partículas o textos flotantes.

La atmósfera debe ser discreta. El juego es legible primero, atmosférico después.

---

## 7. Cartas / Páginas

Las cartas se llaman internamente “páginas”, pero visualmente deben leerse como cartas jugables.

Estructura mínima de una página (.page-card):

1. coste (.page-cost);
2. nombre (.page-name);
3. tipo (.page-type);
4. descripción (.page-desc).

Colores por tipo:

| Tipo | Clase CSS | Color dominante |
|---|---|---|
| Ataque | .is-attack / [data-type="attack"] | rojo sangre (--blood) |
| Defensa / Skill | .is-skill / [data-type="skill"] | azul escudo (--shield) |
| Curación | .is-heal | verde vida (--heal) |
| Poder | .is-power / [data-type="power"] | violeta arcano (--purple) |
| Maldición / Corrupción | .is-curse / .is-corrupted | verde podrido / oliva (--corrupt) |

El coste debe ser siempre circular y dorado o acorde al tipo.

El nombre de la carta usa --font-title.

La descripción usa --font-ui.

Estado seleccionado: elevación suave + borde dorado intenso + glow.

Estado deshabilitado: opacidad reducida + saturación baja.

---

## 8. HUD

El HUD superior (.hud) se divide en tres bloques:

- jugador: vitalidad y efectos (#player-panel);
- recurso central: Tinta Arcana (#ink-panel);
- enemigo: nombre, vida e intención (#enemy-panel).

Los paneles usan:

- fondo oscuro translúcido (--bg-panel);
- borde dorado tenue (--gold-border);
- sombra profunda (--shadow-panel);
- glow arcano suave.

En móvil vertical, el layout cambia a grid de 2 columnas para optimizar espacio.

---

## 9. Botones

El botón principal es ritual, no genérico.

Características (.ritual-button):

- fondo oscuro con brillo dorado superior;
- borde dorado (rgba(251, 191, 36, 0.55));
- texto en mayúsculas;
- tipografía fuerte (--font-strong);
- sombra profunda (--shadow-button);
- feedback táctil claro (transform en hover/active).

Texto recomendado para fin de turno:

Cerrar Ritual

No usar “End Turn” en la interfaz principal, salvo que se traduzca o se integre narrativamente.

Botón secundario (.secondary-button): mismo estilo pero tono pergamino (--parchment) y sin glow dorado intenso.

---

## 10. Overlays

Los overlays deben sentirse como páginas o visiones separadas del ritual.

Incluyen:

- intro narrativa (#intro-screen);
- resultado de victoria/derrota (#result-screen);
- inspección de página (#inspect-overlay);
- lista de Grimorio/Cenizas (#deck-overlay).

Reglas:

- fondo oscuro semitransparente (rgba(2, 6, 23, 0.82));
- tarjeta central con borde dorado (--gold-border);
- título en fuente de marca (--font-title);
- texto legible (--text-dim);
- cierre claro con botón o tecla Escape.

El modal de intro está centrado ópticamente usando flexbox en .intro-card.

---

## 11. Movimiento

El movimiento debe ser lento, orgánico y arcano.

Animaciones permitidas:

- respiración del avatar enemigo (avatarPulse, 3.4s);
- giro lento del círculo rúnico (slowSpin, 38s);
- elevación suave de cartas (transition 140ms);
- textos flotantes de daño/curación/bloqueo (floatUp, 900ms);
- glow pulsante en elementos seleccionados.

Evitar:

- rebotes excesivos;
- animaciones rápidas de casino;
- parpadeos fuertes;
- movimientos que distraigan de la lectura de cartas.

Respetar siempre:

@media (prefers-reduced-motion: reduce) {
  /* Desactivar animaciones largas y transiciones bruscas */
}

---

## 12. Orientación

El juego está pensado principalmente para móvil vertical.

En PC puede disfrutarse horizontal, pero la composición base debe funcionar en vertical.

No debe aparecer un aviso bloqueante de “gira el dispositivo” en la versión final, salvo que en algún momento se decida oficialmente que el juego es solo horizontal. Actualmente, el HTML limpio no incluye ese bloque.

---

## 13. Iconografía PWA

Archivos actuales:

icons/favicon.ico
icons/icon-192.png
icons/icon-512.png
icons/icon-maskable-512.png

El icono maskable debe conservar el diseño del logotipo, pero escalado para que estrella y texto entren dentro del área segura del recorte.

Regla:

- el icono normal puede mostrar el logo completo con texto;
- el maskable debe evitar cortes y fondo blanco;
- el maskable usa fondo opaco del tema oscuro (#0f172a o similar).

---

## 14. Principio rector

Si hay duda visual, preguntar:

> ¿Esto parece parte de un grimorio vivo, oscuro y arcano?

Si la respuesta es no, se ajusta.

El juego no debe parecer una plantilla de deckbuilder genérica.  
Debe parecer un libro maldito que el jugador está intentando reescribir.

---

## 15. Scrollbars coherentes

Las barras de scroll internas (listados de Grimorio/Cenizas, overlays largos) NO deben usar el estilo nativo gris del navegador. Deben integrarse gráficamente con el resto del juego.

Estilo obligatorio:

- Track: oscuro semitransparente (rgba(2, 6, 23, 0.4)), redondeado.
- Thumb: degradado vertical dorado → violeta (linear-gradient(180deg, var(--gold-soft), rgba(168, 85, 247, 0.6))), redondeado, con shadow interna sutil.
- Hover thumb: intensificar colores (var(--gold) → var(--purple-light)).
- Ancho: fino (~0.5rem / 8px). No grueso ni invasivo.
- Firefox fallback: scrollbar-width: thin; scrollbar-color: var(--gold-soft) rgba(2, 6, 23, 0.4);.

Regla extra para móvil vertical: reservar margen derecho (padding-right: 0.75rem) en los contenedores scrolleables (ej. .deck-list) para que la barra nunca tape el texto de los nombres de carta.

---

## 16. Estilo Visual Definitivo (Ruta 1)

Dirección estética confirmada: **línea clara + sombreado plano** (flat shading con outlines negros gruesos). Referencias visuales: *Hades*, *Slay the Spire*, *Inscryption* (cartas).

Características obligatorias de todas las ilustraciones (cartas, enemigos, mapa, tienda, UI):

- **Líneas negras gruesas** definiendo siluetas y detalles internos. Contraste alto contra fondos oscuros. Legibilidad garantizada incluso a tamaño pequeño (carta de mano).
- **Rellenos planos saturados**, sin gradientes suaves ni texturas fotorealistas. Los colores provienen exclusivamente de la paleta oficial (sección 2). La ilustración aporta forma y contraste, no introduce nuevos tonos fuera de tokens existentes.
- **Sombras duras laterales** (cel-shading básico): una sola dirección de luz implícita, sombra sólida de un tono inferior, sin penumbra difusa. Da volumen sin complicar producción.
- **Sin ruido visual**: nada de grano de película, manchas de tinta aleatorias ni bordes irregulares tipo acuarela. Eso rompería la consistencia entre piezas producidas por diferentes manos (humana o IA).
- **Coherencia temática**: todos los elementos comparten lenguaje gráfico. Si una carta tiene espadas estilizadas con filo recto, los iconos de ataque del HUD y las armas de los enemigos siguen esa misma geometría. Mezclar estilos (ej: pixel art en enemigos + vector en cartas) queda prohibido.

Nota técnica: este estilo facilita la producción digital (vector o raster con capas planas) y escala bien a APK nativo sin pérdida de nitidez en pantallas HD. Permite generar assets vía IA generativa (Midjourney/Stable Diffusion) con prompts específicos de "flat shading dark fantasy lineart" y post-proceso manual mínimo para homogeneizar trazos.

---

## 17. Alcance Final (APK Nativo, Pool Ampliado, Arte Completo)

El proyecto deja de ser prototipo/PWA ligera y evoluciona hacia **juego funcional distribuido como APK**, pensado inicialmente para uso personal pero con arquitectura preparada para futura comercialización.

Implicaciones directas:

- **Peso libre**: no hay restricción severa de tamaño. Se permiten PNG/JPG de alta resolución (≥512×768 px por carta), sin compresión agresiva ni spritesheets ultra-optimizadas. Prioridad: calidad visual > bytes ahorrados.
- **Pool de cartas objetivo**: **40–60 únicas**. Subido desde el rango inicial de 30-45 porque ahora hay margen real de almacenamiento y desarrollo. Esto permite cubrir todos los tipos básicos (ataque, defensa, poder, curación, maldición/corrupto) con variantes suficientes para builds reconocibles (aggro, control, sustain, burst…).
- **Arte completo**: ~50 cartas ilustradas + retratos/avatar de enemigos + iconografía de nodos del mapa procedural + UI de tienda/eventos + efectos visuales clave. Todo bajo Ruta 1 (sección 16). Producción gradual: empezar por pilares (~12–15 cartas fundamentales + primer boss), integrar, probar, expandir por sets temáticos.
- **Motor visual previsto**: GSAP + Canvas híbrido sobre DOM actual (fase G del roadmap). Mantiene inversión existente (HTML/CSS/JS) y añade capas de animación/partículas/transiciones cinematográficas sin refactorizar a Phaser/PixiJS desde cero. Opción abierta: migrar a motor gráfico puro si mañana se quisiera producción más ambiciosa (multijugador, shaders avanzados), pero hoy no es requisito.
- **Distribución**: empaquetado mediante Capacitor/Cordova para Android (APK). iOS posible pero secundario. Web/PWA sigue siendo canal de prueba rápido, pero el target final es instalación local nativa.
- **Comercialización**: no prioritaria ahora, pero scope diseñado para que mañana sea publicable sin rehacer cimientos técnicos ni estéticos.

Principio operativo: cada decisión técnica o artística debe responder a *"¿esto acerca el juego a un producto terminable y vendible?"*. Si la respuesta es no, se reconsidera antes de implementar.
