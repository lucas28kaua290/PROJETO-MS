import pandas as pd
import requests
import time
import random
import json
from datetime import datetime

# Configurações
BASE_URL = 'https://sistemamscred.com.br'
ARQUIVO_CSV = 'clientes-ideia-nome-cpf.csv'

def consultar_cpf(cpf, tentativa=1):
    """Consulta um CPF na API e retorna os dados"""
    try:
        cpf_limpo = ''.join(filter(str.isdigit, cpf))
        
        resp = requests.get(f'{BASE_URL}/consulta-fullconsig/{cpf_limpo}', timeout=30)
        
        if resp.status_code == 200:
            return {'sucesso': True, 'dados': resp.json()}
        else:
            return {'sucesso': False, 'erro': resp.text}
    except Exception as e:
        if tentativa <= 3:
            print(f'    ⚠️ Erro de conexão, tentando novamente ({tentativa}/3)...')
            time.sleep(5)
            return consultar_cpf(cpf, tentativa + 1)
        return {'sucesso': False, 'erro': str(e)}

def salvar_progresso(df, nome_arquivo):
    """Salva o progresso atual do DataFrame"""
    df.to_csv(nome_arquivo, index=False, encoding='utf-8', sep=';')
    print(f'    💾 Progresso salvo em {nome_arquivo}')

def main():
    print('=' * 60)
    print('🚀 INICIANDO CONSULTA DE CPFs')
    print('=' * 60)
    
    # Lê o CSV
    print(f'📂 Lendo arquivo: {ARQUIVO_CSV}')
    df = pd.read_csv(ARQUIVO_CSV, encoding='latin1', sep=';')
    print(f'✅ {len(df)} clientes encontrados')
    print()
    
    # Colunas novas
    df['data_nascimento'] = None
    df['telefone'] = None
    df['telefones'] = None
    df['nome_mae'] = None
    df['sexo'] = None
    df['convenio'] = None
    df['beneficio'] = None
    df['estado'] = None
    df['cidade'] = None
    df['bairro'] = None
    df['rua'] = None
    df['status_consulta'] = 'pendente'
    df['data_consulta'] = None
    df['erro'] = None
    
    # Arquivo de progresso
    arquivo_progresso = f'consulta_progresso_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    arquivo_final = f'clientes_enriquecidos_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    # Contadores
    total = len(df)
    sucessos = 0
    falhas = 0
    
    print(f'📊 Total de CPFs: {total}')
    print(f'💾 Arquivo de progresso: {arquivo_progresso}')
    print()
    
    # Processa cada CPF
    for i, row in df.iterrows():
        cpf = row['CPF']
        nome = row['NOME_CLIENTE']
        
        print(f'[{i+1}/{total}] {nome} - CPF: {cpf}')
        print(f'    🔍 Consultando...')
        
        resultado = consultar_cpf(cpf)
        
        if resultado['sucesso']:
            dados = resultado['dados']
            
            # Preenche os campos
            df.at[i, 'data_nascimento'] = dados.get('data_nascimento')
            df.at[i, 'telefone'] = dados.get('telefone')
            df.at[i, 'telefones'] = json.dumps(dados.get('telefones', []), ensure_ascii=False) if dados.get('telefones') else None
            df.at[i, 'nome_mae'] = dados.get('nome_mae')
            df.at[i, 'sexo'] = dados.get('sexo')
            df.at[i, 'convenio'] = dados.get('convenio')
            df.at[i, 'beneficio'] = dados.get('beneficio')
            df.at[i, 'estado'] = dados.get('estado')
            df.at[i, 'cidade'] = dados.get('cidade')
            df.at[i, 'bairro'] = dados.get('bairro')
            df.at[i, 'rua'] = dados.get('rua')
            df.at[i, 'status_consulta'] = 'sucesso'
            df.at[i, 'data_consulta'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            sucessos += 1
            print(f'    ✅ Dados encontrados!')
            print(f'       Convênio: {dados.get("convenio")}')
            print(f'       Nascimento: {dados.get("data_nascimento")}')
            print(f'       Telefone: {dados.get("telefone")}')
        else:
            df.at[i, 'status_consulta'] = 'falha'
            df.at[i, 'data_consulta'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            df.at[i, 'erro'] = str(resultado['erro'])[:200]  # Limita tamanho
            
            falhas += 1
            print(f'    ❌ Falhou: {str(resultado["erro"])[:100]}')
        
        # Salva progresso a cada 10 consultas
        if (i + 1) % 10 == 0:
            salvar_progresso(df, arquivo_progresso)
            print(f'    📈 Progresso: {sucessos} sucessos | {falhas} falhas')
        
        # Pausa entre consultas (evita bloqueio)
        if i < total - 1:
            espera = random.uniform(3, 8)
            print(f'    ⏳ Aguardando {espera:.1f}s...')
            print()
            time.sleep(espera)
    
    # Salva resultado final
    salvar_progresso(df, arquivo_final)
    
    # Resumo final
    print()
    print('=' * 60)
    print('📊 RESUMO FINAL')
    print('=' * 60)
    print(f'✅ Sucessos: {sucessos} ({sucessos/total*100:.1f}%)')
    print(f'❌ Falhas: {falhas} ({falhas/total*100:.1f}%)')
    print(f'📁 Total processado: {total}')
    print(f'💾 Arquivo final: {arquivo_final}')
    print()
    
    # Lista CPFs que falharam
    if falhas > 0:
        print('CPFs que falharam:')
        falhos = df[df['status_consulta'] == 'falha']
        for _, row in falhos.iterrows():
            print(f'  - {row["NOME_CLIENTE"]} | {row["CPF"]}')
    
    print()
    print('🏁 Processamento concluído!')

if __name__ == '__main__':
    main()