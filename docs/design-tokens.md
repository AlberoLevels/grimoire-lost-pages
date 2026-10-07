# REGISTRO DE FEATURES — NUESTRO VIAJE

Fuente de verdad de las funcionalidades pedidas por el propietario.
Cada feature lleva ID, descripción, criterios de aceptación y fase.
Nada se implementa sin estar registrado aquí primero.

==================================================================
## DECISIONES CERRADAS (constancia, no renegociables sin orden expresa)
- Nombre de la app: "Nuestro Viaje" (se queda; atemporal e íntimo).
  Etiqueta del launcher: short_name con salto de línea; si la ROM lo muestra
  junto, se acepta (plan B disponible: short_name "Viaje").
- Transcripción de audios: Camino B (STT externo con consentimiento explícito
  al pulsar "Transcribir"), como WhatsApp.
- Minijuego: 1 contra 1 por turnos.
- Accesibilidad: set completo (tamaño de texto, alto contraste, filtro
  cálido/bajo brillo, grosor de líneas) vía variables CSS, sin romper diseño.
- Fullscreen en Vivo/OriginOS: se ACEPTA la franja al arranque (se retira
  bajando el panel una vez); SIN nudge de requestFullscreen y SIN cartel.
  En Android estándar el manifest (display: fullscreen) da pantalla completa
  limpia desde el arranque.
- Splash de entrada (avión cruzando la ruta + nombre): se conserva como
  ritual de marca, una vez por sesión.
- Reparto de roles de la pantalla Ruta: MAPA = lo visual y vivo;
  LÍNEA DE TIEMPO = el relato; DETALLES = el cuadro de mando numérico.
- Sistema de diseño: identidad PROPIA (azul noche + atardecer + melocotón +
  dorado, tipografía dual manuscrita+sans, tokens.css). NO es Material Design;
  solo se toma prestada la estética Material You para los widgets de clima.

==================================================================
## F-CHAT-01 · Mantener pulsado un mensaje → menú contextual
- Hoja inferior elegante al mantener pulsada una burbuja (~500 ms), con
  vibración suave si el dispositivo la soporta.
- Acciones v1: Copiar texto (solo mensajes de texto), Responder, Reaccionar
  con PICKER COMPLETO (todos los emojis Unicode, categorías + buscador),
  Eliminar.
- Catálogo de emojis en src/lib/emoji-data.js (Unicode, dominio público),
  cacheado offline; el glifo lo dibuja la fuente del sistema de cada móvil.
- Una reacción por persona por mensaje; pulsar la propia la quita/cambia.
- La reacción se muestra como píldora pequeña bajo la burbuja.
- Fase: esquema `reactions` en FASE 2; UI + picker en FASE 3.

## F-CHAT-02 · Deslizar para responder
- Arrastre horizontal (hacia la derecha) sobre una burbuja muestra affordance
  de respuesta (flecha + previsualización); al soltar, el composer entra en
  modo respuesta con cita encadenada (reply_to), cancelable.
- El mensaje enviado renderiza la cita como snippet sobre la burbuja.
- Alternativa accesible: acción "Responder" en el menú de F-CHAT-01.
- Fase: FASE 3.

## F-CHAT-03 · Doble hora España ↔ Izcalli en el chat (no agresiva)
- Línea fina y atenuada bajo la cabecera del chat:
  `Sevilla 22:45 · Izcalli 15:45` (tipografía pequeña, color text-dim).
- Sin segundos: se actualiza al cambiar el minuto.
- Horarios reales vía Intl.DateTimeFormat con timeZone
  (Europe/Madrid, America/Mexico_City).
- Zonas horarias en config.js (cityA.tz / cityB.tz) → Norma 2.
- Fase: FASE 3.

## F-CHAT-04 · Indicador "escribiendo…"
- Cuando la otra persona teclea, indicador discreto ("escribiendo…") en el
  chat, sin contenido del mensaje.
- Canal de presencia/estado efímero de Supabase Realtime (no se persiste).
- Fase: FASE 3.

## F-CHAT-05 · Indicador "grabando audio" de la otra persona
- Cuando la otra persona mantiene pulsado el micro, en mi pantalla aparece
  abajo el icono de micro ("grabando audio…"), estilo WhatsApp.
- Reutiliza el canal de presencia de F-CHAT-04 con tipo `audio`.
- Fase: FASE 5.

## F-CHAT-06 · Checks estilo WhatsApp
- 1 check = enviado al servidor; 2 checks = entregado a su dispositivo;
  2 checks AZULES = leído.
- Basado en delivered_at / read_at que actualiza el receptor vía RPC.
- Fase: FASE 3.

## F-ACC-01 · Accesibilidad para queratocono
- Panel "Accesibilidad" (en Más + acceso rápido discreto en el chat) con:
    · Tamaño de texto escalable.
    · Alto contraste.
    · Filtro cálido / bajo brillo (fotofobia).
    · Grosor de líneas e iconos reforzado.
- Preferencia persistida POR DISPOSITIVO (localStorage), no sincronizada
  entre móviles (es una preferencia de cada ojo).
- Implementado con variables CSS y atributos en <html>; el sistema de tokens
  de FASE 1 ya nace preparado para escalar; identidad visual intacta.
- Fase: micro-entrega de accesibilidad al cerrar FASE 1.

## F-GAME-01 · Minijuego trivial Sevilla ↔ Izcalli (1v1 por turnos)
- Sección de preguntas tipo "Preguntados" con temática Sevilla / Izcalli.
- Banco de preguntas editable (set inicial generado + ampliación del dueño).
- Puntuaciones y turnos en Supabase; sin servicio externo.
- Modo CERRADO: 1 contra 1 por turnos.
- Fase: FASE 11 (extras y pulido).

## F-AUD-01 · Transcripción de audios (Camino B)
- Al pulsar "Transcribir", ese audio concreto se descifra en el dispositivo y
  se envía a un STT gratuito (Groq/Whisper, capa gratuita, procesamiento
  efímero, sin retención). El resto del audio sigue cifrado E2E.
- Consentimiento explícito por uso; nunca automático.
- Fase: FASE 5.

## F-WX-01 · Clima de cada ciudad (Open-Meteo, sin API key)
- Proveedor Open-Meteo: gratis, SIN API key, ~10k llamadas/día; cache corto.
- Reutiliza lat/lng de config.js.
- Puntos de consumo:
    · Widgets de clima de la pestaña Mapa (F-MAP-01).
    · Ficha técnica de la pestaña Detalles (F-MAP-01).
    · Chat, junto a la doble hora de F-CHAT-03 (discreto).
- Fase: FASE 3 (chat) y FASE 8 (Mapa + Detalles).

## F-MAP-01 · Enriquecer pestaña Mapa + widgets de clima apilados; Detalles = cuadro numérico
- PESTAÑA MAPA:
    (1) Mejoras visuales del mapa: progreso real (estela sólida en lo
        recorrido + punteado en lo pendiente), curva con degradado
        melocotón→dorado + glow, estela que se desvanece detrás del avión,
        leyenda sutil despegue → crucero → aterrizaje.
    (2) DEBAJO del mapa: DOS WIDGETS DE CLIMA APILADOS verticalmente (uno por
        ciudad, a ancho completo), estilo widget Android (Material You):
        fondo translúcido + blur, esquinas muy redondeadas. Cada widget lleva:
        nombre de ciudad + bandera, HORA LOCAL viva (actualiza al minuto),
        icono de clima grande, temperatura grande en melocotón, condición en
        texto pequeño y mín/máx en miniatura.
        (Apilados, no lado a lado: en móvil estrecho aprovechan el ancho y se
        leen como widgets nativos de Android.)
    Nota: el SVG del mapa es componente compartido con el Inicio, así que las
    mejoras visuales del SVG benefician a ambos; los widgets viven SOLO en la
    pestaña Mapa de Ruta.
- PESTAÑA DETALLES (cuadro de mando numérico, como estaba previsto):
    (1) Estado de la ruta: distancia total, recorrida, restante y % del viaje
        (o "fecha por confirmar").
    (2) Clima DETALLADO por ciudad (temp, condición, mín/máx) como ficha técnica.
    (3) Hora local de cada ciudad.
    (4) Coordenadas completas de cada ciudad.
    (5) Año del encuentro.
    Nota: hora y clima aparecen en Mapa (vistazo vivo en los widgets) y en
    Detalles (ficha técnica) con profundidades distintas, por decisión del
    propietario; si más adelante sobra en una, se recorta en una línea.
- PESTAÑA LÍNEA DE TIEMPO: sin cambios (hitos + avión + frase).
- Backlog (no v1): zoom/pellizco; vuelo real en vivo (APIs de pago).
- Reusa F-WX-01 (Open-Meteo) y las tz de config.js (la hora viva de los
  widgets usa esas mismas zonas horarias).
- Fase: FASE 8 (con micro-entrega enriquecida adelantable).

## F-TOOL-01 · Setup Wizard de clonado (SOLO propietario)
- Ruta separada no enlazada desde la app: /tools/setup.html.
- Acceso con passphrase del propietario (hash embebido; puerta entornada, no
  bóveda: protege un formulario vacío, no datos reales; los datos de cada
  pareja viven en su repo privado de GitHub y en Supabase con RLS).
- Formulario con todos los campos de la plantilla (nombres, ciudades,
  coordenadas, zonas horarias, fecha del viaje, textos, slots de iconos,
  rutas de assets) + subida de los assets de esa pareja (2 iconos, foto de
  fondo).
- Previsualización en vivo de bienvenida + Inicio con esos datos, antes de
  generar nada.
- Export: config.js generado listo para el repo clonado (+ opcional ZIP con
  config y assets renombrados). Todo client-side, 0 €.
- Fase: FASE 12 · Plantilla y clonado.

## F-SEC-01 · KILL SWITCH (recordatorio permanente)
- Apagado de emergencia de toda la app, server-side: Edge Function + secreto
  maestro guardado en la NOTA PRIVADA del propietario.
- JAMÁS un botón, texto o pista en ninguna UI interna.
- Al activarse: la app deja de servir contenido y las claves E2EE se
  invalidan; los datos permanecen cifrados e ilegibles.
- Fase: FASE 9 (esqueleto desde FASE 2, integración con claves en FASE 9).

## F-INSTALL-01 · Onboarding de instalación multi-navegador
- Objetivo: que instalar la PWA cueste 1 toque (Chromium) o 2 toques guiados
  (iOS/Firefox), sin asumir que el navegador de ella es Chrome.
- Chromium: capturar `beforeinstallprompt` y mostrar banner propio elegante
  ("Instala Nuestro Viaje" + botón melocotón); al pulsar, prompt nativo.
- iOS/Safari y Firefox: detectar plataforma y mostrar guía visual de 2 toques
  (Compartir → Añadir a pantalla de inicio / Menú → Añadir), con iconos.
- Si ya está instalada (display-mode: standalone), no mostrar nada.
- No existe auto-instalación sin gesto (limitación de seguridad de todos los
  navegadores); esto es lo más cercano permitido.
- Fase: FASE 1 (es UI de onboarding, sin backend) o FASE 2 junto al arranque.

==================================================================
## BACKLOG (mejoras opcionales, NO comprometidas para v1)
- Fijar mensajes destacados.
- Mostrar "hora local de ella" al componer un mensaje.
- Zoom/pellizco en el mapa; vuelo real en vivo (APIs de pago).
