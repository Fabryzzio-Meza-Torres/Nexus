# Nexus — Arquitectura 2h30
Monorepo pnpm; apps/web única app Next.js + TypeScript; packages/types opcional para contratos; specs/, scripts/catalog/, data/, supabase/migrations/. No backend separado, sin Turborepo obligatorio.
Preparación: CSV → importador Python estándar → catalog-taxonomy.json + catalog.json. Runtime: Gemini/mock → Requirement[] → matching TypeScript → match_proposals → comando de Proyectista → selections/selection_items.
Servicio único de acciones: createSelection, editItem, createChangeRequest, acceptChangeRequest, rejectChangeRequest, resolveReview, finalizeSelection. Cada comando recibe actor demo, idempotency/request ID y expectedVersion cuando muta lista; valida matriz de permisos y estado.
Repository Supabase o local implementa el mismo contrato transaccional. Supabase usa RPC para aceptación/cierre con lock de selections; no encadenar tres escrituras HTTP independientes. Local calcula próximo estado completo y persiste una vez en localStorage, sin estado parcial; sincronización multi-tab es P1.
Tablas: projects, catalog_items, requirements, match_proposals, selections, selection_items, change_requests, activity_log. No triggers de matching que escriban ítems.
Rol demo simulado validado por servicio; no es seguridad real. Sin escrituras directas del navegador a tablas transaccionales; credenciales privilegiadas solo servidor. Auth real y permisos de producción fuera de alcance.
Fallback visible; no cambiar de backend silenciosamente perdiendo estado. Realtime P1; pgvector, voz y almacenamiento complejo fuera de P0.
