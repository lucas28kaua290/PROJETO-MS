    const toggleBtn = document.getElementById('toggleMenu');
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const overlay = document.getElementById('overlay');
    let vaiAtualizarDado = true;
    let stepAtual = 1;
    const totalSteps = 5;
    let stepAtualCarteira = 1;
    const totalStepsCarteira = 4;


    function proximoStepCarteira() {
        if (stepAtualCarteira === 1) {
            const cpfRaw = document.getElementById('icliente').value;
            const cpfNumeros = cpfRaw.replace(/\D/g, '');
            if (cpfNumeros.length !== 11) {
                alert('Digite um CPF válido!');
                return;
            }
            proximoPasso(1);
            return;
        }

        // Step 2: navegação é pelos botões Sim/Não, não pelo Próximo
        if (stepAtualCarteira === 2) {
            return;
        }

        // Step 3: executar lógica de seleção do dado E/OU validar antes de avançar
        if (stepAtualCarteira === 3) {
            const dadoSelecionado = document.getElementById('tipoAtualizacaoDadoCliente').value;

            // Se ainda não escolheu nada, executa a lógica de mostrar o campo
            if (!tipoSelecionado) {
                if (!dadoSelecionado) {
                    alert('Selecione um dado para atualizar!');
                    return;
                }
                avancarNoStep3();
                return;
            }

            // Se já escolheu, valida o preenchimento
            if (tipoSelecionado === 'endereco') {
                const estado = document.getElementById('enderecoEstado').value;
                const cidade = document.getElementById('enderecoCidade').value;
                const bairro = document.getElementById('enderecoBairro').value;
                const rua = document.getElementById('enderecoRua').value;
                const numero = document.getElementById('enderecoNumero').value;
                if (!estado || !cidade || !bairro || !rua || !numero) {
                    alert('Preencha todos os campos de endereço!');
                    return;
                }
            } else {
                if (!document.getElementById('novoValor').value) {
                    alert('Preencha o novo valor!');
                    return;
                }
            }

            avancarStepCarteira();
            return;
        }

        // Step 4 não tem Próximo, tem Atualizar
        avancarStepCarteira();

    }

    function avancarStepCarteira() {
        // Esconde step atual
        document.getElementById('stepC' + stepAtualCarteira).style.display = 'none';

        // Marca como completed
        const stepEl = document.querySelector('.carteira-steps .step[data-step="' + stepAtualCarteira + '"]');
        stepEl.classList.remove('active');
        stepEl.classList.add('completed');

        // Avança
        stepAtualCarteira++;

        // Mostra próximo
        document.getElementById('stepC' + stepAtualCarteira).style.display = 'block';

        // Marca como active
        const nextStepEl = document.querySelector('.carteira-steps .step[data-step="' + stepAtualCarteira + '"]');
        nextStepEl.classList.add('active');

        // Atualiza botões
        atualizarBotoesCarteira();
    }

    function stepAnteriorCarteira() {
        if (stepAtualCarteira <= 1) return;

        document.getElementById('stepC' + stepAtualCarteira).style.display = 'none';

        const stepEl = document.querySelector('.carteira-steps .step[data-step="' + stepAtualCarteira + '"]');
        stepEl.classList.remove('active');

        stepAtualCarteira--;

        const prevStepEl = document.querySelector('.carteira-steps .step[data-step="' + stepAtualCarteira + '"]');
        prevStepEl.classList.remove('completed');
        prevStepEl.classList.add('active');

        document.getElementById('stepC' + stepAtualCarteira).style.display = 'block';

        atualizarBotoesCarteira();
    }

    function atualizarBotoesCarteira() {
        const btnVoltar = document.getElementById('btnVoltarCarteira');
        const btnProximo = document.getElementById('btnProximoCarteira');
        const btnAtualizarFinal = document.getElementById('btnAtualizarCarteira');

        // Botão Voltar
        if (stepAtualCarteira === 1) {
            btnVoltar.style.display = 'none';
        } else {
            btnVoltar.style.display = 'inline-block';
        }

        // Step 2: esconde Próximo (a navegação é pelos botões Sim/Não)
        if (stepAtualCarteira === 2) {
            btnProximo.style.display = 'none';
            btnAtualizarFinal.style.display = 'none';
            return;
        }

        // Step 4: mostra Atualizar, esconde Próximo
        if (stepAtualCarteira === totalStepsCarteira) {
            btnProximo.style.display = 'none';
            btnAtualizarFinal.style.display = 'inline-block';
        } else {
            btnProximo.style.display = 'inline-block';
            btnAtualizarFinal.style.display = 'none';
        }
    }

    // =============================================
    // NOVO: CONTROLE DO SWITCH (NOVO / CARTEIRA)
    // =============================================

    const switchOptions = document.querySelectorAll('#switchModo .switch-option');
    const blocoNovo = document.getElementById('blocoNovo');
    const blocoCarteira = document.getElementById('blocoCarteira');

    switchOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove active de todos
            switchOptions.forEach(opt => opt.classList.remove('active'));
            // Adiciona active no clicado
            this.classList.add('active');

            const modo = this.dataset.modo;

            if (modo === 'novo') {
                blocoNovo.style.display = 'flex';
                blocoCarteira.style.display = 'none';
            } else {
                blocoNovo.style.display = 'none';
                blocoCarteira.style.display = 'flex';
            }
        });
    });


    // Função para formatar CPF
    function formatarCPF(cpf) {
        cpf = cpf.replace(/\D/g, ''); // remove tudo que não é dígito
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2'); // adiciona ponto após 3 dígitos
        cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2'); // adiciona ponto após mais 3
        cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2'); // adiciona traço antes dos últimos 2
        return cpf;
    }

    // Função para formatar telefone
    function formatarTelefone(telefone) {
        telefone = telefone.replace(/\D/g, ''); // remove não dígitos
        telefone = telefone.replace(/(\d{2})(\d)/, '($1) $2'); // (XX) 
        telefone = telefone.replace(/(\d{5})(\d{4})$/, '$1-$2'); // XXXXX-XXXX
        return telefone;
    }

    // Função para formatar benefício
    function formatarBeneficio(beneficio) {
        beneficio = beneficio.replace(/\D/g, ''); // remove não dígitos
        beneficio = beneficio.replace(/(\d{3})(\d)/, '$1.$2'); // XXX.
        beneficio = beneficio.replace(/(\d{3})(\d)/, '$1.$2'); // XXX.XXX.
        beneficio = beneficio.replace(/(\d{3})(\d{1})$/, '$1-$2'); // XXX.XXX.XXX-X
        return beneficio;
    }

    // Toggle do botão normal da sidebar (desktop)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            sidebar.classList.toggle('aberto');
            // Para mobile, ativa overlay
            if (window.innerWidth <= 768 && overlay) {
                overlay.classList.toggle('ativo');
            }
        });
    }

    // Menu hambúrguer mobile
    if (menuToggle) {
        menuToggle.addEventListener('click', function () {
            sidebar.classList.toggle('aberto');
            menuToggle.classList.toggle('ativo');
            if (overlay) overlay.classList.toggle('ativo');
        });
    }

    // Fecha ao clicar no overlay
    if (overlay) {
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('aberto');
            if (menuToggle) menuToggle.classList.remove('ativo');
            overlay.classList.remove('ativo');
        });
    }

    let tipoSelecionado; // variável para armazenar o tipo de dado selecionado
    let parteEndereco; // variável para armazenar a parte do endereço

    const estados = [
    "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia",
    "Ceará", "Distrito Federal", "Espírito Santo", "Goiás",
    "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
    "Minas Gerais", "Pará", "Paraíba", "Paraná",
    "Pernambuco", "Piauí", "Rio de Janeiro",
    "Rio Grande do Norte", "Rio Grande do Sul",
    "Rondônia", "Roraima", "Santa Catarina",
    "São Paulo", "Sergipe", "Tocantins"
    ]

    const selectEstado = document.getElementById('estado')

    if (selectEstado) {
    estados.forEach(estado => {
        const option = document.createElement('option')
        option.value = estado
        option.textContent = estado
        selectEstado.appendChild(option)
    })
    }

    function proximoStep() {
        //validação simples dos campos obrigatórios do step atual

        if (stepAtual === 1) {
            const cpf = document.getElementById('icpf').value;
            const nome = document.getElementById('inome').value;
            const dataNasc = document.getElementById('idataNasc').value;
            const beneficio = document.getElementById('ibeneficio').value;
            const telefone = document.getElementById('itelefone').value;
            const senha = document.getElementById('senhaInss').value;
            const convenio = document.getElementById('tipoConvenio').value;

            if (!cpf || !nome || !dataNasc || !beneficio || !telefone || !senha || !convenio) {
                alert('Preencha todos os campos obrigatórios antes de avançar.');
                return;
            }
        }

        if (stepAtual === 2) {
            const estado = document.getElementById('estado').value;
            const cidade = document.getElementById('cidade').value;
            const bairro = document.getElementById('bairro').value;
            const rua = document.getElementById('irua').value;
            const numero = document.getElementById('inumero').value;

            if (!estado || !cidade || !bairro || !rua || !numero) {
                alert('Preencha todos os campos de endereço antes de avançar.');
                return;
            }
        }

        document.getElementById('step' + stepAtual).style.display = 'none';

        document.querySelector('.step[data-step="' + stepAtual + '"]').classList.remove('active');
        document.querySelector('.step[data-step="' + stepAtual + '"]').classList.add('completed');

        stepAtual++;

        document.getElementById('step' + stepAtual).style.display = 'block';

        document.querySelector('.step[data-step="' + stepAtual + '"]').classList.add('active');
        atualizarBotoes();

        if (stepAtual === 5) {
            preencherResumo();
        }

    }

    function stepAnterior() {
        if (stepAtual <= 1) return;

        document.getElementById('step' + stepAtual).style.display = 'none';
        document.querySelector('.step[data-step="' + stepAtual + '"]').classList.remove('active');
        stepAtual--;

        document.querySelector('.step[data-step="' + stepAtual + '"]').classList.remove('completed');
        document.querySelector('.step[data-step="' + stepAtual + '"]').classList.add('active');

        document.getElementById('step' + stepAtual).style.display = 'block';

        atualizarBotoes();
    }

    function atualizarBotoes() {
        const btnVoltar = document.getElementById('btnVoltar');
        const btnProximo = document.getElementById('btnProximo');
        const btnCadastrar = document.getElementById('btnCadastrar');

        if (stepAtual === 1) {
            btnVoltar.style.display = 'none';
        } else {
            btnVoltar.style.display = 'inline-block';
        }

        if (stepAtual === totalSteps) {
            btnProximo.style.display = 'none';
            btnCadastrar.style.display = 'inline-block';
        } else {
            btnProximo.style.display = 'inline-block';
            btnCadastrar.style.display = 'none';
        }
    }

    function preencherResumo() {
        // Dados Pessoais
        document.getElementById('resNome').textContent = document.getElementById('inome').value || '—';
        document.getElementById('resCpf').textContent = document.getElementById('icpf').value || '—';
        document.getElementById('resNasc').textContent = document.getElementById('idataNasc').value || '—';
        document.getElementById('resBeneficio').textContent = document.getElementById('ibeneficio').value || '—';
        document.getElementById('resTelefone').textContent = document.getElementById('itelefone').value || '—';
        document.getElementById('resConvenio').textContent = document.getElementById('tipoConvenio').value || '—';

        // Endereço
        document.getElementById('resEstado').textContent = document.getElementById('estado').value || '—';
        document.getElementById('resCidade').textContent = document.getElementById('cidade').value || '—';
        document.getElementById('resBairro').textContent = document.getElementById('bairro').value || '—';
        document.getElementById('resRua').textContent = document.getElementById('irua').value || '—';
        document.getElementById('resNumero').textContent = document.getElementById('inumero').value || '—';

        // Operações
        const linhas = document.querySelectorAll('#corpoTabelaOperacoes .linha-operacao-item');
        let temOperacao = false;
        let htmlOps = '';
        linhas.forEach((linha, index) => {
            const tipo = linha.querySelector('.ioperacao').value;
            const data = linha.querySelector('.dataProd').value;
            const banco = linha.querySelector('.bancoProd').value;
            if (tipo.trim() !== '') {
                temOperacao = true;
                htmlOps += `<div style="margin-bottom:4px;">• <strong>${tipo}</strong> — ${data || 'sem data'} — ${banco || 'não informado'}</div>`;
            }
        });
        document.getElementById('resOperacoes').innerHTML = temOperacao ? htmlOps : 'Nenhuma operação adicionada.';

        // Documentos
        const docFrente = document.getElementById('iDocFrenteClienteNovo').files[0];
        const docVerso = document.getElementById('iDocVersoClienteNovo').files[0];
        const video = document.getElementById('iVideoClienteNovo').files[0];
        let htmlDocs = '';
        if (docFrente) htmlDocs += `<div>• 📄 RG Frente: ${docFrente.name}</div>`;
        if (docVerso) htmlDocs += `<div>• 📄 RG Verso: ${docVerso.name}</div>`;
        if (video) htmlDocs += `<div>• 🎥 Vídeo: ${video.name}</div>`;
        document.getElementById('resDocumentos').innerHTML = htmlDocs || 'Nenhum documento enviado.';
    }

    function mostrarLoading(ativo) {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.innerHTML = `
                <div class="loading-box">
                    <div class="loading-spinner"></div>
                    <p>Buscando dados no FullConsig...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = ativo ? 'flex' : 'none';
    }

    async function buscarDadosFullConsig(cpfFormatado) {
        const cpf = cpfFormatado.replace(/\D/g, '');
        if (cpf.length !== 11) return;

        // Mostra loading
        mostrarLoading(true);

        try {
            const response = await fetch(`https://sistemamscred.com.br/consulta-fullconsig/${cpf}`);
            const dados = await response.json();

            if (dados.nome) document.getElementById('inome').value = dados.nome;
            if (dados.data_nascimento) {
                // Converte de DD/MM/AAAA para AAAA-MM-DD
                const partes = dados.data_nascimento.split('/');
                if (partes.length === 3) {
                    const dataFormatada = partes[2] + '-' + partes[1] + '-' + partes[0];
                    document.getElementById('idataNasc').value = dataFormatada;
                }
            }
            if (dados.beneficio) document.getElementById('ibeneficio').value = dados.beneficio;
            if (dados.telefone) document.getElementById('itelefone').value = formatarTelefone(dados.telefone);
            if (dados.estado) document.getElementById('estado').value = dados.estado;
            if (dados.cidade) document.getElementById('cidade').value = dados.cidade;
            if (dados.bairro) document.getElementById('bairro').value = dados.bairro;
            if (dados.rua) document.getElementById('irua').value = dados.rua;
            if (dados.numero) document.getElementById('inumero').value = dados.numero;

            console.log('✅ Dados preenchidos automaticamente!');

        } catch (error) {
            console.warn('FullConsig indisponível, preencha manualmente.');
        } finally {
            mostrarLoading(false);
        }
    }

    const formClienteNovo=document.getElementById('formClienteNovo')
    const botaoClicado=document.getElementById('botaoClicado')

    async function cadClienteNovo(event) {
        event.preventDefault(); 
        
        const form = document.getElementById('formClienteNovo');
        const formData = new FormData(form); // Isso captura os textos E os arquivos (rg_frente, etc)

        const operacoes = [];
        const linhas = document.querySelectorAll('#corpoTabelaOperacoes .linha-operacao-item');

        linhas.forEach(linha => {
            const tipo = linha.querySelector('.ioperacao').value;
            const data = linha.querySelector('.dataProd').value;
            const banco = linha.querySelector('.bancoProd').value;
            
            if (tipo.trim() !== "") {
                operacoes.push({
                    tipo_operacao: tipo,
                    data_operacao: data,
                    banco_promotora: banco
                })
            }
        })

        formData.append('operacoes_json', JSON.stringify(operacoes));
        // Pegamos o botão para fazer a animação de sucesso depois
        const botaoClicado = document.getElementById('botaoClicado');

        try {
            const response = await fetch("https://sistemamscred.com.br/clientes", {
                method: "POST",
                body: formData // Não precisa de headers aqui, o navegador resolve!
            });

            const resultado = await response.json();

            if (response.ok) {
                console.log("Sucesso:", resultado.mensagem);
                form.reset();

                // NOVO: Volta a tabela para apenas uma linha vazia após o sucesso
                const corpoTabela = document.getElementById('corpoTabelaOperacoes');
                corpoTabela.innerHTML = `
                    <tr class="linha-operacao-item">
                        <td><input type="text" name="tipo_operacao" class="ioperacao" placeholder="Margem Novo" required></td>
                        <td><input type="date" name="data_operacao" class="dataProd" required></td>
                        <td><input type="text" name="banco_promotora" class="bancoProd" required></td>
                    </tr>`;

                // Reseta os previews de imagem também
                document.querySelectorAll('.previewArquivo').forEach(p => p.innerHTML = "");

                // Sua animação de sucesso
                botaoClicado.textContent = "✅ Cliente cadastrado com sucesso!";
                botaoClicado.classList.remove('sumir');
                botaoClicado.classList.add('ativo');
                setTimeout(() => {
                    botaoClicado.classList.remove('ativo');
                    botaoClicado.classList.add('sumir');
                }, 4000);
            } else {
                alert("Erro ao cadastrar: " + resultado.erro);
            }
        } catch (error) {
            console.error("Erro na requisição:", error);
            alert("Servidor desligado ou erro de rede.");
        }
    }

    function adicionarLinhaOperacao() {

    const tbody = document.getElementById('corpoTabelaOperacoes');
    const modelo = tbody.querySelector('.linha-operacao-item');

    if (modelo) {
        // 3. Clona a linha inteira (true = leva os filhos, ou seja, os TDs e Inputs)
        const novaLinha = modelo.cloneNode(true);

        // 4. Limpa os valores para a nova linha não vir "suja" com os dados da anterior
        const inputs = novaLinha.querySelectorAll('input');
        inputs.forEach(input => {
            input.value = '';
        });

        // 5. Adiciona a nova linha no final da tabela
        tbody.appendChild(novaLinha);

        // 6. FOCO AUTOMÁTICO: Coloca o cursor no primeiro campo da nova linha
        // Assim o usuário já sai digitando sem precisar clicar
        inputs[0].focus();
    } else {
        console.error("Mano, não achei a linha modelo '.linha-operacao-item' dentro do tbody!");
    }
}

    async function proximoPasso(passoAtual){
        if (passoAtual === 1) {
            const cpfRaw = document.getElementById('icliente').value;
            const cpfNumeros = cpfRaw.replace(/\D/g, '');
            
            if (cpfNumeros.length !== 11) {
                alert('Digite um CPF válido!');
                return;
            }

            try {
                // Chamada ao seu Python para buscar dados do cliente
                const response = await fetch(`https://sistemamscred.com.br/clientes/dados_edicao/${cpfNumeros}`);
                const cliente = await response.json();

                if (cliente.documentos && cliente.documentos.length >0) {
                    cliente.documentos.forEach(doc => {
                        if (doc.tipo_documento === 'RG_FRENTE') {
                            document.getElementById('statusFrente').innerHTML = "📄 Doc já enviado";
                            document.getElementById('linkFrente').href = `https://sistemamscred.com.br/${doc.url_documento}`;
                        }
                        if (doc.tipo_documento === 'RG_VERSO') {
                            document.getElementById('statusVerso').innerHTML = "📄 Doc já enviado";
                            document.getElementById('linkVerso').href = `https://sistemamscred.com.br/${doc.url_documento}`;
                        }
                        if (doc.tipo_documento === 'VIDEO') {
                            document.getElementById('statusVideo').innerHTML = "📄 Doc já enviado";
                            document.getElementById('linkVideo').href = `https://sistemamscred.com.br/${doc.url_documento}`;
                        }
                    })
                }
                if (response.ok) {
                    // Preenche os <p> do seu HTML com os dados do Banco
                    document.querySelector('.dadoRetornadoNome p').textContent = cliente.nome;
                    document.querySelector('.dadoRetornadoCPF p').textContent = formatarCPF(cliente.cpf);
                    document.querySelector('.dadoRetornadoDN p').textContent = cliente.data_nascimento;

                    avancarStepCarteira();
                } else {
                    alert("Cliente não encontrado na base!");
                }
            } catch (error) {
                alert("Erro ao conectar com o servidor.");
            }
        } else if (passoAtual===2){
            const dadoSelecionado = document.getElementById('tipoAtualizacaoDadoCliente').value;
            if (!dadoSelecionado){
                window.alert('Selecione um dado para atualizar!')
                return;
            }
            tipoSelecionado = dadoSelecionado; // armazena o tipo
            if (tipoSelecionado === 'endereco') {
                document.getElementById('stepDado').style.display = 'none';
                document.getElementById('stepEndereco').style.display = 'block';
                document.getElementById('stepOperacao').style.display="block";
                document.querySelector('.docEVideosClienteCarteira').style.display='block';

                // popula estados
                const selectEstado = document.getElementById('enderecoEstado');
                selectEstado.innerHTML = '<option value="">Selecione</option>';
                estados.forEach(estado => {
                    const option = document.createElement('option');
                    option.value = estado;
                    option.textContent = estado;
                    selectEstado.appendChild(option);
                });

                return;

            } else {
                const label=document.getElementById("labelNovoDado");
                document.getElementById('stepOperacao').style.display="block";
                document.querySelector('.docEVideosClienteCarteira').style.display='block';
                if (tipoSelecionado === 'senhaINSS') {
                    label.textContent = 'Nova Senha INSS:';
                } else if( tipoSelecionado ==='nome'){
                    label.textContent = 'Novo Nome:'
                } else if( tipoSelecionado ==='cpf'){
                    label.textContent = 'Novo CPF'
                } else if( tipoSelecionado==='dataNascimento'){
                    label.textContent= 'Nova Data Nascimento'
                } else if( tipoSelecionado ==='telefone'){
                    label.textContent='Novo Telefone'
                } else {
                    label.textContent = `Novo ${dadoSelecionado.charAt(0).toUpperCase() + dadoSelecionado.slice(1)}:`;
                }

                // Configura o input para formatação e tamanho se necessário
                const input = document.getElementById('novoValor');
                if (tipoSelecionado === 'telefone') {
                    input.placeholder = '(00) 00000-0000';
                    input.oninput = () => { input.value = formatarTelefone(input.value); };
                    input.style.width = '40%'; // tamanho menor pro telefone
                } else if (tipoSelecionado === 'senhaINSS') {
                    input.placeholder = 'Joao@123';
                    input.oninput = null;
                    input.style.width = '40%'; // tamanho menor pra senha
                } else if (tipoSelecionado ==='nome'){
                    input.placeholder='João da Silva';
                    input.oninput = null;
                    input.style.width='55%'
                } else if (tipoSelecionado ==='dataNascimento'){
                    input.type='date'
                    input.oninput = null;
                    input.style.width='29%'
                } else if(tipoSelecionado === 'cpf'){
                    input.placeholder = '000.000.000-00';
                    input.oninput = () => { input.value = formatarCPF(input.value); };
                    input.style.width = '40%'; // tamanho menor pro telefone
                    input.minLength = 11; // com máscara
                    input.maxLength = 14;
                } else if(tipoSelecionado === "endereco"){
                    input.oninput=null;
                    input.style.width ='40%'
                } else {
                    input.placeholder = '';
                    input.oninput = null;
                    input.style.width = '100%'; // tamanho normal pros outros
                }

                document.getElementById('stepDado').style.display = 'none';
                document.getElementById('stepAtualizar').style.display = 'block';
            }
        } else if (passoAtual === 3) {

        const estado = document.getElementById('enderecoEstado').value;
        const cidade = document.getElementById('enderecoCidade').value;
        const bairro = document.getElementById('enderecoBairro').value;
        const rua = document.getElementById('enderecoRua').value;
        const numero = document.getElementById('enderecoNumero').value;

        if (!estado || !cidade || !bairro || !rua || !numero) {
            alert('Preencha todo o endereço!');
            return;
        }

        // aqui tu já tem o endereço completo
        enderecoAtualizado = { estado, cidade, bairro, rua, numero };

        document.getElementById('stepEndereco').style.display = 'none';
        document.getElementById('stepAtualizar').style.display = 'block';
        }
    }

    function confirmarAtualizacaoCarteira(resposta) {
        // Esconde a pergunta
        document.getElementById('stepConfirmarAtualizacao').style.display = 'none';

        if (resposta === true) {
            vaiAtualizarDado = true;
           
            document.getElementById('stepDado').style.display = 'block';
            document.getElementById('stepEndereco').style.display = 'none';
            document.getElementById('stepAtualizar').style.display = 'none';
        } else {
            vaiAtualizarDado = false;
            // Pula o step 3: marca como completed
            const stepEl3 = document.querySelector('.carteira-steps .step[data-step="3"]');
            stepEl3.classList.add('completed');
            // Mostra direto o step 4
            document.getElementById('stepC3').style.display = 'none';
            document.getElementById('stepC4').style.display = 'block';
            stepAtualCarteira = 4;
            const stepEl4 = document.querySelector('.carteira-steps .step[data-step="4"]');
            stepEl4.classList.add('active');
            atualizarBotoesCarteira();
            return;
        }

        avancarStepCarteira();
    }

    function avancarNoStep3() {
        const dadoSelecionado = document.getElementById('tipoAtualizacaoDadoCliente').value;
        if (!dadoSelecionado) {
            alert('Selecione um dado para atualizar!');
            return;
        }
        tipoSelecionado = dadoSelecionado;

        if (tipoSelecionado === 'endereco') {
            document.getElementById('stepDado').style.display = 'none';
            document.getElementById('stepEndereco').style.display = 'block';

            // Popula estados
            const selectEstado = document.getElementById('enderecoEstado');
            selectEstado.innerHTML = '<option value="">Selecione</option>';
            estados.forEach(estado => {
                const option = document.createElement('option');
                option.value = estado;
                option.textContent = estado;
                selectEstado.appendChild(option);
            });
        } else {
            const label = document.getElementById('labelNovoDado');
            if (tipoSelecionado === 'senhaINSS') label.textContent = 'Nova Senha INSS:';
            else if (tipoSelecionado === 'nome') label.textContent = 'Novo Nome:';
            else if (tipoSelecionado === 'cpf') label.textContent = 'Novo CPF:';
            else if (tipoSelecionado === 'dataNascimento') label.textContent = 'Nova Data Nascimento:';
            else if (tipoSelecionado === 'telefone') label.textContent = 'Novo Telefone:';

            const input = document.getElementById('novoValor');
            input.type = 'text';
            input.oninput = null;
            input.placeholder = '';

            if (tipoSelecionado === 'telefone') {
                input.placeholder = '(00) 00000-0000';
                input.oninput = () => { input.value = formatarTelefone(input.value); };
            } else if (tipoSelecionado === 'dataNascimento') {
                input.type = 'date';
            } else if (tipoSelecionado === 'cpf') {
                input.placeholder = '000.000.000-00';
                input.oninput = () => { input.value = formatarCPF(input.value); };
            }

            document.getElementById('stepDado').style.display = 'none';
            document.getElementById('stepAtualizar').style.display = 'block';
        }
    }

    // Função para atualizar o dado (simula a atualização)
    async function atualizarDado() {
        const cpfOriginal = document.getElementById('icliente').value.replace(/\D/g, '');
        const formData = new FormData();
        
        formData.append('cpf_original', cpfOriginal);
        formData.append('vai_atualizar_dado', vaiAtualizarDado);

        // Se o usuário escolheu atualizar algum dado (Sim)
        if (vaiAtualizarDado) {
            formData.append('tipo_campo', tipoSelecionado);
            
            if (tipoSelecionado === 'endereco') {
                formData.append('estado', document.getElementById('enderecoEstado').value);
                formData.append('cidade', document.getElementById('enderecoCidade').value);
                formData.append('bairro', document.getElementById('enderecoBairro').value);
                formData.append('rua', document.getElementById('enderecoRua').value);
                formData.append('numero', document.getElementById('enderecoNumero').value);
            } else {
                formData.append('novo_valor', document.getElementById('novoValor').value);
            }
        }

        // Captura a Operação (Primeira linha da tabela)
        const linhasTabela = document.querySelectorAll('.tabelaOp tbody tr');
        const listaOperacoes = [];

        linhasTabela.forEach(linha=>{
            const operacao = linha.querySelector('input[name="operacao"]').value;
            const data = linha.querySelector('input[name="data"]').value;
            const banco = linha.querySelector('input[name="banco"]').value;

            if (operacao.trim() !=="") {
                listaOperacoes.push({
                    operacao:operacao,
                    data:data,
                    banco: banco
                });
            };
        })

        formData.append('operacoes', JSON.stringify(listaOperacoes));
        // Captura Arquivos
        const fFrente = document.getElementById('iDocFrenteClienteCarteira').files[0];
        const fVerso = document.getElementById('iDocVersoClienteCarteira').files[0];
        const fVideo = document.getElementById('iVideoClienteCarteira').files[0];

        if (fFrente) formData.append('docFrente', fFrente);
        if (fVerso) formData.append('docVerso', fVerso);
        if (fVideo) formData.append('videoCliente', fVideo);

        try {
            const response = await fetch("https://sistemamscred.com.br/clientes/atualizar", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                finalizarFluxo(); // Chama sua animação de sucesso
            } else {
                alert("Erro: " + result.erro);
            }
        } catch (error) {
            alert("Erro na rede ao tentar atualizar.");
        }
    }

    function finalizarFluxo() {
        const mensagem = document.getElementById('mensagemAtualizacao');
        void mensagem.offsetWidth;

        mensagem.textContent = "✅ Operação concluída com sucesso!";
        mensagem.classList.remove('sumir');
        mensagem.classList.add('ativo');

        setTimeout(() => {
            mensagem.classList.remove('ativo');
            mensagem.classList.add('sumir');
        }, 4000);

        // Limpa campo CPF
        document.getElementById('icliente').value = '';
        document.getElementById('novoValor').value = '';
        document.getElementById('tipoAtualizacaoDadoCliente').value = '';

        // Reseta variáveis
        tipoSelecionado = null;
        parteEndereco = null;
        vaiAtualizarDado = null;

        // Esconde steps 2, 3 e 4
        document.getElementById('stepC2').style.display = 'none';
        document.getElementById('stepC3').style.display = 'none';
        document.getElementById('stepC4').style.display = 'none';

        // Mostra step 1
        document.getElementById('stepC1').style.display = 'block';

        // Reseta steps visuais
        stepAtualCarteira = 1;
        document.querySelectorAll('.carteira-steps .step').forEach((s, i) => {
            s.classList.remove('active', 'completed');
            if (i === 0) s.classList.add('active');
        });

        // Reseta botões
        atualizarBotoesCarteira();

        // Garante que elementos internos estejam no estado inicial
        document.getElementById('stepConfirmarAtualizacao').style.display = 'block';
        document.getElementById('stepDado').style.display = 'none';
        document.getElementById('stepAtualizar').style.display = 'none';
        document.getElementById('stepEndereco').style.display = 'none';
    }

    const tbody = document.querySelector(".tabelaOp tbody");
    const btnAdd = document.getElementById("addLinha");

    btnAdd.addEventListener("click", () => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><input type="text" name="operacao" placeholder="Ex.: Portabilidade"></td>
            <td><input type="date" name="data"></td>
            <td><input type="text" name="banco" placeholder="Banco... promotora..."></td>
        `;

        tbody.appendChild(tr);

        // foco automático no primeiro input
        tr.querySelector("input").focus();
    });

    function previewArquivo(input, previewId) {
        const preview = document.getElementById(previewId);
        preview.innerHTML = "";

        const file = input.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);

        const label = input.closest(".inputDocCliente");
        const conteudo = label.querySelector(".conteudoUpload");

        label.classList.add("com-preview");
        preview.style.display = "flex";

        // NOME DO ARQUIVO
        const nome = document.createElement("p");
        nome.classList.add("nomeArquivo");
        nome.textContent = file.name;

        // IMAGEM
        if (file.type.startsWith("image/")) {
            const img = document.createElement("img");
            img.src = url;
            preview.appendChild(img);
        }

        // PDF
        else if (file.type === "application/pdf") {
            const embed = document.createElement("embed");
            embed.src = url;
            embed.type = "application/pdf";
            preview.appendChild(embed);
        }

        // VÍDEO
        else if (file.type.startsWith("video/")) {
            const video = document.createElement("video");
            video.src = url;
            video.controls = true;
            preview.appendChild(video);
        }

        preview.appendChild(nome);
    }

    function fazerLogout() {
    // 1. Limpa tudo que salvamos no login
    localStorage.removeItem('usuarioId');
    localStorage.setItem('usuarioNome', ''); // Opcional: limpa o nome também
    localStorage.clear(); // Se quiser garantir, limpa TUDO do storage

    // 2. Agora sim, manda para a tela de login
    window.location.replace("telalogin.html"); 
}