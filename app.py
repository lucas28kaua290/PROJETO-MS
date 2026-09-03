from flask import Flask, jsonify, request, send_from_directory
import os
import io
import re
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from dotenv import load_dotenv
from flask_cors import CORS
import json
from datetime import datetime, timedelta
import pytz
import requests as req_http
import time
import random
import click
from datetime import datetime
import sys
sys.stdout.reconfigure(line_buffering=True)

load_dotenv()

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})
app.config['MAX_CONTENT_LENGTH'] = 50*1024*1024
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'static', 'uploads')
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])
fuso_br = pytz.timezone('America/Sao_Paulo')

def conexao_db ():
    try:
        connection = mysql.connector.connect(
            host = os.getenv('DB_HOST'),
            user = os.getenv('DB_USER'),
            password = os.getenv('DB_PASSWORD'),
            database = os.getenv('DB_NAME')
        )
        return connection
    except mysql.connector.Error as err:   
        print(f'Erro ao conectar no banco: {err}')
        return None
    
conexao = conexao_db()

@app.route('/login', methods=['POST'])
def login():
    dados = request.json
    email = dados.get('email')
    senha_digitada = dados.get('senha')

    conn = conexao_db()
    try:
        cursor = conn.cursor(dictionary = True)
        cursor.execute("SELECT id, nome, email, senha, cargo FROM usuarios WHERE email = %s", (email,))
        usuario = cursor.fetchone()

        if usuario and check_password_hash(usuario['senha'], senha_digitada):
            return jsonify ({
                "sucesso": True,
                "usuario": {
                    "id": usuario['id'],
                    "nome": usuario['nome'],
                    "cargo": usuario['cargo']
                }
            }), 200
        
        else:
            return jsonify({"sucesso": False, "erro": "E-mail ou senha incorretos"}), 401
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route('/clientes', methods=['GET'])
def buscar_clientes():
    # 1. Mapeia tudo o que vem da URL
    filtros = {
        'nome': request.args.get('nome'),
        'cpf': request.args.get('cpf'),
        'beneficio': request.args.get('beneficio'),
        'data_nascimento': request.args.get('data_nascimento'),
        'telefone': request.args.get('telefone'),
        'senha_inss': request.args.get('senha_inss'),
        'estado': request.args.get('estado'),
        'cidade': request.args.get('cidade'),
        'bairro': request.args.get('bairro'),
        'rua': request.args.get('rua'),
        'operacao': request.args.get('operacao'),
        'data_operacao': request.args.get('data_operacao'),
        'banco_promotora': request.args.get('banco_promotora')
    }

    # Parâmetros de paginação
    page     = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 15))
    offset   = (page - 1) * per_page

    if filtros['cpf']:
        filtros['cpf'] = ''.join(filter(str.isdigit, filtros['cpf']))
    if filtros['beneficio']:
        filtros['beneficio'] = ''.join(filter(str.isdigit, filtros['beneficio']))

    conn = conexao_db()
    if not conn:
        return jsonify({"Erro": "Erro na conexão"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        sql_base = "FROM clientes WHERE 1=1"
        params = []

        # Loop inteligente para não repetir "if" para todo mundo
        # Filtros de busca parcial (LIKE)
        campos_like = ['nome', 'cidade', 'bairro', 'rua', 'banco_promotora', 'senha_inss']
        # Filtros de busca exata (=)
        campos_exatos = {
            'cpf': 'cpf', 
            'beneficio': 'num_beneficio', # Chave do dict vs Nome da coluna
            'data_nascimento': 'data_nascimento',
            'telefone': 'telefone',
            'operacao': 'operacao',
            'estado': 'estado',
            'data_operacao': 'data_operacao'
        }

        # Aplica filtros LIKE
        for campo in campos_like:
            if filtros[campo]:
                sql_base += f" AND {campo} LIKE %s"
                params.append(f"%{filtros[campo]}%")

        # Aplica filtros Exatos
        for chave, coluna in campos_exatos.items():
            if filtros[chave]:
                sql_base += f" AND {coluna} = %s"
                params.append(filtros[chave])

        # Conta o total de registros para o frontend calcular páginas
        cursor.execute(f"SELECT COUNT(*) as total {sql_base}", params)
        total = cursor.fetchone()['total']

        # Busca a página solicitada, ordenada do mais recente para o mais antigo
        sql = f"SELECT * {sql_base} ORDER BY id DESC LIMIT %s OFFSET %s"
        cursor.execute(sql, params + [per_page, offset])
        lista_clientes = cursor.fetchall()

        for cliente in lista_clientes:
            cursor.execute("""
                SELECT tipo_documento, url_documento 
                FROM documentos_cliente 
                WHERE cliente_id = %s
            """, (cliente['id'],))

            cliente['documentos'] = cursor.fetchall()

            cursor.execute("""
                SELECT tipo_operacao, DATE_FORMAT(data_operacao, '%d/%m/%Y') as data_operacao, banco_promotora 
                FROM historico_operacoes 
                WHERE cliente_id = %s
            """, (cliente['id'],))
            cliente['operacoes'] = cursor.fetchall()

        cursor.close()
        conn.close()

        if not lista_clientes:
            return jsonify({"mensagem": "Nenhum cliente encontrado"}), 404

        return jsonify({"total": total, "clientes": lista_clientes}), 200
    

    except Exception as e:
        return jsonify({"erro": f"Erro na busca: {str(e)}"}), 500

@app.route('/uploads/<filename>')
def servindo_arquivos(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/clientes/kpis', methods=['GET'])
def kpis_clientes():
    conn = conexao_db()
    if not conn:
        return jsonify({"erro": "Erro na conexão"}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Total de clientes
        cursor.execute("SELECT COUNT(*) as total FROM clientes")
        total = cursor.fetchone()['total']
        
        # Cadastros no mês atual (usando a nova coluna data_criacao)
        cursor.execute("""
            SELECT COUNT(*) as total FROM clientes
            WHERE MONTH(data_criacao) = MONTH(CURDATE()) 
              AND YEAR(data_criacao) = YEAR(CURDATE())
        """)
        cadastros_mes = cursor.fetchone()['total']
        
        # Operações no mês (usando data_registro da tabela historico_operacoes)
        cursor.execute("""
            SELECT COUNT(*) as total FROM historico_operacoes
            WHERE MONTH(data_registro) = MONTH(CURDATE())
              AND YEAR(data_registro) = YEAR(CURDATE())
        """)
        operacoes_mes = cursor.fetchone()['total']
        
        cursor.close()
     
        return jsonify({
            "total_clientes": total,
            "cadastros_mes": cadastros_mes,
            "operacoes_mes": operacoes_mes
        }), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])


@app.route('/clientes', methods=['POST'])
def cadastrar_cliente():
    dados = request.form
    # Limpa o CPF para garantir que tenha no máximo 14 caracteres (conforme seu banco)
    cpf_limpo = ''.join(filter(str.isdigit, dados.get('cpf', '')))
    
    conn = conexao_db()
    try:
        cursor = conn.cursor()

        # 1. INSERIR NA TABELA 'clientes'
        # Nomes das colunas batendo 100% com o print
        sql_cliente = """INSERT INTO clientes 
                         (nome, cpf, num_beneficio, data_nascimento, telefone, senha_inss, estado, cidade, bairro, rua) 
                         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
        
        valores_cliente = (
            dados.get('nome'), 
            cpf_limpo, 
            dados.get('beneficio'), 
            dados.get('dataNasc'),
            dados.get('telefone'),
            dados.get('senha'),
            dados.get('estado'),
            dados.get('cidade'),
            dados.get('bairro'),
            dados.get('rua')
        )
        cursor.execute(sql_cliente, valores_cliente)
        id_gerado = cursor.lastrowid # Este é o 'id' da tabela clientes

        # 2. INSERIR NA TABELA 'historico_operacoes'
        # Aqui o seu banco usa 'cpf_cliente' e 'banco_promotora'

        operacoes_json = dados.get('operacoes_json')

        if operacoes_json:
            lista_operacoes = json.loads(operacoes_json)
            sql_op = """INSERT INTO historico_operacoes (cliente_id, tipo_operacao, data_operacao, banco_promotora) 
                    VALUES (%s, %s, %s, %s)"""
            for op in lista_operacoes:
                valores_op = (
                    id_gerado,
                    op.get('tipo_operacao'),
                    op.get('data_operacao'),
                    op.get('banco_promotora')
                )
                cursor.execute(sql_op, valores_op)

        # 3. INSERIR NA TABELA 'documentos_cliente'
        # Aqui o seu banco usa 'cliente_id' (que é o ID numérico)
        mapa_docs = {
            'docFrenteClienteNovo': 'RG_FRENTE',
            'docVersoClienteNovo': 'RG_VERSO',
            'VideoClienteNovo': 'VIDEO'
        }

        for campo_html, tipo_enum in mapa_docs.items():
            if campo_html in request.files:
                file = request.files[campo_html]
                if file and file.filename != '':
                    # Pega a extensão original (.jpg, .mp4, etc)
                    extensao = os.path.splitext(file.filename)[1]
                    # Cria um nome ÚNICO: CPF_TIPO_DOC.extensao
                    filename = f"{cpf_limpo}_{tipo_enum}{extensao}".lower()
                    
                    caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(caminho_completo)

                    # No banco, salve apenas o filename (ex: 12345678900_rg_frente.jpg)
                    sql_doc = """INSERT INTO documentos_cliente (cliente_id, tipo_documento, url_documento, status) 
                                 VALUES (%s, %s, %s, %s)
                                 ON DUPLICATE KEY UPDATE
                                 url_documento = VALUES(url_documento),
                                 status = 'ENVIADO' """
                    cursor.execute(sql_doc, (id_gerado, tipo_enum, filename, 'ENVIADO'))

        conn.commit()
        return jsonify({"mensagem": "Cadastro realizado com sucesso!"}), 201

    except mysql.connector.Error as err:
        conn.rollback()
        if err.errno == 1062:
            return jsonify({"Erro": f"ErroEste CPF já está cadastrado no sistema!"}), 400
        
        return jsonify ({"erro": f"Erro no banco de dados: {err.msg}"}), 500
    
    except Exception as e:
        conn.rollback()

        return jsonify ({"erro":f"Erro interno: {str(e)}"}), 500
    finally:
        conn.close()



@app.route('/clientes/dados_edicao/<cpf>', methods=['GET'])
def buscar_cliente(cpf):
    conn = conexao_db()
    cursor = conn.cursor(dictionary=True) # Retorna como dicionário para o JS ler fácil
    
    cursor.execute("SELECT id, nome, cpf, DATE_FORMAT(data_nascimento, '%d/%m/%Y') as data_nascimento FROM clientes WHERE cpf = %s", (cpf,))
    cliente = cursor.fetchone()
    
    if cliente:

        cursor.execute("""
            SELECT tipo_documento, url_documento, status 
            FROM documentos_cliente 
            WHERE cliente_id = %s
        """, (cliente['id'],))

        documentos = cursor.fetchall()

        cliente['documentos'] = documentos

    conn.close()

    
    if cliente:
        return jsonify(cliente), 200
    else:
        return jsonify({"erro": "Cliente não encontrado"}), 404
    
@app.route('/clientes/atualizar', methods=['POST'])
def atualizar_cliente():
    dados = request.form
    arquivos = request.files
    cpf = dados.get('cpf_original')
    
    conn = conexao_db()
    cursor = conn.cursor()
    
    try:
        # 1. Atualizar dado do Perfil (se o usuário marcou 'Sim')
        if dados.get('vai_atualizar_dado') == 'true':
            campo = dados.get('tipo_campo')
            
            if campo == 'endereco':
                # Atualize todas as colunas que você tem na tabela 'clientes'
                sql_end = """UPDATE clientes SET 
                            estado = %s, cidade = %s, bairro = %s, rua = %s
                            WHERE cpf = %s"""
                cursor.execute(sql_end, (
                    dados.get('estado'), 
                    dados.get('cidade'), 
                    dados.get('bairro'), 
                    dados.get('rua'), 
                    cpf
                ))
            else:
                novo_valor = dados.get('novo_valor')
                # Mapeia o nome do select para a coluna real do banco
                colunas = {'dataNascimento': 'data_nascimento', 'senhaINSS': 'senha_inss'}
                coluna_real = colunas.get(campo, campo)
                
                query = f"UPDATE clientes SET {coluna_real} = %s WHERE cpf = %s"
                cursor.execute(query, (novo_valor, cpf))

        # 2. Salvar Nova Operação (Sempre salva se houver dados)
        operacoes_json = dados.get('operacoes')

        if operacoes_json:
            try:
                # 1. Busca o ID do cliente usando o CPF original
                cursor.execute("SELECT id FROM clientes WHERE cpf = %s", (cpf,))
                resultado = cursor.fetchone()
                
                if resultado:
                    id_cliente = resultado[0]
                    lista_de_operacoes = json.loads(operacoes_json)
                    
                    for op in lista_de_operacoes:
                        sql_op = """INSERT INTO historico_operacoes 
                            (cliente_id, tipo_operacao, data_operacao, banco_promotora) 
                            VALUES (%s, %s, %s, %s)"""
                        
                        # 2. Usa o id_cliente (número) em vez do CPF
                        valores_op = (
                            id_cliente,
                            op.get('operacao'),
                            op.get('data'),
                            op.get('banco')
                        )
                        cursor.execute(sql_op, valores_op)
            except Exception as e:
                print(f'Erro ao processar as operações: {e}')

        # 3. Processar novos arquivos (se houver)
        mapeamento_arquivos = {
            'docFrente': 'RG_FRENTE', 
            'docVerso': 'RG_VERSO', 
            'videoCliente': 'VIDEO'
        }

        for nome_js, tipo_enum in mapeamento_arquivos.items():
            if nome_js in arquivos:
                file = arquivos[nome_js]
                if file and file.filename != '':
                    # 1. Padroniza nome e extensão (Ex: 123456_RG_FRENTE.jpg)
                    extensao = os.path.splitext(file.filename)[1].lower()
                    nome_final = f"{cpf}_{tipo_enum}{extensao}"
                    
                    caminho = os.path.join(app.config['UPLOAD_FOLDER'], nome_final)
                    
                    # Opcional: Remove o arquivo antigo se ele existir para não entulhar a VPS
                    if os.path.exists(caminho):
                        os.remove(caminho)
                        
                    file.save(caminho)

                    # 2. Lógica de Banco de Dados (UPSERT)
                    # Usamos o ID do cliente para garantir o vínculo correto
                    sql_doc = """
                        INSERT INTO documentos_cliente (cliente_id, tipo_documento, url_documento, status)
                        VALUES ((SELECT id FROM clientes WHERE cpf = %s), %s, %s, 'ATUALIZADO')
                        ON DUPLICATE KEY UPDATE 
                            url_documento = VALUES(url_documento),
                            status = 'ATUALIZADO'
                    """
                    cursor.execute(sql_doc, (cpf, tipo_enum, nome_final))
        # Segue a mesma lógica que fizemos no cadastro...

        conn.commit()
        return jsonify({"mensagem": "Dados atualizados com sucesso!"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route('/propostas/criar', methods=['POST'])
def criar_proposta():
    dados = request.json
    conn = conexao_db()
    cursor = conn.cursor()

    def limpar_valor(v):
        if not v or v == "" or v == "undefined": 
            return 0
        
        v_str = str(v).replace('R$', '').strip()
        
        # Se o valor tem vírgula (formato BR: 1.500,50)
        if ',' in v_str:
            # Remove o ponto de milhar e troca a vírgula decimal por ponto
            return float(v_str.replace('.', '').replace(',', '.'))
        
        # Se não tem vírgula, mas já tem ponto (formato internacional: 15322.10)
        # ou é um número puro, apenas converte para float
        try:
            return float(v_str)
        except ValueError:
            return 0
    
    status_inicial = dados.get('status')
    data_finalizacao = datetime.now() + timedelta(hours=3) if status_inicial == "Finalizado" else None

    sql = """
        INSERT INTO propostas 
        (usuario_id, nome_cliente, cpf_cliente, convenio, operacao_feita, valor_parcela_port, troco_estimado, saldo_devedor_estimado, data_retorno_saldo,
        banco, promotora, valor_operacao, valor_parcela_geral,  
        status_proposta, detalhe_status, data_finalizacao)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,%s)
    """
    valores = (
        dados.get('usuario_id'),
        dados.get('nome'),
        dados.get('cpf'),
        dados.get('convenio'),
        dados.get('operacao'),
        limpar_valor(dados.get('valorParcelaPort')),
        limpar_valor(dados.get('troco')),
        limpar_valor(dados.get('saldoCliente')),
        dados.get('retornoSaldo') or None,
        dados.get('banco'),
        dados.get('promotora'),
        limpar_valor(dados.get('valorOperacao')),
        limpar_valor(dados.get('valorParcela')),
        dados.get('status'),
        dados.get('detalhamento'),
        data_finalizacao
    )

    try:
        cursor.execute(sql, valores)
        conn.commit()
        return jsonify({"sucesso": True, "id": cursor.lastrowid}), 201
    except Exception as e:
        print(f"Erro no Banco{e}")
        return jsonify({"sucesso": False, "erro": str(e)}), 500
    finally:
        conn.close()


@app.route('/propostas', methods=['GET'])
def buscar_propostas():
    # Pega o ID que o JS vai mandar via URL
    usuario_id = request.args.get('usuario_id')
    conn = conexao_db()
    cursor = conn.cursor(dictionary=True)
    if not usuario_id:
        return jsonify({"erro": "Usuário não identificado"}), 400

    # A "TRAVA" DE SEGURANÇA: Só pega o que for do dono logado
    sql = "SELECT * FROM propostas WHERE usuario_id = %s ORDER BY data_criacao DESC"
    
    try:
        cursor.execute(sql, (usuario_id,))
        propostas = cursor.fetchall()
        return jsonify(propostas), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()


@app.route('/propostas/editar/<int:id>', methods=['PUT'])
def editar_proposta(id):
    dados = request.json
    conn = conexao_db()
    cursor = conn.cursor()

    # Função interna para limpar os valores monetários
    def limpar_valor(v):
        if not v or v == "" or v == "undefined": 
            return 0
        
        v_str = str(v).replace('R$', '').strip()
        
        # Se o valor tem vírgula (formato BR: 1.500,50)
        if ',' in v_str:
            # Remove o ponto de milhar e troca a vírgula decimal por ponto
            return float(v_str.replace('.', '').replace(',', '.'))
        
        # Se não tem vírgula, mas já tem ponto (formato internacional: 15322.10)
        # ou é um número puro, apenas converte para float
        try:
            return float(v_str)
        except ValueError:
            return 0

    status_atual = dados.get('status')
    data_finalizacao = datetime.now() + timedelta(hours=3) if status_atual == "Finalizado" else None

    # SQL focado em atualizar apenas o que o modal de edição altera
    sql = """
        UPDATE propostas SET 
            nome_cliente = %s,
            cpf_cliente = %s,
            convenio = %s,
            operacao_feita = %s,
            banco = %s,
            promotora = %s,
            valor_operacao = %s,
            valor_parcela_geral = %s,
            valor_parcela_port = %s,
            status_proposta = %s,
            detalhe_status = %s,
            data_retorno_saldo = %s,
            saldo_devedor_estimado = %s,
            troco_estimado = %s,
            data_finalizacao = COALESCE(data_finalizacao, %s)
        WHERE id = %s
    """
    
    valores = (
        dados.get('nome'),
        dados.get('cpf'),
        dados.get('convenio'),
        dados.get('operacao'),
        dados.get('banco'),
        dados.get('promotora'),
        limpar_valor(dados.get('valorOperacao')),
        limpar_valor(dados.get('valorParcela')),
        limpar_valor(dados.get('valorParcelaPort')),
        dados.get('status'),
        dados.get('detalhamento'),
        dados.get('retornoSaldo') or None,
        limpar_valor(dados.get('saldoCliente')),
        limpar_valor(dados.get('troco')),
        data_finalizacao,
        id # O ID que vem da URL
    )

    try:
        cursor.execute(sql, valores)
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"sucesso": False, "mensagem": "Proposta não encontrada"}), 404
            
        return jsonify({"sucesso": True, "mensagem": "Proposta atualizada!"}), 200
    except Exception as e:
        print(f"Erro ao editar no Banco: {e}")
        return jsonify({"sucesso": False, "erro": str(e)}), 500
    finally:
        conn.close()

@app.route('/propostas/excluir/<int:id>', methods=['DELETE'])
def excluir_proposta(id):
    conexao = conexao_db() # Use a sua função de conexão
    cursor = conexao.cursor()

    try:
        # 1. Verifica se a proposta existe antes de deletar
        cursor.execute("SELECT id FROM propostas WHERE id = %s", (id,))
        proposta = cursor.fetchone()

        if not proposta:
            return jsonify({"erro": "Proposta não encontrada"}), 404

        # 2. Executa o DELETE
        cursor.execute("DELETE FROM propostas WHERE id = %s", (id,))
        conexao.commit()

        return jsonify({"mensagem": "Proposta excluída com sucesso!"}), 200

    except Exception as e:
        conexao.rollback()
        print(f"Erro ao excluir: {e}")
        return jsonify({"erro": "Erro interno ao excluir proposta"}), 500

    finally:
        cursor.close()
        conexao.close()



@app.route('/api/relatorios/total', methods=['GET'])
@app.route('/api/relatorios/<int:usuario_id>', methods=['GET'])
@app.route('/api/relatorios/filtro-data', methods=['GET']) # <-- NOVA ROTA
def obter_relatorio(usuario_id=None):
    conn = conexao_db()
    cursor = conn.cursor(dictionary=True)
    
    # 1. Pegamos os filtros da URL (se existirem)
    data_inicio = request.args.get('inicio')
    data_fim = request.args.get('fim')

    # 2. Query completa com todos os campos que sua tabela HTML usa
    query = """
        SELECT 
            p.*, 
            u.nome as nome_consultor 
        FROM propostas p
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.status_proposta = 'Finalizado'
    """
    params = []

    # Filtro por Usuário
    if usuario_id:
        query += " AND usuario_id = %s"
        params.append(usuario_id)

    # Filtro por Data (O pulo do gato!)
    if data_inicio and data_fim:
        query += " AND data_finalizacao BETWEEN %s AND %s"
        params.append(f"{data_inicio} 00:00:00")
        params.append(f"{data_fim} 23:59:59")

    # Ordenar pela data mais recente
    query += " ORDER BY data_finalizacao DESC"

    cursor.execute(query, params)
    propostas = cursor.fetchall()
    conn.close()

    if not propostas:
        return jsonify({"vazio": True, "mensagem": "Nada encontrado."})

    # --- CÁLCULOS (Igual você fez, mas garantindo float para o JSON) ---
    total_produzido = sum(float(p['valor_operacao'] or 0) for p in propostas)
    qtd_propostas = len(propostas)
    ticket_medio = total_produzido / qtd_propostas if qtd_propostas > 0 else 0

    return jsonify({
        "vazio": False,
        "cards": {
            "total": total_produzido,
            "quantidade": qtd_propostas,
            "ticket": ticket_medio
        },
        "tabela": propostas  # Enviamos tudo, o JS filtra o que for preciso
    })

@app.route('/api/relatorios/andamento', methods=['GET'])
@app.route('/api/relatorios/andamento/<int:usuario_id>', methods=['GET'])
def obter_relatorio_andamento(usuario_id = None):
    conn = conexao_db()
    cursor = conn.cursor(dictionary=True)

    data_inicio = request.args.get('inicio')
    
    query = """
        SELECT p.*, u.nome as nome_consultor
        FROM propostas p
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.status_proposta IN ('Novo', 'Processando')
    """
    params = []

    if usuario_id:
        query += " AND p.usuario_id = %s"
        params.append(usuario_id)

    query += " ORDER BY p.data_criacao DESC"

    cursor.execute(query, params)
    propostas = cursor.fetchall()
    conn.close()

    if not propostas:
        return jsonify({"vazio": True, "mensagem": "Nada encontrado."})

    total = 0
    for p in propostas:
        valor = float(p['valor_operacao'] or 0)
        saldo = float(p['saldo_devedor_estimado'] or 0)
        is_port = 'port' in (p['operacao_feita'] or '').lower()
        total += (valor + saldo) if is_port else valor

    return jsonify({
        "vazio": False,
        "cards": {
            "total": total,
            "quantidade": len(propostas)
        },
        "tabela": propostas
    })

@app.route('/api/configuracoes', methods=['GET'])
def obter_configuracoes():
    conn = conexao_db()
    cursor = conn.cursor(dictionary=True)
    try:
        # Pegamos a última configuração salva (id 1)
        cursor.execute("SELECT * FROM configuracoes_mensais WHERE id = 1")
        config = cursor.fetchone()
        if config:
            # O MySQL retorna o JSON como string, o Flask precisa dele como objeto
            if isinstance(config['regras_json'], str):
                config['regras_json'] = json.loads(config['regras_json'])
            return jsonify(config), 200
        return jsonify({"mensagem": "Nenhuma config encontrada"}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/configuracoes', methods=['POST'])
def salvar_configuracoes():
    dados = request.json
    conn = conexao_db()
    cursor = conn.cursor()
    
    meta_geral = dados.get('meta_geral')
    meta_individual = dados.get('meta_individual')
    regras = json.dumps(dados.get('regras')) # Transforma a lista de regras em STRING JSON

    try:
        # Lógica de UPSERT: Se o ID 1 já existir, ele dá UPDATE. Se não, dá INSERT.
        sql = """
            INSERT INTO configuracoes_mensais (id, meta_geral, meta_individual, regras_json, ultima_atualizacao)
            VALUES (1, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE 
                meta_geral = VALUES(meta_geral),
                meta_individual = VALUES(meta_individual),
                regras_json = VALUES(regras_json),
                ultima_atualizacao = NOW()
        """
        cursor.execute(sql, (meta_geral, meta_individual, regras))
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Configurações publicadas!"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"sucesso": False, "erro": str(e)}), 500
    finally:
        conn.close()


@app.route('/')
def index():
    # Aqui a gente aponta para o seu arquivo de login
    return send_from_directory('templates', 'telalogin.html')

@app.route('/estilos/<path:filename>')
def serve_css(filename):
    return send_from_directory('static/estilos', filename)

@app.route('/javascript/<path:filename>')
def serve_js(filename):
    return send_from_directory('static/javascript', filename)

@app.route('/static/imagens/<path:filename>')
def serve_imagens(filename):
    return send_from_directory('static/imagens', filename)

@app.route('/<pagina>.html')
def carregar_paginas(pagina):
    return send_from_directory('templates', f'{pagina}.html')

@app.route('/<path:filename>')
def serve_static_html(filename):
    if filename.endswith('.html'):
        return send_from_directory('templates', filename)
    return "Arquivo não encontrado", 404

_sessao_fullconsig = None

def get_sessao_fullconsig():
    global _sessao_fullconsig
    _sessao_fullconsig = req_http.Session()
    _sessao_fullconsig.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://sistema.fullconsig.com.br/consulta/consulta"
    })
    resp_login = _sessao_fullconsig.post(
        "https://sistema.fullconsig.com.br/login/login",
        data={"login": os.getenv('FULLCONSIG_LOGIN'), "senha": os.getenv('FULLCONSIG_SENHA')}
    )
    print(f"Login FullConsig - status: {resp_login.status_code} - OK: {'loginForm' not in resp_login.text}")
    return _sessao_fullconsig

@app.route('/consulta-fullconsig/<cpf>', methods=['GET'])
def consulta_fullconsig(cpf):
    global _sessao_fullconsig
    try:
        from bs4 import BeautifulSoup
        from datetime import datetime
        import re, json

        def limpar_valor_monetario(valor_str):
            if not valor_str:
                return 0.0
            valor_str = valor_str.replace('R$', '').strip()
            valor_str = valor_str.replace('.', '').replace(',', '.')
            try:
                return float(valor_str)
            except:
                return 0.0
            
        sessao = get_sessao_fullconsig()
        convenios = ['inss', 'siape', 'governo', 'clt', 'prefeitura', 'forcasArmadas', 'veiculos', 'bolsa']

        soup = None
        convenio_encontrado = None
        dados_raw = None  # guarda o json cru para CLT

        for convenio in convenios:
            if convenio == 'clt':
                url_consulta = "https://sistema.fullconsig.com.br/clt/promosysClt"
            elif convenio == 'prefeitura':
                url_consulta = "https://sistema.fullconsig.com.br/prefeitura/promosysPrefeitura"
            else:
                url_consulta = "https://sistema.fullconsig.com.br/consulta/validaConsultaOffline"

            resp = sessao.post(
                url_consulta,
                data={"consulta": convenio, "valor": cpf, "valorTelefone": "", "telefone": "false"}
            )

            try:
                dados = resp.json()
            except:
                continue

            html_consulta = dados.get("consulta", "")

            # --- Detecção do convênio encontrado ---
            if convenio == 'clt':
                # CLT encontrado: tem o objeto `var consulta = {...}` com CLT_VIEW
                if 'var consulta' in html_consulta and 'CLT_VIEW' in html_consulta:
                    print(f"✅ CPF {cpf} encontrado no convênio: clt")
                    convenio_encontrado = 'clt'
                    dados_raw = html_consulta
                    break
                else:
                    print(f"❌ CPF {cpf} não encontrado em: clt")
                    continue

            elif convenio == 'prefeitura':
                # Prefeitura encontrado: tem input com id começando em cpf_prefeitura_cadastro com value preenchido
                soup_temp = BeautifulSoup(html_consulta, "html.parser")
                inp = soup_temp.find('input', id=lambda x: x and x.startswith('cpf_prefeitura_cadastro'))
                if inp and inp.get('value', '').strip():
                    print(f"✅ CPF {cpf} encontrado no convênio: prefeitura")
                    convenio_encontrado = 'prefeitura'
                    soup = soup_temp
                    break
                else:
                    print(f"❌ CPF {cpf} não encontrado em: prefeitura")
                    continue

            else:
                # INSS e demais: verifica "Nome" nos <span class="inss-data-label">
                soup_temp = BeautifulSoup(html_consulta, "html.parser")
                spans_nome = soup_temp.find_all('span', class_='inss-data-label')
                tem_nome = any('Nome' in span.get_text(strip=True) for span in spans_nome)

                if tem_nome:
                    print(f"✅ CPF {cpf} encontrado no convênio: {convenio}")
                    convenio_encontrado = convenio
                    soup = soup_temp
                    break
                else:
                    print(f"❌ CPF {cpf} não encontrado em: {convenio}")
                    continue

        if not convenio_encontrado:
            return jsonify({"erro": "CPF não encontrado em nenhum convênio"}), 404

        # =============================================
        # PARSER CLT
        # =============================================
        if convenio_encontrado == 'clt':
            match = re.search(r'var consulta\s*=\s*(\{.*?\});\s*\n', dados_raw, re.DOTALL)
            if not match:
                return jsonify({"erro": "Não foi possível extrair dados CLT"}), 500

            try:
                consulta_obj = json.loads(match.group(1))
            except Exception as e:
                return jsonify({"erro": f"Erro ao parsear JSON CLT: {str(e)}"}), 500

            view = consulta_obj.get('CLT_VIEW') or {}

            # Data nascimento: formato "04-AUG-74" ou "04/08/1974"
            dn_raw = view.get('DATA_NASCIMENTO_BR') or view.get('DATA_NASCIMENTO') or ''
            data_nascimento = None
            for fmt in ('%d/%m/%Y', '%d-%b-%y', '%d-%b-%Y'):
                try:
                    data_nascimento = datetime.strptime(dn_raw.strip(), fmt).strftime('%d/%m/%Y')
                    break
                except:
                    continue

            # Sexo: "Feminino"/"Masculino" → "F"/"M"
            sexo = view.get('SEXO', '')

            # Telefones
            telefones = []
            for i in range(1, 6):
                tel = consulta_obj.get(f'TEL_{i}')
                if tel and tel.strip():
                    tel_limpo = re.sub(r'\D', '', tel)
                    if len(tel_limpo) >= 10:
                        telefones.append(tel_limpo)

            # Salário: limpa "R$ 1.942,92" → "1942.92"
            salario_raw = str(view.get('SALARIO_CONTRATADO') or view.get('REM_ULTIMO') or '')
            salario_limpo = re.sub(r'[^\d,]', '', salario_raw).replace(',', '.')

            return jsonify({
                "convenio": "CLT",
                "nome": view.get('NOME'),
                "cpf": consulta_obj.get('CPF'),
                "data_nascimento": data_nascimento,
                "sexo": sexo,
                "telefone": telefones[0] if telefones else None,
                "telefones": telefones,
                "beneficio": None,
                "orgao": view.get('RAZAO_SOCIAL'),
                "cnpj_empresa": view.get('CNPJ_EMPRESA'),
                "data_admissao": view.get('DATA_ADMISSAO_BR'),
                "salario": salario_limpo,
                "nome_mae": None,
                "municipio": view.get('MUNICIPIO_TRABALHADOR'),
                "estado": None,
                "cidade": None,
                "bairro": None,
                "rua": None,
                "numero": None,
            }), 200

        # =============================================
        # PARSER PREFEITURA
        # =============================================
        if convenio_encontrado == 'prefeitura':
            def val_input(id_prefix):
                el = soup.find('input', id=lambda x: x and x.startswith(id_prefix))
                return el['value'].strip() if el and el.get('value', '').strip() else None

            # Data nascimento
            data_nascimento = val_input('data_nascimento_prefeitura_cadastro') or None

            # Sexo via select
            sexo = None
            sel = soup.find('select', id=lambda x: x and x.startswith('genero_prefeitura_cadastro'))
            if sel:
                opt = sel.find('option', selected=True)
                if opt:
                    sexo_raw = opt.get_text(strip=True)
                    sexo = sexo_raw

            # Tabela "Informações": órgão, CNPJ, admissão, salário, nome_mae, email, sexo
            orgao = cnpj = data_admissao = salario = nome_mae = None
            h3_info = soup.find('h3', string=lambda s: s and 'Informa' in s)
            if h3_info:
                tbody = h3_info.find_next('tbody')
                if tbody:
                    tds = tbody.find_all('td')
                    if len(tds) >= 5:
                        orgao        = tds[0].get_text(strip=True) or None
                        cnpj         = tds[1].get_text(strip=True) or None
                        data_admissao = tds[2].get_text(strip=True) or None
                        salario_raw  = tds[3].get_text(strip=True)
                        # "R$ 0,00" → limpa
                        salario = re.sub(r'[^\d,]', '', salario_raw).replace(',', '.') or None
                        nome_mae     = tds[4].get_text(strip=True) or None
                        if not sexo and len(tds) >= 7:
                            sexo_raw = tds[6].get_text(strip=True)
                            sexo = 'F' if sexo_raw.upper() == 'F' else 'M'

            # Telefones via inputs tel1/tel2
            telefones = []
            for prefix in ['tel1_prefeitura_cadastro', 'tel2_prefeitura_cadastro']:
                tel = val_input(prefix)
                if tel:
                    tel_limpo = re.sub(r'\D', '', tel)
                    if len(tel_limpo) >= 10:
                        telefones.append(tel_limpo)

            return jsonify({
                "convenio": "PREFEITURA",
                "nome": val_input('nome_prefeitura_cadastro'),
                "cpf": (val_input('cpf_prefeitura_cadastro') or '').replace('.', '').replace('-', ''),
                "data_nascimento": data_nascimento,
                "sexo": sexo,
                "telefone": telefones[0] if telefones else None,
                "telefones": telefones,
                "beneficio": val_input('numero_beneficio_prefeitura_cadastro'),
                "orgao": orgao,
                "cnpj_empresa": cnpj,
                "data_admissao": data_admissao,
                "salario": salario,
                "nome_mae": nome_mae,
                "municipio": None,
                "estado": None,
                "cidade": None,
                "bairro": None,
                "rua": None,
                "numero": None,
            }), 200

        # =============================================
        # PARSER INSS/SIAPE/GOVERNO/etc (original)
        # =============================================
        resultado = {
            "convenio": convenio_encontrado.upper(),
            "nome": None,
            "cpf": cpf,
            "data_nascimento": None,
            "beneficio": None,
            "sexo": None,
            "telefone": None,
            "telefones": [],
            "orgao": None,
            "data_admissao": None,
            "salario": None,
            "nome_mae": None,
            "municipio": None,
            "estado": None,
            "cidade": None,
            "bairro": None,
            "rua": None,
            "numero": None,
        }

        # NOVO PARSER: pega os dados das spans inss-data-label
        try:
            for div in soup.find_all('div', class_='inss-data-row'):
                label = div.find('span', class_='inss-data-label')
                value = div.find('span', class_='inss-data-value')
                
                if label and value:
                    texto_label = label.get_text(strip=True)
                    texto_valor = value.get_text(strip=True)
                    
                    if 'Nome' in texto_label:
                        resultado["nome"] = texto_valor
                    elif 'Nascimento' in texto_label:
                        # Formato: "19/11/1960 · 65 Anos"
                        dn = texto_valor.split('·')[0].strip()
                        resultado["data_nascimento"] = dn
                    elif 'Endereço' in texto_label:
                        # Formato: "RUA, BAIRRO, CIDADE - ESTADO CEP"
                        # Usa get_text com separador pra pegar as quebras de linha
                        endereco_completo = value.get_text(separator='\n', strip=True)
                        linhas = endereco_completo.split('\n')
                        if len(linhas) > 0:
                            resultado["rua"] = linhas[0].strip()
                        if len(linhas) > 1:
                            cidade_estado = linhas[1].strip()
                            if '-' in cidade_estado:
                                cidade, estado = cidade_estado.split('-', 1)
                                resultado["cidade"] = cidade.strip()
                                resultado["estado"] = estado.strip()
        except Exception as e:
            print(f"⚠️ Erro ao parsear dados INSS: {e}")

        # Telefone
        telefones = []
        tabela_tel = soup.find('table', {'id': lambda x: x and 'tabelaWhatsapp' in x})
        if tabela_tel:
            for td in tabela_tel.select('td'):
                texto = re.sub(r'\D', '', td.get_text(strip=True))
                if texto.isdigit() and len(texto) >= 10:
                    telefones.append(texto)
        
        resultado["telefones"] = telefones
        resultado["telefone"] = telefones[0] if telefones else None

        idade = None
        if resultado.get("data_nascimento"):
            try:
                dn = datetime.strptime(resultado["data_nascimento"], '%d/%m/%Y')
                hoje = datetime.now()
                idade = hoje.year - dn.year
                if (hoje.month, hoje.day) < (dn.month, dn.day):
                    idade -= 1
                resultado["idade"] = idade
            except:
                resultado["idade"] = 0
        else:
            resultado["idade"] = 0
        margem_total = 0.0
        margem_rmc = 0.0
        margem_rcc = 0.0

        div_margens = soup.find('div', class_='d-flex justify-content-center margem')
        if div_margens:
            card_total = div_margens.find('div', class_='total-disponivel')
            if card_total:
                spans = card_total.find_all('span')
                if len(spans) >= 2:
                    valor_texto = spans[1].get_text(strip=True)
                    margem_total = limpar_valor_monetario(valor_texto)
            card_rmc = div_margens.find('div', class_='rmc-disponivel')
            if card_rmc:
                spans = card_rmc.find_all('span')
                if len(spans) >= 2:
                    valor_texto = spans[1].get_text(strip=True)
                    margem_rmc = limpar_valor_monetario(valor_texto)
            card_rcc = div_margens.find('div', class_='rcc-disponivel')
            if card_rcc:
                spans = card_rcc.find_all('span')
                if len(spans) >= 2:
                    valor_texto = spans[1].get_text(strip=True)
                    margem_rcc = limpar_valor_monetario(valor_texto)
        
        # =============================================
        # EXTRAIR CONTRATOS (via JavaScript no HTML)
        # =============================================
        contratos = []

        match_contratos = re.search(r'var contratos\s*=\s*(\[.*?\]);', html_consulta, re.DOTALL)
        bancos_refin_port_globais = []

        if match_contratos:
            try:
                contratos_str = match_contratos.group(1)
                contratos_data = json.loads(contratos_str)

                for c in contratos_data:
                    if c.get('Banco') and c.get('Banco_Nome'):
                        try:
                            parcelas_pagas = int(c.get('ParcPagas', 0))
                            prazo_total = int(c.get('Prazo', 0))
                            parcelas_restantes = prazo_total - parcelas_pagas if prazo_total > 0 else 0
                            
                            contrato = {
                                'banco': c.get('Banco_Nome', ''),
                                'numero': c.get('Contrato', ''),
                                'averbacao': c.get('dt_averbacao', ''),
                                'inicio_desconto': c.get('InicioDesconto', ''),
                                'final_desconto': c.get('FinalDesconto', ''),
                                'valor_contrato': float(c.get('Vl_Emprestimo', 0)) if c.get('Vl_Emprestimo') else 0.0,
                                'taxa': float(c.get('TaxaJuros', 0) or 0),
                                'prazo_total': prazo_total,
                                'parcelas_pagas': f"{parcelas_pagas}/{prazo_total} - {parcelas_restantes} Restantes",
                                'valor_parcela': float(c.get('Vl_Parcela', 0)) if c.get('Vl_Parcela') else 0.0,
                                'quitacao': float(c.get('QUITACAOATUAL', 0)) if c.get('QUITACAOATUAL') else 0.0
                            }
                            contratos.append(contrato)
                        except Exception as e:
                            print(f'Erro ao processar contrato: {e}')
                            continue
                
                for contrato in contratos:
                    numero = contrato.get('numero', '')
                    if not numero:
                        continue

                    # Busca o select de bancos de refin portabilidade pelo número do contrato
                    select_refin_port = soup.find('select', id=lambda x: x and 'selectTipoOperacaoBancoRefinPort' in x and numero in (x or ''))

                    

                    bancos_port = []
                    if select_refin_port:
                        for option in select_refin_port.find_all('option'):
                            valor = option.get('value', '').strip()
                            texto = option.get_text(strip=True)
                            if valor and valor != '':
                                bancos_port.append({
                                    'codigo': valor,
                                    'nome': texto
                                })
                    contrato['bancos_refin_port'] = bancos_port

                
                selects_refin_port = soup.find_all('select', id=lambda x: x and 'selectTipoOperacaoBancoRefinPort' in x)
                for select in selects_refin_port:
                    for option in select.find_all('option'):
                        valor = option.get('value', '').strip()
                        texto = option.get_text(strip=True)
                        if valor:
                            if not any(b['codigo'] == valor for b in bancos_refin_port_globais):
                                bancos_refin_port_globais.append({'codigo': valor, 'nome': texto})

                print(f"      🔍 Bancos refin port disponíveis: {bancos_refin_port_globais}")

                print(f"✅ Extraídos {len(contratos)} contratos do JavaScript")
            except Exception as e:
                print(f"❌ Erro ao parsear contratos JS: {e}")
                contratos = []
        else:
            print("⚠️ Variável 'contratos' não encontrada no HTML")

        resultado["bancos_refin_port"] = bancos_refin_port_globais
        resultado["margem_total"] = margem_total
        resultado["margem_rmc"] = margem_rmc
        resultado["margem_rcc"] = margem_rcc
        resultado["contratos"] = contratos
        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


# =============================================
# COMANDO PARA PROCESSAR OPORTUNIDADES (ROBÔ)
# =============================================
@app.cli.command('processar-oportunidades')
@click.argument('cpf', required=False, default=None)
def processar_oportunidades(cpf=None):
    """processa todos os clientes e salva oportunidades"""
    print("🚀 Iniciando processamento de oportunidades...")

    conn = conexao_db()
    if not conn:
        print("❌ Erro na conexão com o banco de dados.")
        return
    
    cursor = conn.cursor(dictionary=True)
    if cpf:
        cursor.execute("SELECT cpf, nome FROM clientes WHERE cpf = %s", (cpf,))
    else:
        cursor.execute("SELECT cpf, nome FROM clientes")
    clientes = cursor.fetchall()
    cursor.close()
    conn.close()

    print(f"🔍 Encontrados {len(clientes)} clientes")

    for i, cliente in enumerate(clientes, 1):
        cpf = cliente['cpf']
        nome = cliente['nome']

        print(f"\n[{i}/{len(clientes)}] Processando {nome} - {cpf}")

        try:
            with app.test_client() as client:
                resp = client.get(f'/consulta-fullconsig/{cpf}')

                if resp.status_code != 200:
                    print(f"❌ Erro {resp.status_code}")
                    continue
                dados = resp.get_json()

                idade = dados.get('idade') or dados.get('IDADE') or 0

                oportunidades = []
                tipo_final = ''

                margens = []
                if idade <= 75:
                    if dados.get('margem_total', 0) >= 20:
                        margens.append('margem')
                    if dados.get('margem_rmc', 0) >= 20:
                        margens.append('margem_rmc')
                    if dados.get('margem_rcc', 0) >= 20:
                        margens.append('margem_rcc')
                else:
                    print(f'⏭️  Cliente com {idade} anos - sem margem (limite 75)')

                contratos_portaveis = []
                cartoes = []
                simulacoes = []

                if idade <= 73:

                    for ct in dados.get('contratos', []):

                        final_desconto = ct.get('final_desconto', '')
                        banco = ct.get('banco', '').upper()

                        if final_desconto == '000000' and 'BMG' in banco:
                            if ct.get('valor_parcela', 0) > 0:
                                
                                    
                                cartoes.append({
                                    'banco': ct['banco'],
                                    'parcela_minima': ct['valor_parcela'],
                                    'numero': ct.get('numero', ''),
                                    'tipo':'cartao'
                                })
                        
                        elif final_desconto != '000000' and final_desconto != '':
                            parcelas_str = ct.get('parcelas_pagas', '')
                            pagas = 0

                            if '/' in parcelas_str:
                                try:
                                    pagas = int(parcelas_str.split('/')[0])
                                except:
                                    pass
                            if ct.get('valor_parcela', 0) >= 20 and pagas >= 12:
                                contratos_portaveis.append({
                                    'banco': ct['banco'],
                                    'parcela': ct['valor_parcela'],
                                    'parcelas_pagas': pagas,
                                    'quitacao': ct['quitacao'],
                                    'taxa': ct.get('taxa', 0),
                                    'prazo': ct.get('prazo_total', 0),  # ← limpo, sem split
                                    'bancos_disponiveis': ct.get('bancos_refin_port', [])
                                })
                            else:
                                print(f"  ⏭️ Contrato ignorado: {ct['banco']} | parcela={ct.get('valor_parcela')} | pagas={pagas} | prazo={ct.get('prazo_total')}")
                    
                    if contratos_portaveis:
                        session_fc = get_sessao_fullconsig()
                        bancos_disponiveis = dados.get('bancos_refin_port', [])
                        for ct in contratos_portaveis:
                            ct['bancos_disponiveis'] = bancos_disponiveis
                            print(f"      🔄 Simulando portabilidade: {ct['banco']} R$ {ct['parcela']}")
                            sim = simular_contrato(session_fc, ct)
                            if sim is None:
                                print(f"      ❌ Sem simulação disponível: {ct['banco']} R$ {ct['parcela']}")
                                continue

                            simulacoes.append({
                                'banco_origem': ct['banco'],
                                'parcela':      ct['parcela'],
                                'quitacao':     ct['quitacao'],
                                'simulacao':    sim
                            })
                            time.sleep(1)
                else:
                    print(f"   ⏭️  Cliente com {idade} anos - sem portabilidade (limite 73)")

                tipos = []
                if margens:
                    tipos.extend(margens)
                if contratos_portaveis:
                    tipos.append('portabilidade')
                if cartoes:
                    tipos.append('cartao')

                if not tipos:
                    print(' Sem oportunidades')
                    continue

                tipo_final = '+'.join(tipos)

                margem_principal = dados.get('margem_total', 0)
                if margem_principal < 20:
                    margem_principal = dados.get('margem_rmc', 0)
                if margem_principal < 20:
                    margem_principal = dados.get('margem_rcc', 0)

                conn_db = conexao_db()
                cur = conn_db.cursor()

                bancos_simulados = {s['banco_origem'] for s in simulacoes}
                contratos_portaveis = [ct for ct in contratos_portaveis if ct['banco'] in bancos_simulados]

                if not contratos_portaveis:
                    tipos = [t for t in tipos if t != 'portabilidade']
                    tipo_final = '+'.join(tipos)

                sql = """
                    INSERT INTO oportunidades 
                    (cpf, nome, idade, tipo, margem_disponivel, margem_rmc, margem_rcc, 
                    contratos_portaveis, cartoes, simulacao_portabilidade, data_simulacao, data_consulta, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), 'ativo')
                    ON DUPLICATE KEY UPDATE
                        idade = VALUES(idade),
                        tipo = VALUES(tipo),
                        margem_disponivel = VALUES(margem_disponivel),
                        margem_rmc = VALUES(margem_rmc),
                        margem_rcc = VALUES(margem_rcc),
                        contratos_portaveis = VALUES(contratos_portaveis),
                        cartoes = VALUES(cartoes),
                        simulacao_portabilidade = VALUES(simulacao_portabilidade),
                        data_simulacao = VALUES(data_simulacao),
                        data_consulta = NOW(),
                        status = 'ativo'
                """

                cur.execute(sql, (
                    cpf,
                    dados.get('nome'),
                    idade,
                    tipo_final,
                    dados.get('margem_total', 0),
                    dados.get('margem_rmc', 0),
                    dados.get('margem_rcc', 0),
                    json.dumps(contratos_portaveis, ensure_ascii=False) if contratos_portaveis else None,
                    json.dumps(cartoes, ensure_ascii=False) if cartoes else None,
                    json.dumps(simulacoes, ensure_ascii=False) if simulacoes else None,
                    datetime.now() if simulacoes else None,
                ))

                conn_db.commit()
                cur.close()
                conn_db.close()

                print(f"   ✅ OPORTUNIDADE! {tipo_final}")
        except Exception as e:
            print(f"❌ Erro: {e}")
            
        if i < len(clientes):
            espera = random.uniform(5, 15)
            print(f"   ⏳ Aguardando {espera:.0f} segundos...")
            time.sleep(espera)
    print("\n✅ Processamento finalizado!")

@app.route('/api/oportunidades', methods=['GET'])
def listar_oportunidades():
    conn = conexao_db()
    if not conn:
        return jsonify({"erro": "Erro na conexão"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                id, cpf, nome, idade, tipo,
                margem_disponivel, margem_rmc, margem_rcc,
                contratos_portaveis,
                cartoes,
                simulacao_portabilidade,
                data_simulacao,
                DATE_FORMAT(data_consulta, '%d/%m/%Y %H:%i') as data_consulta
            FROM oportunidades 
            WHERE status = 'ativo'
            ORDER BY 
                CASE 
                    WHEN tipo LIKE '%portabilidade%' THEN 1
                    WHEN tipo LIKE '%cartao%' THEN 2
                    WHEN tipo LIKE '%margem%' THEN 3
                    ELSE 4
                END,
                data_consulta DESC
        """)
        oportunidades = cursor.fetchall()

        for op in oportunidades:
            if op['contratos_portaveis'] and isinstance(op['contratos_portaveis'], str):
                op['contratos_portaveis'] = json.loads(op['contratos_portaveis'])
            if op['cartoes'] and isinstance(op['cartoes'], str):
                op['cartoes'] = json.loads(op['cartoes'])
            if op['simulacao_portabilidade'] and isinstance(op['simulacao_portabilidade'], str):
                op['simulacao_portabilidade'] = json.loads(op['simulacao_portabilidade'])
            if op['data_simulacao']:
                op['data_simulacao'] = op['data_simulacao'].strftime('%d/%m/%Y %H:%i')
        
        conn.close()
        return jsonify(oportunidades), 200
    except Exception as e:
        conn.close()
        return jsonify({"erro": str(e)}), 500


BANCOS_PRIORITARIOS = [
    {'nome': 'Daycoval', 'codigo': '707'},
    {'nome': 'iCred',    'codigo': '3295'},
    {'nome': 'Qualibank','codigo': '3298'},
    {'nome': 'C6',       'codigo': '626'},
    {'nome': 'PicPay',   'codigo': '079'},
    # {'nome': 'Finanto', 'codigo': '???'},
]

def simular_contrato(session_fc, contrato):
    base_url = 'https://sistema.fullconsig.com.br'
    resultados = []

    bancos_disponiveis = contrato.get('bancos_disponiveis', [])
    if bancos_disponiveis:
        codigos_disponiveis = {b['codigo'] for b in bancos_disponiveis}
        bancos_para_simular = [b for b in BANCOS_PRIORITARIOS if b['codigo'] in codigos_disponiveis]
        if not bancos_para_simular:
            # banco disponível não tá na nossa lista prioritária, usa os disponíveis mesmo
            bancos_para_simular = bancos_disponiveis
    else:
        bancos_para_simular = BANCOS_PRIORITARIOS

    for banco in bancos_para_simular:
        try:
            r1 = session_fc.post(f'{base_url}/consulta/tabelasRefinPortabilidade', data={
                'banco':          banco['codigo'],
                'valor_parcela':  contrato['parcela'],
                'valor_quitacao': contrato['quitacao'],
                'prazo':          contrato['prazo'],
                'taxa':           contrato['taxa'],
            })
            
            tabelas_raw = r1.json() if r1.ok else {}
            if isinstance(tabelas_raw, list):
                tabelas = tabelas_raw
            elif isinstance(tabelas_raw, dict):
                tabelas = list(tabelas_raw.values())
            else:
                tabelas = []

            if not tabelas:
                print(f"      ⏭️ {banco['nome']}: sem tabela disponível")
                continue

        
            melhor_tabela = tabelas[0]

            r2 = session_fc.post(f'{base_url}/consulta/tabelasRefinPortabilidadeDetalhes', data={
                'banco':          banco['codigo'],
                'nome_tabela':    melhor_tabela['NOME_TABELA'],
                'parcela_valor':  contrato['parcela'],
                'valor_quitacao': contrato['quitacao'],
                'prazo':          contrato['prazo'],
            })

            if not r2.ok:
                continue

            sim = r2.json()
            if sim.get('CODE') != 200:
                continue

            troco_raw = str(sim.get('TROCO', '0')).replace('.', '').replace(',', '.')
            
            try:
                troco_float = float(troco_raw)
            except ValueError:
                print(f"      ⏭️ {banco['nome']}: troco inválido ({sim.get('TROCO')})")
                continue
            if troco_float <= 0:
                print(f"      ⏭️ {banco['nome']}: troco zero")
                continue

            
            resultados.append({
                'banco_destino':  banco['nome'],
                'tabela':         melhor_tabela['NOME_TABELA'],
                'taxa':           melhor_tabela['TAXA'],
                'parcela_nova':   sim.get('VALOR_PARCELA_NOVA'),
                'valor_cliente':  sim.get('TROCO'),
                'quitacao':       sim.get('VALOR_QUITACAO'),
                'troco':          sim.get('TROCO'),
                '_valor_float':   float(troco_raw),
            })
            print(f"      ✅ {banco['nome']}: tabela={melhor_tabela['NOME_TABELA']} | valor_cliente=R$ {sim.get('TROCO')} | quitacao=R$ {sim.get('VALOR_QUITACAO')}")

            
        except Exception as e:
            print(f"      ⚠️ Erro simulando banco {banco['nome']}: {e}")
            continue
    if not resultados:
        return None
    
    melhor = max(resultados, key=lambda x: x['_valor_float'])
    melhor.pop('_valor_float')
    return melhor

@app.route('/api/simular-portabilidade', methods=['POST'])
def simular_portabilidade():
    data = request.json
    parcela = data.get('parcela')
    quitacao = data.get('quitacao')
    prazo = data.get('prazo')

    session_fc = get_sessao_fullconsig()
    base_url = 'https://sistema.fullconsig.com.br'

    resultados = []

    for banco in BANCOS_PRIORITARIOS:
        # Request 1 — busca tabelas disponíveis
        r1 = session_fc.post(f'{base_url}/consulta/tabelasRefinPortabilidade', data={
            'banco':banco['codigo'],
            'valor_parcela': parcela,
            'valor_quitacao': quitacao,
            'prazo': prazo
        })

        print(f"      🔍 {banco['nome']} r1 status={r1.status_code} body={r1.text[:100]}")


        tabelas = r1.json() if r1.ok else []
        if not tabelas or not isinstance(tabelas, list):
            print(f"      ⏭️ {banco['nome']}: resposta inválida: {tabelas}")
            continue
        
        melhor_tabela = tabelas[0]

        # Request 2 — simula com a melhor tabela
        r2 = session_fc.post(f'{base_url}/consulta/tabelasRefinPortabilidadeDetalhes', data={
            'banco': banco['codigo'],
            'nome_tabela': melhor_tabela['NOME_TABELA'],
            'parcela_valor': parcela,
            'valor_quitacao': quitacao,
            'prazo': prazo
        })

        if not r2.ok:
            continue
        sim = r2.json()
        if sim.get('CODE') != 200:
            continue

        troco_raw = str(sim.get('TROCO', '0')).replace('.', '').replace(',', '.')
        resultados.append({
            'banco': banco['nome'],
            'tabela': melhor_tabela['NOME_TABELA'],
            'taxa': melhor_tabela['TAXA'],
            'parcela_nova':  sim.get('VALOR_PARCELA_NOVA'),
            'valor_cliente': sim.get('TROCO'),
            'quitacao':      sim.get('VALOR_QUITACAO'),
            'troco':         sim.get('TROCO'),
            '_valor_float':  float(troco_raw),
        })
    
    if not resultados:
        return jsonify({'erro': 'Nenhum banco disponível para simulação'}), 404
    
    melhor = max(resultados, key=lambda x: x['_valor_float'])
    melhor.pop('_valor_float')
    return jsonify(melhor), 200

@app.route('/lotes/salvar', methods=['POST'])
def salvar_lote():
    dados = request.json
    usuario_id = dados.get('usuario_id')
    total = dados.get('total')
    aprovados = dados.get('aprovados')
    resultados = dados.get('resultados', [])

    conn = conexao_db()
    if not conn:
        return jsonify({"Erro": "Erro na conexão"}), 500
    
    try:
        cursor = conn.cursor()

        # CRIA O LOTE
        cursor.execute("""
            INSERT INTO lotes (usuario_id, total_clientes, total_aprovados)
            VALUES (%s, %s, %s)
        """, (usuario_id, total, aprovados))
        lote_id = cursor.lastrowid

        # SALVA CADA APROVADO
        for r in resultados:
            cursor.execute("""
                INSERT INTO lote_resultados 
                (lote_id, cpf, nome, nome_mae, data_nascimento, sexo, data_admissao, telefone, email, status, margem, valor_liberado, parcela, prazo)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                lote_id,
                r.get('cpf'),
                r.get('nome'),
                r.get('nome_mae'),
                r.get('data_nascimento'),
                r.get('sexo'),
                r.get('data_admissao'),
                r.get('telefone'),
                r.get('email'),
                'aprovado',
                r.get('margem'),
                r.get('valor_simulado'),
                r.get('parcela'),
                r.get('prazo')
            ))

        conn.commit()
        return jsonify({"sucesso": True, "lote_id": lote_id}), 201
    except Exception as e:
        conn.rollback()
        print(f'❌ Erro ao salvar o lote: {e}')
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route('/lotes/historico', methods = ['GET'])
def buscar_historico_lotes():
    conn = conexao_db()
    if not conn:
        return jsonify({"erro": "Erro na conexão"}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, data_processamento, total_clientes, total_aprovados
            FROM lotes
            ORDER BY data_processamento DESC
            LIMIT 20
        """)
        lotes = cursor.fetchall()
        return jsonify(lotes), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()

@app.route('/lotes/detalhe/<int:lote_id>', methods=['GET'])
def buscar_detalhe_lote(lote_id):
    conn = conexao_db()
    if not conn:
        return jsonify({"erro": "Erro na conexão"}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT cpf, nome, nome_mae, data_nascimento, sexo, data_admissao,
                   telefone, email, margem, valor_liberado, parcela, prazo
            FROM lote_resultados
            WHERE lote_id = %s
        """, (lote_id,))
        resultados = cursor.fetchall()
        return jsonify(resultados), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        conn.close()
        
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
