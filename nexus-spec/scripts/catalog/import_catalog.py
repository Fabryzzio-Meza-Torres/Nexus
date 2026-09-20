"""Importación determinista del CSV: taxonomía real de entrada, ofertas sintéticas de demo.

Nota de desviación (autorizada por el usuario): specs/catalog-generator.md dice
specifications={}. Para que la compatibilidad varíe en la demo, cada oferta recibe
especificaciones técnicas SINTÉTICAS, deterministas, marcadas como tales
(field_provenance.specifications='synthetic', is_demo_data=True). No provienen del CSV
ni de fichas técnicas; son datos de demostración y la UI los rotula como tales.
"""
from pathlib import Path
import csv, json, hashlib, unicodedata
from collections import Counter
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'data/source/catalogo-marcas-por-tipo.csv'
HEADERS = ['Especialidad','Tipo','Marca 1','Marca 2','Marca 3','Confianza']

def clean(value):
    return unicodedata.normalize('NFC', (value or '').strip())
def key(value):
    return clean(value).casefold()
def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:20]
def save(name, value):
    (ROOT/'data'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# --- Vocabulario de especificaciones sintéticas -----------------------------
# Claves dimensionales deben coincidir con DIMENSION_KEYS de matching.ts.
SPECS_BY_TYPE = {
    ('Sanitaria','Inodoros'): {
        'descarga': ['dual 3/6L','6L','4.8L'],
        'montaje': ['piso','pared'],
        'material': ['porcelana vitrificada','cerámica esmaltada'],
        'alto': ['78 cm','80 cm','76 cm'],
    },
    ('Sanitaria','Lavatorios'): {
        'montaje': ['sobre encimera','pedestal','empotrado'],
        'material': ['porcelana','cerámica'],
        'rebose': ['con rebose','sin rebose'],
        'ancho': ['50 cm','55 cm','60 cm'],
    },
    ('Eléctrica','Tomacorrientes'): {
        'amperaje': ['16A','20A','10A'],
        'tension': ['220V','220V','110V'],
        'polos': ['2P+T','2P+T','2P'],
        'montaje': ['empotrar','superficie'],
    },
    ('Eléctrica','Interruptores / apagadores'): {
        'modulos': ['simple','doble','triple'],
        'tension': ['220V','220V','110V'],
        'montaje': ['empotrar','superficie'],
        'material': ['termoplástico','policarbonato'],
    },
    ('Mecánica','Extractores de aire axiales'): {
        'caudal': ['300 m3/h','500 m3/h','800 m3/h'],
        'nivel_ruido': ['35 dB','40 dB','45 dB'],
        'alimentacion': ['220V monofásico','220V monofásico','110V'],
        'diametro': ['20 cm','25 cm','30 cm'],
    },
    ('Mecánica','Extractores centrífugos'): {
        'caudal': ['600 m3/h','1000 m3/h','1500 m3/h'],
        'presion': ['150 Pa','250 Pa','400 Pa'],
        'transmision': ['directa','por faja'],
        'diametro': ['25 cm','31 cm','35 cm'],
    },
}
GENERIC_BY_CATEGORY = {
    'Sanitaria': {'material': ['acero inoxidable','bronce','latón cromado','PVC'],
                  'presion_trabajo': ['40 psi','60 psi','80 psi']},
    'Eléctrica': {'tension': ['220V','380V','110V'],
                  'grado_proteccion': ['IP20','IP44','IP65']},
    'Mecánica': {'potencia': ['1 HP','2 HP','5 HP','10 HP'],
                 'alimentacion': ['220V monofásico','380V trifásico']},
}

def specs_for(category, type_name, row_number, brand_n):
    schema = SPECS_BY_TYPE.get((category, type_name)) or GENERIC_BY_CATEGORY.get(category, {})
    out = {}
    for i, (k, opts) in enumerate(schema.items()):
        out[k] = opts[(row_number + brand_n + i) % len(opts)]
    return out

# Plan de especificaciones por requerimiento demo:
#  'match'   -> pide 2 no-dim + 1 dim con el valor opts[0] (algún proveedor coincide)
#  'strict'  -> además pide un valor inalcanzable -> todos los candidatos van a revisión
REQ_SPEC_PLAN = ['match','match','match','match','strict','strict']

DIMENSION_KEYS = {'largo','ancho','alto','diametro','diámetro','profundidad','espesor','peso'}

def req_specs_for(category, type_name, plan):
    schema = SPECS_BY_TYPE.get((category, type_name)) or GENERIC_BY_CATEGORY.get(category, {})
    keys = list(schema.keys())
    nondim = [k for k in keys if k not in DIMENSION_KEYS]
    dim = [k for k in keys if k in DIMENSION_KEYS]
    picked = nondim[:2] + dim[:1]
    out = {k: schema[k][0] for k in picked}
    if plan == 'strict':
        # exige valores que ninguna oferta tiene + un dato desconocido:
        # ningún candidato supera el umbral -> revisión técnica obligatoria del Proyectista
        for k in picked:
            out[k] = schema[k][0] + ' grado verificado'
        out['certificacion'] = 'ficha técnica del fabricante'
    return out

def main():
    with SOURCE.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        if reader.fieldnames != HEADERS:
            raise ValueError(f'Encabezados inesperados: {reader.fieldnames}')
        raw=list(reader)
    taxonomy=[]; catalog=[]; seen=set(); skipped=0
    places=[
        ('Cassinelli','Cercado de Lima',-12.0464,-77.0428),
        ('Sodimac Perú','Ate',-12.0263,-76.9199),
        ('Promart Homecenter','Villa El Salvador',-12.2133,-76.9377),
    ]
    for row_number,row in enumerate(raw,2):
        if None in row: raise ValueError(f'Columnas extra en registro {row_number}')
        row={k:clean(v) for k,v in row.items()}
        if not any(row.values()): continue
        if not row['Especialidad'] or not row['Tipo']: raise ValueError(f'Clasificación incompleta: {row_number}')
        for n in range(1,4):
            brand=row[f'Marca {n}']
            if not brand: continue
            identity='|'.join(map(key,[row['Especialidad'],row['Tipo'],brand]))
            if identity in seen: skipped+=1; continue
            seen.add(identity)
            family='family-'+digest('|'.join(map(key,[row['Especialidad'],row['Tipo']])))
            tax={'id':'tax-'+digest(identity),'category':row['Especialidad'],'type_name':row['Tipo'],'brand':brand,'source_row':row_number,'source_brand_column':f'Marca {n}','source_confidence':row['Confianza']}
            taxonomy.append(tax)
            zone,district,lat,lon=places[n-1]
            cid='demo-'+digest(identity)
            catalog.append({
                'id':cid,'sku':cid.upper(),'product_family_key':family,
                'name':f"{brand} · {row['Tipo']}",
                'category':row['Especialidad'],'type_name':row['Tipo'],'brand':brand,
                'description':'Oferta ficticia para demostración. Modelo y disponibilidad no verificados.',
                'specifications':specs_for(row['Especialidad'],row['Tipo'],row_number,n),
                'supplier_name':zone,
                'supplier_logo_url':None,
                'supplier_location':{'district':district,'city':'Lima','region':'Lima','country':'PE','latitude':lat,'longitude':lon},
                'provenance_type':'synthetic','is_demo_data':True,
                'source_file':'data/source/catalogo-marcas-por-tipo.csv',
                'source_row':row_number,'source_brand_column':f'Marca {n}','source_confidence':row['Confianza'],
                'field_provenance':{'category':'csv','type_name':'csv','brand':'csv','supplier_name':'synthetic','supplier_location':'synthetic','specifications':'synthetic'}
            })
    assert len(catalog)>=30, 'Se requieren al menos 30 ofertas para la demo'
    assert len({x['id'] for x in catalog})==len(catalog)
    assert len({x['sku'] for x in catalog})==len(catalog)
    assert all(x['specifications'] for x in catalog), 'Toda oferta debe tener especificaciones sintéticas'
    assert all(x['supplier_name'] and x['supplier_location']['city'] and -90<=x['supplier_location']['latitude']<=90 and -180<=x['supplier_location']['longitude']<=180 for x in catalog)
    families={}
    for x in catalog: families.setdefault(x['product_family_key'],set()).add(x['supplier_name'])
    multi=sum(len(v)>=2 for v in families.values())
    assert multi>=3
    save('catalog-taxonomy.json',taxonomy); save('catalog.json',catalog)

    chosen=[]
    for category in dict.fromkeys(x['category'] for x in taxonomy):
        types=list(dict.fromkeys(x['type_name'] for x in taxonomy if x['category']==category))[:2]
        for t in types:
            idx=len(chosen)
            qty=20 if idx==0 else 6
            plan=REQ_SPEC_PLAN[idx] if idx < len(REQ_SPEC_PLAN) else 'match'
            specs=req_specs_for(category,t,plan)
            spec_txt=', '.join(f'{k} {v}' for k,v in specs.items()) if specs else ''
            excerpt=f'{qty} unidades de {t}'+(f' ({spec_txt})' if spec_txt else '')
            chosen.append({'id':f'req-demo-{idx+1}','project_id':'project-demo','document_id':'document-demo',
                           'category':category,'type_name':t,'quantity':qty,'unit':'unidad',
                           'specifications':specs,'keywords':[t],
                           'source_excerpt':excerpt,'confidence':1})
    save('demo-requirements.json',chosen)
    save('demo-project.json',{'id':'project-demo','name':'Obra de demostración','project_location':{'city':'Lima','district':'Miraflores','country':'PE','latitude':-12.1211,'longitude':-77.0298},'is_demo_data':True})

    doc_lines=['# Lista de materiales de prueba — DEMO','',
               'Documento sintético para probar la interpretación de Nexus. No es una lista de materiales real.','',
               '## Partidas','']
    for x in chosen:
        doc_lines.append(f"- {x['category']}: {x['source_excerpt']}.")
    (ROOT/'data/demo-document.md').write_text('\n'.join(doc_lines)+'\n',encoding='utf-8')

    stats={'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'rows':len(raw),'associations':len(taxonomy),'offers':len(catalog),'unique_brands':len({key(x['brand']) for x in taxonomy}),'specialties':dict(Counter(row['Especialidad'] for row in raw)),'multi_supplier_families':multi,'duplicates_skipped':skipped,'confidence_labels':dict(Counter(row['Confianza'] for row in raw)),'specifications':'sintéticas por tipo (demo, no del CSV)'}
    save('import-report.json',stats)
    (ROOT/'CATALOG-REPORT.md').write_text('# Catálogo — Resultado de importación\n\n'+json.dumps(stats,ensure_ascii=False,indent=2)+'\n\nTodas las ofertas y proveedores son de demostración. El CSV respalda exclusivamente especialidad, tipo y marca; Confianza se conserva sin verificación propia. Las especificaciones son SINTÉTICAS (demo, deterministas, no provienen del CSV ni de fichas técnicas) y se marcan con field_provenance.specifications="synthetic"; sirven para que la compatibilidad varíe en la demo, no acreditan desempeño técnico. Las familias agrupan alternativas de búsqueda, no equivalencia certificada. Ninguna ficha técnica fue leída por el importador.\n',encoding='utf-8')
    print(json.dumps(stats,ensure_ascii=False))

if __name__=='__main__': main()
