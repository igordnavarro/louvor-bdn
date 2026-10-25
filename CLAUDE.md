# Worship Church — notas para manutenção

- App estático (index.html, app.js, songs.js) publicado no GitHub Pages. Músicas ficam em `cifras/*.txt`.
- **Planilha de controle**: `controle/` (xlsx + csv), gerada por `tools/planilha.py`. É a referência do repertório.
  Cópia no Google Drive: pasta "Worship Church" → planilha "Worship Church - Controle" (ver `controle/google.json`).
- Ao adicionar/editar música: editar/criar `cifras/<titulo>--<artista>.txt` → `python3 tools/build.py` → `python3 tools/planilha.py` → commit → atualizar a planilha do Google Drive em paralelo.
- IDs das músicas são fixos (`tools/ids.json`); nunca renumerar.
- Nomes padronizados por `tools/nomes.py` (título com primeira letra maiúscula; artistas unificados).
- Ao mudar app.js/index.html/songs.js, aumentar o `?v=` no index.html e a versão do cache em sw.js.
