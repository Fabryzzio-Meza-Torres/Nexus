# Nexus — UX
Una pantalla /demo: encabezado con proyecto, ubicación, selector Logística/Proyectista/Residente y estado. Etapas: Documento → Propuesta → Lista oficial → Finalizada.
Tarjeta: producto, marca, categoría, SKU, proveedor/monograma, distrito/ciudad, distancia aproximada, «Datos demo», compatibilidad estimada, razones y datos desconocidos, cantidad/unidad, prioridad, revisión.
Filtros categoría/proveedor y orden Recomendados/Más cercanos disponibles a todos. Orden visual independiente de prioridad persistida. Coordenadas faltantes: «Sin distancia»; nunca 0 km artificial.
Propuesta: solo Proyectista ve «Crear lista oficial». Antes de esa acción no hay selección oficial.
Lista draft: Proyectista ve Editar/Reemplazar/Eliminar/Agregar; Logística ve Solicitar cambio; Residente vista de consulta. No mostrar cantidad editable a Logística. Mostrar actual 20 / solicitado 25 / pendiente.
Bandeja de Proyectista: tickets con antes/después y razón, Aceptar/Rechazar; revisión técnica con alternativas y justificación. Conflicto de versión ofrece actualizar vista y rechazar/recrear petición.
Botón de cierre exclusivo «Aceptar y finalizar lista», bloqueado con detalle de tickets/revisiones/faltantes. Lista finalizada: «Aceptada por Proyectista · Lista lista para cotizar», controles de escritura ausentes.
Actividad: «Logística solicitó 25 unidades» → «Proyectista aceptó: 20 → 25» → «Proyectista finalizó la lista». Residente consulta actividad.
Estados: vacío, cargando, sin coincidencia, extracción fallida, fixture activo, conflicto, sin distancia. Diseño legible y navegable con teclado; labels y texto además de color. Cotización automática fuera de alcance.

## Contrato de diseño
Referencia: https://github.com/funboy322/avoid-ai-design (guía; accesibilidad, claridad y consistencia priman sobre evitar un patrón por estética).
La calidad visual es parte de cada funcionalidad, no un paso final. Revisión visual global en el paso 7; mejoras pequeñas en cada paso.
- Herramienta de trabajo, no landing. Superficies claras y neutras, texto oscuro, un acento sobrio para acciones. Encabezado compacto.
- Estados con color diferenciado **y** texto o icono. Contraste AA, foco visible, blancos de interacción ≥ 24 px, navegable con teclado.
- Tipografía legible con jerarquía evidente; números tabulares y alineados para comparar. No cambiar tipografía ni librería solo por diferenciarse.
- Densidad de trabajo: listas extensas como filas o tablas comparables con detalle desplegable; tarjeta solo cuando mejora la lectura real.
- Tokens compartidos de color, espaciado, borde, radio y control; mismos componentes en todas las pantallas.
- Sin gradientes, transparencias, sombras ni radios grandes por defecto. Sin métricas, gráficos ni texto de relleno. Sin iconos decorativos repetidos.
- Etiquetas concretas: «Solicitar cambio», «Aceptar solicitud», «Rechazar solicitud», «Crear lista oficial», «Aceptar y finalizar lista».
- El diseño debe hacer evidentes: proyecto y rol activos; propuesta vs. lista oficial; producto/marca/proveedor por opción; compatibilidad, distancia y datos desconocidos como conceptos separados; qué es demo; qué acciones permite el rol; qué cambió, qué falta y el siguiente paso.
- Incluir estados de carga, vacío, error, éxito y bloqueo donde correspondan. No rehacer la interfaz en cada paso; reutilizar y mejorar.
Este contrato no altera las reglas funcionales ni la matriz de permisos (specs/roles-requirements-matrix.md, specs/functional-requirements.md).

### Notas de la implementación demo
- **Subida real de documentos**: Logística sube PDF / Markdown / TXT o pega texto. El servidor lee el texto real y extrae `Requirement[]` con un analizador determinista (motor principal, offline) o con Gemini si hay `GEMINI_API_KEY` (timeout 7 s, cae al analizador). El importador del catálogo nunca lee estos documentos.
- **Especificaciones sintéticas**: el seed genera specs técnicas demo por tipo (`field_provenance.specifications: "synthetic"`) para que la compatibilidad varíe (≈60–100). No acreditan desempeño; la UI las rotula como demo. Umbral de revisión = 70 (specs/features/technical-review.md).
- **Overlay de análisis**: mientras corre la extracción se muestra una secuencia animada («Leyendo → Interpretando la obra → Consolidando requerimientos → Buscando en catálogo → Calculando compatibilidad y cercanía»). Es teatro de presentación con duración controlada; el resultado es real. Pasos y tiempos configurables en `apps/web/src/components/AnalysisOverlay.tsx` (`ANALYSIS_STEPS`).
- **Motores de extracción**: IA (Gemini) → analizador determinista del texto → conjunto de partidas de demostración (`curatedRequirements`). El resultado de la IA se ajusta al vocabulario del catálogo (`reconcileWithCatalog`). Se elige el primero que dé ≥3 partidas con ≥40% de cantidades.
- **Estilo**: negro + naranja + texto blanco, tipografía Inter, iconos `lucide-react`. Estructura de pantallas tomada del prototipo de hackathon: Carga → Análisis → App (header con banda de estadísticas, stepper, tablas). El extracto del expediente vive en el botón «Detalle» de cada fila, no en una columna. Prioridad se muestra Alta/Media/Baja.
