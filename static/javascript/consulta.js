  toggleBtn = document.getElementById('toggleMenu');
  const sidebar = document.querySelector('.sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('overlay');
  let URL_BASE = "https://sistemamscred.com.br"
  // Função para formatar CPF
  function formatarCPF(cpf) {
      cpf = cpf.replace(/\D/g, ''); // remove tudo que não é dígito
      cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2'); // adiciona ponto após 3 dígitos
      cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2'); // adiciona ponto   após mais 3
      cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2'); // adiciona traço antes dos últimos 2
      return cpf;
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

  const tipoBusca = window.document.getElementById('tipoBusca')
  const campoSimples = window.document.getElementById('campoSimples')
  const blocoEndereco = window.document.getElementById('blocoEndereco')
  const botaoBuscar = window.document.getElementById('btnBuscar')
  const botaoLimpar = window.document.getElementById('btnLimpar')
  const labelBusca = window.document.getElementById('labelBusca')
  const buscaSimples = window.document.getElementById('buscaSimples')

  function atualizarCampos() {

    campoSimples.style.display = "none";
    blocoEndereco.style.display = "none";
    botaoBuscar.style.display = "none";

    buscaSimples.value = ""
    buscaSimples.type = "text"
    buscaSimples.placeholder = ""
    buscaSimples.removeAttribute("inputmode")

    if (tipoBusca.value === "") {
      labelBusca.textContent = ""
      return;
    }


    if (tipoBusca.value === "endereco") {
      blocoEndereco.style.display = "grid";
      botaoBuscar.style.display = "block";
      labelBusca.textContent = "" // não usa label no endereço
      return
    }


    if (tipoBusca.value === "nome") {
      campoSimples.style.display = "block";
      labelBusca.textContent = "Nome:"
      botaoBuscar.style.display = "block"
      buscaSimples.placeholder = "Ex.: João da Silva"
    } else if (tipoBusca.value === "cpf") {
      campoSimples.style.display = "block";
      labelBusca.textContent = "CPF:"
      botaoBuscar.style.display = "block"
      buscaSimples.placeholder = "000.000.000-00"
      // Configurações específicas para CPF
      buscaSimples.setAttribute("inputmode", "numeric"); // Abre teclado numérico no celular
      buscaSimples.maxLength = 14; 

      // Aplica a sua função formatarCPF
      buscaSimples.oninput = function() {
        this.value = formatarCPF(this.value);
      };
    } else if (tipoBusca.value === "nbeneficio") {
      campoSimples.style.display = "block";
      labelBusca.textContent = "N. Benefício:"
      botaoBuscar.style.display = "block"
      buscaSimples.placeholder = "123.456.789-0"
      buscaSimples.setAttribute("inputmode", "numeric"); // Abre teclado numérico no celular
      buscaSimples.maxLength = 13; 

      // Aplica a sua função formatarCPF
      buscaSimples.oninput = function() {
        this.value = formatarBeneficio(this.value);
      };
    } else {

      labelBusca.textContent = "Pesquisar"
    }
  }

  const telaRetornoConsulta = document.querySelector('.telaRetornoConsulta')

  async function buscar() {
    
    const tipoBusca = document.getElementById('tipoBusca').value
    let buscaSimples = document.getElementById('buscaSimples').value;

    if (tipoBusca === 'cpf' || tipoBusca === 'nbeneficio') {
        buscaSimples = buscaSimples.replace(/\D/g, ''); 
    }

    const estado = document.getElementById('estado').value;
    const cidade = document.getElementById('cidade').value;
    const bairro = document.getElementById('bairro').value;
    const rua = document.getElementById('rua').value;

    let endpoint = `${URL_BASE}/clientes?`

    if (tipoBusca === 'endereco'){
      endpoint += `estado=${estado}&cidade=${cidade}&bairro=${bairro}&rua=${rua}`
    } else{
      const parametro = tipoBusca === 'nbeneficio' ? 'beneficio' : tipoBusca;
      endpoint += `${parametro}=${buscaSimples}`;
    }

    try {
        const response = await fetch(endpoint);
        const dados = await response.json();

        if (!response.ok) {
            alert(dados.mensagem || "Erro ao buscar cliente");
            return;
        }

        // 2. Limpa a tabela e preenche com os novos dados
          const tbody = document.getElementById('tabelaClientes');
          tbody.innerHTML = '';

          dados.forEach(cliente => {
              const tr = document.createElement('tr');
              tr.className = 'linhaClicavel';
              // Guardamos o objeto completo no elemento para usar nos detalhes depois
              tr.dataset.cliente = JSON.stringify(cliente); 
              
              tr.innerHTML = `
                  <td>${cliente.nome}</td>
                  <td>${formatarCPF(cliente.cpf)}</td>
                  <td>${cliente.data_nascimento 
                      ? new Date(cliente.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) 
                      : '---'}</td>
                  <td>${cliente.cidade}/${cliente.estado}</td>
              `;
              tbody.appendChild(tr);
          });

          // 3. Mostra a tela de resultados
          document.querySelector('.telaRetornoConsulta').style.display = 'block';
          document.getElementById('btnLimpar').style.display = "block";

      } catch (error) {
          console.error("Erro na requisição:", error);
          alert("Erro ao conectar com o servidor.");
      }
  }

  const telaDetalhesCliente = document.querySelector('.telaDetalhesCliente')

function limpar() {
    // 1. Limpa o formulário (apaga o que foi digitado)
    const form = document.getElementById('formConsulta');
    if (form) form.reset();

    // 2. Esconde as seções de dados
    telaRetornoConsulta.style.display = "none";
    telaDetalhesCliente.style.display = "none";

    // 3. Esconde os controles e blocos dinâmicos
    botaoLimpar.style.display = "none";
    campoSimples.style.display = "none";
    botaoBuscar.style.display = "none";
    blocoEndereco.style.display = "none";
    
    // 4. Limpa o label de busca (opcional, para garantir)
    if (labelBusca) labelBusca.textContent = "";
}

  const tbody=document.getElementById('tabelaClientes');

  tbody.addEventListener('click', function (e) {
    const linha = e.target.closest('tr');
    if (!linha) return;

  // Recupera os dados que salvamos na linha
    const dadosCliente = JSON.parse(linha.dataset.cliente);

    preencherDetalhes(dadosCliente);
    abrirDetalhesCliente();

  });

function preencherDetalhes(cliente) {
  const tela = document.querySelector('.telaDetalhesCliente');

  // 1. Dados Pessoais (Usando IDs únicos para precisão total)
  document.getElementById('det_nome').textContent = cliente.nome || "---";
  document.getElementById('det_cpf').textContent = cliente.cpf ? formatarCPF(cliente.cpf) : "---";
  document.getElementById('det_nascimento').textContent = cliente.data_nascimento 
    ? new Date(cliente.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) 
    : "---";
  document.getElementById('det_beneficio').textContent = cliente.num_beneficio ? formatarBeneficio(cliente.num_beneficio) : "---";

  // 2. Endereço
  document.getElementById('det_estado').textContent = cliente.estado || "---";
  document.getElementById('det_cidade').textContent = cliente.cidade || "---";
  document.getElementById('det_bairro').textContent = cliente.bairro || "---";
  document.getElementById('det_rua').textContent = cliente.rua || "---";

  // 3. Contato e Segurança
  document.getElementById('det_telefone').textContent = cliente.telefone || "---";
  document.getElementById('det_senha').textContent = cliente.senha_inss || "---";

  // 4. Tabela de documentos
  const documentos = cliente.documentos;

  const docFrente = documentos.find(d => d.tipo_documento === 'RG_FRENTE')
  const docVerso = documentos.find(d => d.tipo_documento === 'RG_VERSO');

  if (docFrente){
    document.getElementById('rgFrenteCliente').src = `${URL_BASE}/uploads/${docFrente.url_documento}`;
  } else {
    document.getElementById('rgFrenteCliente').src = ''; // Limpa se não tiver
  }

  if (docVerso) {
    document.getElementById('rgVersoCliente').src = `${URL_BASE}/uploads/${docVerso.url_documento}`;
  } else {
      document.getElementById('rgVersoCliente').src = ''; // Limpa se não tiver
  }

  // 5. Tabela de Operações Recentes
  const tabelaOp = document.getElementById('tabelaOperacoesCliente');
  tabelaOp.innerHTML = ''; // Limpa a tabela anterior

  if (cliente.operacoes && cliente.operacoes.length >0) {
      cliente.operacoes.forEach(op =>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${op.tipo_operacao || '---'}</td>
            <td>${op.data_operacao || '---'}</td>
            <td>${op.banco_promotora || '---'}</td>
        `;
        tabelaOp.appendChild(tr);
      })
  } else {
      tabelaOp.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhuma operação registrada</td></tr>';
  }

  // 6. Avatar com iniciais
  const nomeCompleto = cliente.nome || '';
  const partes = nomeCompleto.trim().split(' ');
  const iniciais = partes.length >= 2
      ? partes[0][0] + partes[partes.length - 1][0]
      : nomeCompleto.substring(0, 2);
  const avatarEl = document.getElementById('avatarCliente');
  if (avatarEl) avatarEl.textContent = iniciais.toUpperCase();

  // 7. Badge convênio
  const badgeEl = document.getElementById('det_convenio_badge');
  if (badgeEl) {
      const conv = cliente.convenio || cliente.tipo_beneficio || '';
      badgeEl.textContent = conv;
      badgeEl.style.display = conv ? 'inline-block' : 'none';
  }
}

  function abrirDetalhesCliente() {
    document.querySelector('.telaRetornoConsulta').style.display = 'none';
    document.querySelector('.telaDetalhesCliente').style.display = 'block';
  }

  function voltarParaLista() {
    document.querySelector('.telaDetalhesCliente').style.display = 'none';
    document.querySelector('.telaRetornoConsulta').style.display = 'block';
  }
  
  function abrefecha(botao, url = null){
    const bloco=botao.parentElement;
    const img=bloco.querySelector('.doc-imagem');

    if (url){
      img.src=url;
    }

    bloco.classList.toggle('ativo');
  }

  function fazerLogout() {
    // 1. Limpa tudo que salvamos no login
    localStorage.removeItem('usuarioId');
    localStorage.setItem('usuarioNome', ''); // Opcional: limpa o nome também
    localStorage.clear(); // Se quiser garantir, limpa TUDO do storage

    // 2. Agora sim, manda para a tela de login
    window.location.replace("telalogin.html"); 
}