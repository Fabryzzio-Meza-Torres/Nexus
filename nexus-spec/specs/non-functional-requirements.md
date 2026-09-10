# Nexus — Requisitos no funcionales
| ID | Regla | Verificación |
|---|---|---|
| NFR-001 | Resiliencia | Fixture explícito permite demo sin API. |
| NFR-002 | Respuesta | Acciones locales objetivo <2 s; análisis muestra progreso. |
| NFR-003 | Integridad | IDs de catálogo válidos, proveedor/ubicación, FK y SKU único. |
| NFR-004 | Explicabilidad | Razones solo sobre evidencia disponible; sin porcentajes de certeza. |
| NFR-005 | Incertidumbre | Datos técnicos ausentes disparan revisión, nunca coincidencia ficticia. |
| NFR-006 | Consistencia de roles | Solo Proyectista crea/edita/finaliza; mismo estado al cambiar rol. |
| NFR-007 | Trazabilidad | Actor, rol, instante y antes/después; historial inmutable. |
| NFR-008 | Honestidad de datos | Datos sintéticos visibles como demo; Confianza del CSV no es verificación propia. |
| NFR-009 | Pantalla | Usable en laptop y sin desbordamiento móvil. |
| NFR-010 | Validación | TypeScript strict; Zod/validación equivalente en entradas externas. |
| NFR-011 | Fallos | Errores entendibles, reintento; no ocultar cambio a fixture. |
| NFR-012 | Secrets | Solo servidor; service-role nunca en cliente. |
| NFR-013 | Dependencias | Una app, sin infraestructura innecesaria. |
| NFR-014 | Claridad | Producto, proveedor, marca, compatibilidad y distancia separados. |
| NFR-015 | Demo determinista | Fixtures y resultados esperados conocidos. |
| NFR-016 | Distancia | Haversine, sin API; null al faltar coordenadas, nunca cero ficticio. |
| NFR-017 | Ranking | Compatibilidad y cercanía independientes, desempates estables. |
| NFR-018 | Atomicidad | Aceptación + ítem + versión + log en una transacción o actualización local indivisible. |
| NFR-019 | Concurrencia | Versión esperada, pending y draft comprobados dentro de la operación. |
| NFR-020 | Reproducibilidad | Importación repetida del mismo CSV produce JSON idéntico y seed idempotente. |
