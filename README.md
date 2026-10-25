# Worship Church 🎵

App web para ministérios de louvor com **cifras, tom, BPM e pads de fundo** — funciona no celular, tablet e computador, inclusive offline depois do primeiro acesso.

**Abrir o app:** https://igordnavarro.github.io/louvor-bdn/

## O que tem
- **225 músicas**, todas com letra e cifra organizada (seções, acordes alinhados, observações de bateria).
- **Busca** por nome da música ou artista (sem precisar de acento).
- **Troca de tom** (− / + ou lista): a cifra inteira transpõe e o **pad muda junto**.
- **Metrônomo** com o BPM da música: dá pra ajustar (±1, ±5, digitar ou *tap tempo*), compasso 4/4, 3/4, 6/8, 2/4, subdivisão e 3 sons.
- **Pad de fundo** sintetizado no tom (tônica + 5ª, opção de incluir a 3ª), 3 timbres e volume.
- **Fonte maior/menor** e **tema claro/escuro**.
- Ajustes de tom/BPM ficam salvos no aparelho; "Restaurar original" volta ao da setlist.
- Botão para abrir a música no Cifra Club (para as que ainda não têm cifra aqui) e no **YouTube**.
- **Usuários**: cada pessoa (ou função — voz, violão, teclado) tem seus próprios tons, capos, BPMs, playlists e músicas. Botão com a inicial no topo. Exportar/Importar leva os dados para outro aparelho.
- **Editar** em cada música: tom, capotraste, BPM, pad, observação e link do vídeo — salvo só para o usuário atual.
- **Nova música**: importe de um **PDF**, de um **print/foto** (leitura automática de texto) ou cole a cifra copiada do **Cifra Club**.
- **Playlists / escalas do dia**: data, ordem e tom de cada música; botão de compartilhar manda a escala com link para o WhatsApp.
- **Pads do YouTube** (vídeos de pad de 1 hora em cada tom, séries "Deep Worship Pads" e "Ambient Shimmer Pads") ou pad sintetizado offline.
- **Caber na tela** (Encaixe ▦): a música inteira aparece na tela sem rolar, em colunas, com a maior letra possível (A+/A− ainda ajustam). Pedal Bluetooth de virar página também funciona (PageDown/setas).
- **Tela cheia** (⛶) só com a cifra: letra maior/menor, ajustar à largura, rolagem automática e metrônomo.
- **Medleys**: crie a partir de qualquer música, juntando refrão, ponte ou qualquer trecho de outras; escolha o rótulo (refrão, ponte…), quantas vezes repete, e tudo é transposto para o tom do medley.
- **Sugestões de medley** em cada música: músicas do repertório no mesmo tom (ou relativo) e com BPM próximo.
- **Pads offline**: suba seus arquivos de áudio (MP3/M4A/WAV) — ficam guardados no aparelho; se faltar algum tom, o app ajusta a afinação do mais próximo. Também dá pra usar **sua playlist de pads do YouTube** (o app reconhece o tom pelo título).
- **Playlist ao vivo**: botão "Próxima", e chaves "Pad segue / Metrônomo segue" — ao trocar de música eles continuam tocando no novo tom/BPM (ou param, se desligado).
- **Favoritas** por usuário, e lista **agrupada por artista**.
- **Importar PowerPoint** (.pptx): lê o texto e as imagens dos slides; vários slides viram várias músicas.
- **Instalar como app**: aviso na primeira vez e botão ⬇ no topo.
- Metrônomo com sons de **click, cowbell, bloco sonoro e bip**.
- **Capotraste** (− / + ao lado do tom): ao mudar a casa, os acordes da cifra mudam para as formas certas e a música continua soando no mesmo tom (ex.: tom G com capo 2 → acordes em F).
- **Tela cheia** com botões de **Pad** e **Metrônomo** (tocar/pausar) e, dentro de uma playlist, **⏮ anterior / ⏭ próxima**.
- **Pads offline já incluídos** (A, B, C#, D, E, G, Cm, Em, Bm): tocam em **loop contínuo** até pausar; os outros tons usam o pad mais próximo com a afinação ajustada.

Dica: no celular, use "Adicionar à tela inicial" para abrir como app.
Atalhos no computador: **espaço** liga/desliga o metrônomo, **P** o pad, **↑/↓** ajusta o BPM.

## Como editar ou adicionar músicas
Cada música é um arquivo de texto em `cifras/`:

```
@title Toda Terra
@artist Gabriela Rocha
@tom D
@pad D
@bpm 132

[Refrão]
G            A          Bm
  Toda a Terra será cheia
! Linhas com ! viram observações (ex.: bateria entra no ride)
```

Campos opcionais: `@capo 2`, `@note texto`, `@pad G ou Em` (alternativa).
Depois de editar, rode `python3 tools/build.py` para gerar o `songs.js` e faça commit.

> As cifras foram transcritas dos slides da setlist; algumas músicas sem BPM na setlist tiveram o BPM conferido no songbpm.com (marcado no app) — vale confirmar no ensaio.


## Planilha de controle
A lista oficial do repertório fica em [`controle/`](controle/): `Worship Church - Controle.xlsx` (abas **Músicas** e **Pads**) e os mesmos dados em `musicas.csv` e `pads.csv`. Também existe uma cópia no Google Drive, na pasta **Worship Church**.

Colunas de Músicas: ID, nome padronizado (*Música - Artista*), música, artista, tom, BPM, capotraste, pad, se tem letra e cifra no app, arquivo de origem, slide do PowerPoint, arquivo no repositório e repetidas/observações.

**Sempre que adicionar ou editar uma música:**
1. Crie/edite o `.txt` em `cifras/` (inclua `@arquivo` e `@slide` quando vier de um PowerPoint).
2. Rode `python3 tools/build.py` (atualiza o app) e `python3 tools/planilha.py` (atualiza a planilha).
3. Faça o commit e atualize a planilha do Google Drive.

Os nomes são padronizados automaticamente (`tools/nomes.py`): primeira letra maiúscula, sem espaços sobrando, e grafias diferentes do mesmo artista unificadas.
