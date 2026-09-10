# Nexus — Hackathon 2h30 · CSV + Proyectista
Paquete actualizado desde nexus-hackathon-2h30-final.zip, con el adjunto CSV incorporado. Especificaciones e importador de datos; no una aplicación implementada.
Empieza por [START-HERE.md](START-HERE.md) y [CLAUDE.md](CLAUDE.md).
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

## Contenido
- [Producto](specs/spec.md), [usuarios](specs/users.md), [matriz](specs/roles-requirements-matrix.md), [funcionales](specs/functional-requirements.md), [no funcionales](specs/non-functional-requirements.md).
- [Modelo](specs/data-model.md), [arquitectura](specs/technical-architecture.md), [IA](specs/ai-spec.md), [UX](specs/ux.md).
- [Importación](specs/catalog-generator.md), CSV original en data/source/, catálogo y fixtures ya generados en data/.
- [Plan](specs/implementation-plan.md), [prompts](specs/prompts.md), [demo](specs/demo-plan.md), [aceptación](specs/acceptance-tests.md).
- [Cambios](CHANGELOG.md) y [verificación del paquete](VERIFICATION.md).
No confundir verificación del paquete/importador con pruebas de una app aún no implementada.
