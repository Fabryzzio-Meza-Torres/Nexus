# Supabase — Persistencia de prototipo
Aplicar specs/data-model.md y specs/technical-architecture.md. Importar data/catalog.json mediante upsert por id; no borrar/recrear catálogo referenciado por listas. Nunca crear ofertas desde documentos consultados.
Para seed, leer/validar JSON en servidor, mapear columnas al contrato y upsert por id en una transacción. Repetir no duplica filas. Si cambia CSV, revisar diff y no eliminar ofertas usadas. El importador no despliega ni escribe en Supabase.
Aceptar tickets/finalizar mediante operación atómica (RPC con lock de selección, versión/estado/rol). No permitir escrituras transaccionales directas desde navegador. Auth real fuera de demo; rol simulado no es seguridad de producción. Secrets solo servidor. Realtime P1.
