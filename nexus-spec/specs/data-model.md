# Nexus — Modelo mínimo
IDs string estables para catálogo; UUID para entidades transaccionales. Fechas ISO UTC. Roles: logistics | project_designer | site_resident. No usar roles genéricos de editor.
## catalog_items
Una oferta producto + proveedor de demostración por fila, sin afirmar disponibilidad comercial real.
```ts
type Location = {district?: string; city: string; region?: string; country: string; latitude: number; longitude: number};
type CatalogItem = {
 id: string; sku: string; product_family_key: string;
 name: string; category: string; type_name: string; brand: string;
 description: string; specifications: Record<string, unknown>;
 supplier_name: string; supplier_logo_url: string | null;
 supplier_location: Location;
 provenance_type: 'synthetic'; is_demo_data: true;
 source_file: string; source_row: number; source_brand_column: string;
 source_confidence: string;
 field_provenance: {category: 'csv'; type_name: 'csv'; brand: 'csv'; supplier_name: 'synthetic'; supplier_location: 'synthetic'; specifications: 'unknown'};
};
```
Este contrato corresponde al seed actual. Una ampliación con ofertas verificadas exige fuente externa explícita y un cambio de contrato. No usar fichas de prueba para esa ampliación.
`sku` e `id` únicos. Coordenadas finitas lat [-90,90], lon [-180,180]. No confundir familia con equivalencia certificada.
## projects
id, name, project_location: Location|null, created_at. Ubicación elegida por Proyectista; cambios solo con lista ausente o draft, auditados. No cambiar prioridad/contenido al recalcular distancias.
## requirements
id, project_id, document_id, category, type_name, quantity:number|null, unit:string|null, specifications:object, keywords:string[], source_excerpt, confidence:number|null.
Cantidad desconocida queda null. No sumar unidades incompatibles ni menciones duplicadas del mismo requisito.
## match_proposals
id, project_id, document_id, created_at, candidates (requirement_ids, catalog_item_id, compatibility_score, reasons, unknown_fields, needs_review), unmatched_requirement_ids.
Generación y reanálisis solo escriben propuesta/requerimientos. Ningún trigger copia automáticamente a selection_items.
## selections
id, project_id UNIQUE, status:'draft'|'finalized', version:integer>=1,
created_by:string, created_by_role:'project_designer', created_at,
finalized_by:string|null, finalized_by_role:'project_designer'|null, finalized_at:null|timestamp,
coverage_resolutions: array de {requirement_id, reason, resolved_by, resolved_at} para exclusiones justificadas.
Una lista ausente se representa sin registro. No existe estado approved intermedio. finalized muestra «Lista lista para cotizar».
## selection_items
id, selection_id FK, catalog_item_id FK, requirement_ids:string[], quantity:number>0, unit:string,
priority:'high'|'medium'|'normal', compatibility_score:number[0,100], match_reasons:string[],
review_status:'clear'|'needs_review'|'resolved', review_note:string|null,
resolved_by:string|null, resolved_by_role:'project_designer'|null, created_at, updated_at.
UNIQUE(selection_id,catalog_item_id,unit). Cambiar producto o requisitos invalida review y recalcula score. Cantidad/unidad desconocida debe completarse explícitamente al crear el ítem.
## change_requests
id, selection_id FK, selection_item_id FK|null, requested_by:string, requested_by_role:'logistics',
type:'add_product'|'remove_product'|'replace_product'|'change_quantity'|'change_priority',
requested_value: discriminated payload, reason:string, status:'pending'|'accepted'|'rejected',
base_selection_version:integer, resolved_by:string|null, resolved_by_role:'project_designer'|null,
resolution_note:string|null, created_at, resolved_at:null|timestamp.
Payloads: add {catalog_item_id,quantity,unit,priority,requirement_ids}; remove {}; replace {catalog_item_id}; quantity {quantity}; priority {priority}.
Item obligatorio salvo add; pertenece a la misma selección. Reemplazo conserva cantidad/unidad/prioridad y referencias si son compatibles; si no, exigir nuevo ticket explícito. Rechazar destinos duplicados, cantidades no positivas, unidades incompatibles o IDs inexistentes.
Mantener referencias a ítems eliminados: soft delete o FK ON DELETE SET NULL y snapshot del ítem en ticket/log; un ticket cuyo objetivo fue eliminado no es aceptable.
## activity_log
id, project_id, selection_id|null, actor_id, actor_role, action, entity_id, request_id|null, before:object|null, after:object|null, created_at.
## Transacciones
Crear lista/ítems/log atómicamente solo como Proyectista. Toda mutación oficial incrementa version. Aceptar verifica draft, pending, rol y base_selection_version=version dentro del lock; aplica payload, incrementa versión, marca accepted y escribe log. Fallo revierte todo. Doble aceptación retorna resultado existente sin repetir cambio.
Versión obsoleta: 409, ticket sigue pending; Proyectista puede rechazar con motivo y Logística crear otro. Rechazar no altera ítems/versión. Finalizar bloquea la selección, valida pendientes/cobertura, incrementa versión y escribe sello/log en la misma operación.
