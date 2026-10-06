# Design System: Intercambio GS · Noche

## 1. Visual Theme & Atmosphere
Una app nocturna y privada, como abrir un regalo en un cuarto oscuro. Fondo casi negro con un solo brillo rojo que deriva muy lento detrás del contenido, como una luz de navidad desenfocada. Las superficies son placas de vidrio ahumado dentro de una bandeja (doble marco), con bordes de luz de 1px. Lo importante es el secreto: los nombres se ven borrosos hasta que tú decides verlos.

- Densidad 3, "Daily App airy": una sola columna, mucho aire entre bloques.
- Variación 6: alineado a la izquierda, tipografía grande contra texto pequeño.
- Movimiento 6: física y momentos clave con GSAP, sin entradas escalonadas. El único loop perpetuo es el brillo de fondo.
- Solo modo oscuro: la identidad depende de la noche (`color-scheme: dark`).

## 2. Color Palette & Roles
- **Noche** (#08090A): fondo de toda la app.
- **Vidrio** (rgba(255,255,255,0.035)): bandeja exterior del doble marco.
- **Núcleo** (#121315 al 92%): placa interior donde vive el contenido.
- **Filo de luz** (rgba(255,255,255,0.08)): bordes de 1px y divisores.
- **Tiza** (#EDEDEF): texto principal y fondo del botón primario.
- **Humo** (#9A9BA1): texto secundario, metadatos y placeholders (7:1 sobre Noche).
- **Brasa** (#FF4530): único acento. Círculo del CTA, brillo de fondo, indicadores de "nuevo". Como texto se usa **Brasa clara** (#FF6B5E) para pasar contraste AA.

Nada de morado, neón ni negro puro. El error también usa Brasa: un solo acento para todo lo que se toca.

**Decoración navideña** (nunca en botones, textos ni estados; solo ambiente):
- **Pino** (#3FB37F): arbolito de la marca y el brillo de abajo a la izquierda (rgba(46,160,103,0.16)).
- **Focos** de la serie de luces: Brasa (#FF4530), Dorado (#F4C26B), Pino (#3FB37F) y Cálido (#FFF1D6).
- **Nieve**: blanco con opacidad de 0.3 a 0.85.

## 3. Typography Rules
- **Display y cuerpo:** Geist. Títulos en peso 600 con tracking cerrado (-0.045em) y altura de línea 1.02. La jerarquía la dan el peso y el color (Tiza contra Humo), no solo el tamaño.
- **Mono:** Geist Mono, solo para datos: días restantes, presupuesto, precios.
- **Prohibido:** Inter, cualquier serif (es UI de software), mayúsculas con tracking amplio como etiqueta en cada sección.

## 4. Component Stylings
- **Liquid glass:** la bandeja de vidrio lleva desenfoque 16px, saturación 180% y brillos especulares en el filo superior. En Chromium se suma refracción real con un filtro SVG de desplazamiento, que tiembla con resorte al tocarlo. Con `prefers-reduced-transparency` se vuelve sólido (#16171A). Se usa en la barra superior, las tarjetas, los botones secundarios y los campos.
- **Doble marco (Bezel):** bandeja exterior de liquid glass, padding 6px y radio 32px. Adentro, el Núcleo con radio 26px (concéntrico) y un brillo interior `inset 0 1px 1px rgba(255,255,255,0.07)`. Es la tarjeta de todo lo importante.
- **Botón primario:** píldora Tiza con texto Noche, altura 58px. El ícono va en su propio círculo Brasa pegado al borde derecho; con el cursor solo ese círculo se mueve, nunca el botón. Al presionar baja a `scale(0.98)`.
- **Botón secundario:** píldora de liquid glass con texto Tiza.
- **Revelar:** el nombre de tu persona aparece con `blur(16px)` y opacidad 0.55. Se ve solo mientras mantienes presionado (o con Enter/Espacio desde el teclado), con una vibración corta en Android. El texto siempre está en el DOM para lectores de pantalla.
- **Regla de forma:** todo lo interactivo es píldora (radio completo); las tarjetas usan 32px por fuera y 26px por dentro. Nada de esquinas de 16px.
- **Campos agrupados:** un input y su botón viven en una sola píldora de Vidrio, con el botón acoplado adentro a la derecha (círculo Brasa de 44px). Si son dos inputs para una acción, van en un grupo de 28px separados por un filo de 1px.
- **Inputs sueltos:** píldora con fondo Vidrio, borde Filo y foco Tiza. Etiqueta arriba, error abajo.
- **Burbujas de chat:** las tuyas son Tiza sobre Noche y las otras son Núcleo con borde Filo. Radio 20px.
- **Estados vacíos:** una frase que dice qué hacer, dentro de un marco punteado.

## 5. Layout Principles
Una columna de máximo 448px centrada, con márgenes de 20px. Barra superior con un botón circular de regreso de vidrio. Los bloques se separan con 18 a 32px y nunca con líneas en cada fila. El CTA principal vive abajo, al alcance del pulgar. Áreas táctiles mínimas de 44px.

## 6. Motion & Interaction
Motor: GSAP 3 (SplitText, ScrambleText y Flip) con `@gsap/react`. La capa global vive en `app/motion.tsx`.
- Curvas: `expo.out` para entradas, `elastic.out` para regresos de física y `back.out` para burbujas.
- Carga de una: nada de entradas escalonadas ni contenido oculto esperando a GSAP. Las pantallas se precargan completas (`<Link prefetch={true}>`) y aparecen al instante. El movimiento se reserva para momentos con significado.
- Login: "Saca tu papelito." sube letra por letra desde una máscara (primera impresión, una sola vez).
- Chat: lo que ya estaba se muestra de una; solo las burbujas nuevas entran con resorte.
- Revelar: mantener presionado llena un anillo en 0.6 s; al completarse, el nombre se descifra (ScrambleText), se quita el desenfoque y la primera vez saltan 26 chispas Brasa.
- Sortear: las fichas de participantes se barajan con Flip seis veces y regresan a su orden antes de enviar.
- Cursor (solo pointer fino): el círculo del ícono del CTA se mueve hacia el cursor, pero el botón no se mueve para no romper su grupo. Las tarjetas se inclinan hasta 4° con una luz que sigue al cursor, y el brillo de fondo sigue al cursor con 3 s de inercia.
- Navegación: el nombre del intercambio se transforma de la lista al detalle con `<ViewTransition>`.
- Navidad (CSS, capas fijas y solo `transform` u `opacity`): serie de 12 focos colgando arriba que parpadean a destiempo (2.6 s, escalonados); nieve en dos capas con profundidad (45 s y 28 s); el brillo pino deriva al revés que el rojo. La barra de vidrio refracta los focos.
- Todo se apaga con `prefers-reduced-motion`. Solo se animan `transform`, `opacity` y `filter`.

## 7. Anti-Patterns (Banned)
Emojis, Inter, serifs, negro puro, brillos neón alrededor de botones, gradientes en texto, más de un acento, tarjetas de 3 columnas iguales, guiones largos en textos, nombres genéricos, íconos dibujados a mano (solo Phosphor) y spinners circulares (usar esqueletos).
