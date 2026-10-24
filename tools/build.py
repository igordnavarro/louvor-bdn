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

  [Refrão]
  G        A      Bm
  Toda a Terra será cheia
  ! Linhas que começam com ! viram observações (ex.: bateria)

Uso:  python3 tools/build.py
"""
import json, re, glob, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def key(k):
    m = re.match(r'^([A-G][#b]?)(m?)', (k or '').strip())
    return (m.group(1)+m.group(2)) if m else ''
songs = []
for i, f in enumerate(sorted(glob.glob(os.path.join(ROOT, 'cifras', '*.txt')))):
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
        id=i+1, file=os.path.basename(f), title=meta.get('title', ''), artist=meta.get('artist', ''),
        key=key(meta.get('tom', '')), keySrc=meta.get('tomsrc', 'setlist' if meta.get('tom') else ''),
        pad=pads[0] if pads else '', padAlt=pads[1:],
        bpm=int(bpm.group(0)) if bpm else None, bpmSrc=meta.get('bpmsrc', 'setlist' if bpm else ''),
        capo=int(meta['capo']) if meta.get('capo', '').isdigit() else 0,
        note=meta.get('note', ''), body='\n'.join(body)))
with open(os.path.join(ROOT, 'songs.js'), 'w', encoding='utf-8') as out:
    out.write('// Gerado por tools/build.py a partir de cifras/*.txt — edite os .txt e rode o script.\n')
    out.write('window.SONGS = ' + json.dumps(songs, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'{len(songs)} músicas -> songs.js ({sum(1 for s in songs if s["body"])} com cifra)')
