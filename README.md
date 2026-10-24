# Louvor BDN 🎵

App web do ministério de louvor (Bola de Neve) com **cifras, tom, BPM e pads de fundo** — funciona no celular, tablet e computador, inclusive offline depois do primeiro acesso.

**Abrir o app:** https://igordnavarro.github.io/louvor-bdn/

## O que tem
- **226 músicas** da setlist, **102 com cifra completa** organizada (seções, acordes alinhados, observações de bateria).
- **Busca** por nome da música ou artista (sem precisar de acento).
- **Troca de tom** (− / + ou lista): a cifra inteira transpõe e o **pad muda junto**.
- **Metrônomo** com o BPM da música: dá pra ajustar (±1, ±5, digitar ou *tap tempo*), compasso 4/4, 3/4, 6/8, 2/4, subdivisão e 3 sons.
- **Pad de fundo** sintetizado no tom (tônica + 5ª, opção de incluir a 3ª), 3 timbres e volume.
- **Fonte maior/menor** e **tema claro/escuro**.
- Ajustes de tom/BPM ficam salvos no aparelho; "Restaurar original" volta ao da setlist.
- Botão para abrir a música no Cifra Club (para as que ainda não têm cifra aqui).

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
