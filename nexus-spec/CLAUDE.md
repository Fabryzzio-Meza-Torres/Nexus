# Nexus — Contrato de implementación · 2h30
Construye un prototipo B2B para constructoras en una app Next.js + TypeScript dentro de un monorepo pnpm. Una aplicación desplegable, sin backend separado.
Demo funcional > estabilidad > claridad > integraciones > polish.
Lee START-HERE.md, specs/spec.md, specs/data-model.md y la feature antes de implementar.
El contrato de diseño de la interfaz (tokens, densidad de trabajo, accesibilidad, etiquetas concretas) está en specs/ux.md § «Contrato de diseño» y aplica en todos los pasos.
## Contrato vigente
- El CSV `data/source/catalogo-marcas-por-tipo.csv` es el input principal del catálogo. Contiene clasificación y marcas, no ofertas verificadas.
- Las fichas técnicas son exclusivamente documentos de prueba para extraer requerimientos y buscar/matchear contra el catálogo. Nunca alimentan su construcción ni enriquecimiento.
- La IA produce `Requirement[]`. El matching produce una propuesta global separada; no escribe la lista oficial.
- Proyectista (`project_designer`) crea la lista oficial desde la propuesta, es su único editor directo, resuelve revisiones y acepta/finaliza la lista.
- Logística (`logistics`) carga documentos, consulta, ordena/filtra y solicita cambios mediante tickets. Sus solicitudes no mutan la lista.
- Al aceptar un ticket, el Proyectista aplica su cambio y registra la aceptación en una única operación atómica. Rechazar conserva la lista.
- Residente (`site_resident`) consulta y revisa contexto. No edita, resuelve tickets ni finaliza.
- Cada oferta tiene proveedor obligatorio y ubicación. Marca y proveedor son campos distintos. Los proveedores/coordenadas ficticios llevan etiqueta visible de demo.
- Ranking Recomendados: compatibilidad descendente, luego distancia ascendente. Más cercanos: distancia ascendente, manteniendo visible la compatibilidad y las alertas.
- Una lista por proyecto; cambiar rol o filtros no cambia su contenido ni prioridad oficial. Roles simulados, sin Auth/RBAC real; validar acciones en el servicio además de la UI.

## Ejecución
Implementa slices completos con fixtures primero; Supabase después; Gemini con Zod y fallback explícito después. Si una integración bloquea más de 10 minutos, conserva el repositorio local y sigue.
No construir Auth empresarial, voz, pagos, ERP/BIM, marketplace público, queues, LangChain o pgvector obligatorio. No introducir dependencias innecesarias. Secrets solo en servidor.
No reducir los permisos a ocultar botones. Centraliza guardas de rol/estado y aceptación atómica en ambos repositorios.
## Definition of done
Importar CSV; mostrar propuesta global con proveedor/distancia; crear lista como Proyectista; pedir cambio como Logística y comprobar que no cambió; aceptar como Proyectista y comprobar mutación única; rechazar otro y conservar contenido; resolver ambigüedad; finalizar como Proyectista; refrescar y verificar persistencia. Residente solo consulta.
Ejecuta typecheck, lint, build y pruebas de aceptación relevantes. No afirmes haber probado la app si solo generaste especificaciones.
