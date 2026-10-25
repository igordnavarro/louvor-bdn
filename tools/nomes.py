"""Padronização de nomes (título e artista) usada pelo build e pela planilha de controle."""
import re

SMALL = {'de','da','do','das','dos','e','o','a','os','as','em','no','na','nos','nas','pra','pro','por','que',
         'com','ao','aos','à','às','se','um','uma','me','te','nos','teu','tua','seu','sua','meu','minha'}
SMALL -= {'teu','tua','seu','sua','meu','minha','um','uma','me','te','se'}  # possessivos/artigos indefinidos ficam com maiúscula
KEEP = {'IIR':'IIR','G3':'G3','DJ':'DJ','II':'II','III':'III'}
ARTISTAS = {  # grafias diferentes da mesma pessoa/banda -> nome padrão
    'david quilan':'David Quinlan', 'jeferson e suelen':'Jefferson e Suellen', 'jeferson e suellen':'Jefferson e Suellen',
    'jefferson e suellen':'Jefferson e Suellen', 'louvor iir':'Louvor IIR', 'ministerio mergulhar':'Ministério Mergulhar',
    'ministério pedras vivas':'Pedras Vivas', 'isaías saad':'Isaias Saad', 'isaias saad':'Isaias Saad',
    'isadora pompeu':'Isadora Pompeo', 'alessandro vilasboas':'Alessandro Vilas Boas', 'jonas serra':'Jhonas Serra',
    'andé aquino':'André Aquino', 'fhop':'Fhop',
}

def _word(w, first):
    if not w: return w
    up = w.upper().strip('.,!?')
    if up in KEEP: return w.upper()
    lw = w.lower()
    if not first and lw in SMALL: return lw
    # capitaliza a primeira letra (mantém o resto em minúsculo, inclusive depois de hífen/apóstrofo: Aviva-nos, Minh'alma)
    m = re.match(r"^([^\wÀ-ÿ]*)(.)(.*)$", lw)
    return m.group(1) + m.group(2).upper() + m.group(3) if m else w

def titulo(s):
    s = re.sub(r'\s+', ' ', (s or '').replace('​', '')).strip()
    parts = re.split(r'(\s+|/|\+|\()', s)
    out, first = [], True
    for p in parts:
        if not p or p.isspace() or p in '/+(':
            out.append(p)
            if p in '/+(': first = True
            continue
        out.append(_word(p, first)); first = False
    s = ''.join(out)
    s = re.sub(r'\s*/\s*', ' / ', s); s = re.sub(r'\s*\+\s*', ' + ', s)
    s = re.sub(r'\(\s*', '(', s); s = re.sub(r'\s*\)', ')', s); s = re.sub(r'(\S)\(', r'\1 (', s)
    return re.sub(r'\s+', ' ', s).strip()

def artista(s):
    s = re.sub(r'\s+', ' ', (s or '')).strip()
    if not s: return ''
    k = s.lower()
    if k in ARTISTAS: return ARTISTAS[k]
    return titulo(s)

def nome_padrao(t, a):
    t, a = titulo(t), artista(a)
    return f'{t} - {a}' if a else t
