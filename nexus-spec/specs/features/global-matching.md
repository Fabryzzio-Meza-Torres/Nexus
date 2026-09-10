# Feature — Matching global y cercanía
Requirement[] → candidatos del catálogo → propuesta global deduplicada con cobertura por requirement_id. Solo IDs existentes; ninguna escritura en lista oficial.
Filtrar tipo/categoría y excluir contradicciones técnicas conocidas. Conservar necesidades sin candidato como «Sin coincidencia», nunca sustituirlas por la oferta más cercana.
Deduplicar referencias al mismo requisito; agregar cantidades solo si son necesidades distintas con la misma oferta y unidad compatible. Alternativas dentro del detalle, no Top-10 como salida principal.
## Compatibilidad estimada [0,100]
45 puntos: category/type (15 categoría, 30 tipo normalizados); 30 especificaciones no dimensionales; 15 solapamiento de keywords; 10 dimensiones. Cada grupo técnico aporta peso × proporción de criterios requeridos que coinciden. Si no hay criterios o evidencia, aporta 0, no redistribuir su peso. Keywords: proporción de tokens requeridos presentes; sin tokens, 0. Sinónimos explícitos versionados, no inferencias de IA en runtime.
Datos ausentes van a unknown_fields; las razones no afirman coincidencias inexistentes. Esta puntuación es heurística, no probabilidad. Tipo + marca del CSV no bastan para validar desempeño técnico. Si todos los candidatos carecen de atributos, devolver candidatos para revisión, no un falso match perfecto.
## Ranking
Recomendados: compatibility_score DESC → distance_km ASC → catalog_item_id ASC. Más cercanos: distance_km ASC → catalog_item_id ASC. Aplicar ambos sobre el mismo conjunto elegible; no reintroducir incompatibles. Desconocidos permanecen etiquetados para revisión.
Distancia null se ordena al final. Si falta ubicación del proyecto, Recomendados usa compatibilidad y «Sin distancia»; deshabilitar Más cercanos y pedir configurar ubicación al Proyectista.
## Distancia
Haversine con radianes, R=6371 km, a=sin²(Δlat/2)+cos(lat1)cos(lat2)sin²(Δlon/2); d=2R atan2(√a,√(1−a)); limitar a a [0,1]. Ordenar con precisión completa, mostrar 1 decimal.
Distancia geográfica aproximada, sin ruta ni costo de flete. Coordenadas demo se indican. Ordenar/filtrar no reemplaza automáticamente productos oficiales ni altera prioridad.
