#!/usr/bin/env python3
"""Gera songs.js a partir dos arquivos em cifras/*.txt

Formato de cada arquivo:
  @title Nome da música
  @artist Artista
  @tom D            (tom original; use m para menor: Bm)
  @pad Bm           (pode ter alternativa: "G ou Em")
  @bpm 132
  @capo 2           (opcional)
  @note Observação  (opcional)
  @youtube ID ou link do vídeo (opcional; sem isso o botão abre a busca no YouTube)

  [Refrão]
  G        A      Bm
  Toda a Terra será cheia
  ! Linhas que começam com ! viram observações (ex.: bateria)

Uso:  python3 tools/build.py
"""
import json, re, glob, os, hashlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def key(k):
    m = re.match(r'^([A-G][#b]?)(m?)', (k or '').strip())
    return (m.group(1)+m.group(2)) if m else ''
# ids estáveis: cada arquivo mantém o mesmo id para sempre (ajustes e playlists dos usuários usam o id)
IDS = os.path.join(ROOT, 'tools', 'ids.json')
ids = json.load(open(IDS, encoding='utf-8')) if os.path.exists(IDS) else {}
songs = []
for f in sorted(glob.glob(os.path.join(ROOT, 'cifras', '*.txt'))):
    fn = os.path.basename(f)
    if fn not in ids: ids[fn] = max(ids.values(), default=0) + 1
    meta = {}; body = []
    for line in open(f, encoding='utf-8').read().split('\n'):
        m = re.match(r'^@(\w+)\s?(.*)$', line)
        if m and not body: meta[m.group(1)] = m.group(2).strip(); continue
        body.append(line.rstrip())
    while body and not body[0].strip(): body.pop(0)
    while body and not body[-1].strip(): body.pop()
    pads = [key(p) for p in re.split(r'\s+ou\s+', meta.get('pad', '')) if key(p)]
    bpm = re.match(r'\d+', meta.get('bpm', ''))
    songs.append(dict(
        id=ids[fn], file=fn, title=meta.get('title', ''), artist=meta.get('artist', ''),
        key=key(meta.get('tom', '')), keySrc=meta.get('tomsrc', 'setlist' if meta.get('tom') else ''),
        pad=pads[0] if pads else '', padAlt=pads[1:],
        bpm=int(bpm.group(0)) if bpm else None, bpmSrc=meta.get('bpmsrc', 'setlist' if bpm else ''),
        capo=int(meta['capo']) if meta.get('capo', '').isdigit() else 0,
        note=meta.get('note', ''), youtube=meta.get('youtube', ''), body='\n'.join(body)))
json.dump(ids, open(IDS, 'w', encoding='utf-8'), indent=0, ensure_ascii=False, sort_keys=True)
# songs.js é só o catálogo (diretório): a cifra fica em cifras/<file> e o app baixa quando a pessoa escolhe a música.
cat = []
for s in songs:
    c = {k: v for k, v in s.items() if k != 'body' and v not in ('', None, [], 0) or k in ('id', 'title', 'artist', 'key')}
    c['h'] = hashlib.md5(s['body'].encode('utf-8')).hexdigest()[:8]
    if s['body'].strip(): c['has'] = 1
    cat.append(c)
with open(os.path.join(ROOT, 'songs.js'), 'w', encoding='utf-8') as out:
    out.write('// Gerado por tools/build.py a partir de cifras/*.txt — edite os .txt e rode o script.\n')
    out.write('// Catálogo (sem a cifra). A cifra de cada música é baixada de cifras/<file> quando a pessoa baixa a música.\n')
    out.write('window.SONGS = ' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'{len(songs)} músicas -> songs.js ({sum(1 for s in songs if s["body"])} com cifra)')
