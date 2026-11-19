import pandas as pd
import requests
import re
import time
import random
from datetime import datetime

# ============================================================
# CONFIGURAÇÕES
# ============================================================
BASE_URL      = 'https://sistemamscred.com.br'
ARQUIVO_EXCEL = 'clientes.xlsx'   # nome da sua planilha de entrada
ARQUIVO_SAIDA = f'clientes_enriquecidos_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
PAUSA_MIN     = 0.2
PAUSA_MAX     = 0.5
SALVAR_A_CADA = 20


# ============================================================
# PARSER DE ENDEREÇO
# ============================================================

COMPLEMENTOS = re.compile(
    r'^(CASA|AP|APTO|APARTAMENTO|BLOCO|BL|SALA|LOJA|LOTE|LT|ST|ZR)\b',
    re.IGNORECASE
)

def separar_rua_bairro(texto):
    """
    Separa o campo 'rua' da API (que vem tudo junto) em:
      - rua   → logradouro + número
      - bairro → complemento / bairro  (ex: 'CASA / MARACUJA')

    Casos sem número → tudo vai para rua, bairro fica None.
    """
    if not texto or pd.isna(texto):
        return None, None

    texto = str(texto).strip()

    # Tenta achar o primeiro número/SN/S N
    match = re.search(r'\b(\d+|SN|S\s*N)\b', texto, re.IGNORECASE)
    if not match:
        # Sem número identificável → manda tudo como rua
        return texto, None

    rua    = texto[:match.start()].strip()
    numero = match.group(0).replace(' ', '')   # normaliza "S N" → "SN"
    resto  = texto[match.end():].strip()

    # Remove número colado ao próximo token (ex: "01CASA" → "CASA")
    resto = re.sub(r'^\d+', '', resto).strip()

    rua_final = f'{rua} {numero}'.strip()

    if not resto:
        return rua_final, None

    # Verifica se o resto começa com palavra de complemento
    comp_match = COMPLEMENTOS.match(resto)
    if comp_match:
        complemento = comp_match.group(0).upper()
        apos = resto[comp_match.end():].strip()

        # Remove número logo após o complemento (ex: "AP 2 CENTRO" → "CENTRO")
        apos = re.sub(r'^\d+\s*', '', apos).strip()

        if apos:
            bairro = f'{complemento} / {apos}'
        else:
            bairro = None
    else:
        bairro = resto

    return rua_final, bairro


# ============================================================
# HELPERS
# ============================================================

def limpar_cpf(cpf):
    return ''.join(filter(str.isdigit, str(cpf)))


def limpar_telefone(tel):
    """Converte notação científica (8.498656e+10) para string limpa."""
    if pd.isna(tel):
        return None
    try:
        return str(int(float(tel)))
    except Exception:
        return str(tel).strip() or None


def limpar_beneficio(ben):
    if pd.isna(ben):
        return None
    try:
        return str(int(float(ben)))
    except Exception:
        return str(ben).strip() or None


def formatar_data(data_str):
    """DD/MM/YYYY → YYYY-MM-DD."""
    if pd.isna(data_str) or not data_str:
        return None
    data_str = str(data_str).strip()
    for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(data_str, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None


# ============================================================
# CADASTRO
# ============================================================

def cadastrar_cliente(row):
    """POST /clientes. Retorna (sucesso: bool, detalhe: str)."""
    rua_final, bairro_final = separar_rua_bairro(row.get('rua'))

    def _vazio(v):
        """Retorna True para None, NaN ou string vazia."""
        if v is None:
            return True
        try:
            return pd.isna(v)
        except Exception:
            return False

    payload = {
        'nome':      str(row.get('nome') or '').strip(),
        'cpf':       limpar_cpf(row['cpf']),
        'beneficio': limpar_beneficio(row.get('beneficio')),
        'dataNasc':  formatar_data(row.get('data_nascimento')),
        'telefone':  limpar_telefone(row.get('telefone')),
        'senha':     None,
        'estado':    None if _vazio(row.get('estado')) else str(row.get('estado')).strip(),
        'cidade':    None if _vazio(row.get('cidade')) else str(row.get('cidade')).strip(),
        'bairro':    bairro_final,
        'rua':       rua_final,
    }

    # Remove Nones para não poluir o form
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        resp = requests.post(
            f'{BASE_URL}/clientes',
            data=payload,       # multipart/form-data (request.form no Flask)
            timeout=15
        )

        if resp.status_code == 201:
            return True, 'cadastrado'

        if resp.status_code == 400:
            try:
                msg = resp.json().get('Erro', resp.text)
            except Exception:
                msg = resp.text
            return False, f'duplicado — {msg}'

        return False, f'HTTP {resp.status_code} — {resp.text[:120]}'

    except requests.exceptions.Timeout:
        return False, 'timeout'
    except Exception as e:
        return False, str(e)[:150]


# ============================================================
# PROGRESSO
# ============================================================

def salvar_progresso(df, caminho):
    df.to_csv(caminho, index=False, encoding='utf-8', sep=';')
    print(f'    💾 Progresso salvo → {caminho}')


# ============================================================
# MAIN
# ============================================================

def main():
    print('=' * 60)
    print('🚀 IMPORTAÇÃO DE CLIENTES — MSCred')
    print('=' * 60)

    print(f'📂 Lendo: {ARQUIVO_EXCEL}')
    df_entrada = pd.read_excel(ARQUIVO_EXCEL, header=None)

    # Pega a primeira coluna, seja qual for o nome dela
    cpfs = df_entrada.iloc[:, 0].dropna().astype(str).str.strip()
    # Limpa antes de filtrar
    cpfs = df_entrada.iloc[:, 0].dropna().astype(str).str.strip()
    cpfs = cpfs.str.replace(r'[.\-\s]', '', regex=True)
    cpfs = cpfs.str.replace(r'\.0$', '', regex=True)
    cpfs = cpfs.str.zfill(11)
    cpfs = cpfs[cpfs.str.match(r'^\d{11}$')]
    total_bruto = len(cpfs)
    cpfs = cpfs.drop_duplicates()
    print(f'✅ {len(cpfs)} CPFs únicos encontrados ({total_bruto - len(cpfs)} duplicatas removidas)')
    print()

    # Consulta a FullConsig para cada CPF
    registros = []
    for i, cpf in enumerate(cpfs, start=1):
        print(f'[{i}/{len(cpfs)}] Consultando CPF: {cpf}')
        try:
            resp = requests.get(f'{BASE_URL}/consulta-fullconsig/{cpf}', timeout=20)
            if resp.status_code == 200:
                dados = resp.json()
                dados['status_consulta'] = 'sucesso'
                dados['CPF'] = cpf
                registros.append(dados)
                print(f'    ✅ {dados.get("nome", "sem nome")} — {dados.get("convenio")}')
            else:
                registros.append({'CPF': cpf, 'status_consulta': 'nao_encontrado'})
                print(f'    ❌ Não encontrado')
        except Exception as e:
            registros.append({'CPF': cpf, 'status_consulta': 'erro', 'erro': str(e)})
            print(f'    ⚠️  Erro: {e}')
        time.sleep(random.uniform(PAUSA_MIN, PAUSA_MAX))

    df_validos = pd.DataFrame(registros)
    df_validos.to_csv(ARQUIVO_SAIDA, index=False, encoding='utf-8', sep=';')
    print(f'\n💾 CSV enriquecido salvo: {ARQUIVO_SAIDA}')
    print()

    df_validos = df_validos[df_validos['status_consulta'] == 'sucesso'].copy()
    print(f'📊 {len(df_validos)} clientes válidos para importar')

    ARQUIVO_IMPORTACAO = f'clientes_para_importar_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    df_validos.to_csv(ARQUIVO_IMPORTACAO, index=False, encoding='utf-8', sep=';')
    print(f'💾 CSV de importação salvo: {ARQUIVO_IMPORTACAO}')
    print()
    print('👀 Revise o arquivo acima antes de continuar.')
    input('▶  Pressione ENTER para iniciar o cadastro ou Ctrl+C para cancelar... ')
    print()

    df_validos['status_importacao']  = 'pendente'
    df_validos['detalhe_importacao'] = None

    arquivo_progresso = f'importacao_progresso_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    arquivo_final     = f'importacao_final_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'

    total      = len(df_validos)
    sucessos   = 0
    duplicados = 0
    falhas     = 0

    print(f'📊 Total a importar : {total}')
    print(f'💾 Progresso em     : {arquivo_progresso}')
    print()

    for i, (idx, row) in enumerate(df_validos.iterrows(), start=1):
        nome = str(row.get('nome', '')).strip()
        cpf  = limpar_cpf(row['cpf'])
        rua_debug, bairro_debug = separar_rua_bairro(row.get('rua'))

        print(f'[{i}/{total}] {nome} — CPF: {cpf}')
        print(f'    📍 Rua   : {rua_debug}')
        print(f'    📍 Bairro: {bairro_debug}')

        # Checa se CPF já existe no sistema antes de cadastrar
        try:
            resp_check = requests.get(f'{BASE_URL}/clientes?cpf={cpf}', timeout=10)
            if resp_check.status_code == 200:
                df_validos.at[idx, 'status_importacao']  = 'duplicado'
                df_validos.at[idx, 'detalhe_importacao'] = 'CPF já existe no sistema'
                duplicados += 1
                print(f'    ⚠️  CPF já existe no sistema — pulando')
                continue
        except Exception as e:
            print(f'    ⚠️  Erro ao checar duplicata: {e} — tentando cadastrar mesmo assim')

        ok, detalhe = cadastrar_cliente(row)

        df_validos.at[idx, 'status_importacao']  = 'sucesso' if ok else 'falha'
        df_validos.at[idx, 'detalhe_importacao'] = detalhe

        if ok:
            sucessos += 1
            print(f'    ✅ {detalhe}')
        elif 'duplicado' in detalhe:
            duplicados += 1
            print(f'    ⚠️  {detalhe}')
        else:
            falhas += 1
            print(f'    ❌ {detalhe}')

        if i % SALVAR_A_CADA == 0:
            salvar_progresso(df_validos, arquivo_progresso)
            print(f'    📈 {sucessos} ok | {duplicados} duplicados | {falhas} falhas')

        if i < total:
            time.sleep(random.uniform(PAUSA_MIN, PAUSA_MAX))

    salvar_progresso(df_validos, arquivo_final)

    print()
    print('=' * 60)
    print('📊 RESUMO FINAL')
    print('=' * 60)
    print(f'✅ Cadastrados  : {sucessos}  ({sucessos/total*100:.1f}%)')
    print(f'⚠️  Duplicados   : {duplicados}  ({duplicados/total*100:.1f}%)')
    print(f'❌ Falhas       : {falhas}  ({falhas/total*100:.1f}%)')
    print(f'📁 Total        : {total}')
    print(f'💾 Arquivo final: {arquivo_final}')
    print()

    if falhas > 0:
        print('— Clientes que falharam —')
        for _, r in df_validos[df_validos['status_importacao'] == 'falha'].iterrows():
            print(f'  {r.get("nome", "sem nome")} | {r["cpf"]} | {r["detalhe_importacao"]}')

    print()
    print('🏁 Importação concluída!')


if __name__ == '__main__':
    main()