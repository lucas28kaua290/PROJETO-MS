  toggleBtn = document.getElementById('toggleMenu');
  const sidebar = document.querySelector('.sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('overlay');
  let URL_BASE = "https://sistemamscred.com.br"

  // Controle de paginação
  let paginaAtual = 1;
  const porPagina = 15;
  let totalRegistros = 0;
  let filtrosAtivos = {}; // guarda os filtros da última busca para reusá-los na paginação
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

  // Carrega a lista de clientes automaticamente ao abrir a página
  carregarPagina();
  carregarKPIs();

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

    // Monta e salva os filtros ativos para reusar na paginação
    filtrosAtivos = {};
    if (tipoBusca === 'endereco') {
      if (estado)  filtrosAtivos.estado  = estado;
      if (cidade)  filtrosAtivos.cidade  = cidade;
      if (bairro)  filtrosAtivos.bairro  = bairro;
      if (rua)     filtrosAtivos.rua     = rua;
    } else if (tipoBusca) {
      const parametro = tipoBusca === 'nbeneficio' ? 'beneficio' : tipoBusca;
      if (buscaSimples) filtrosAtivos[parametro] = buscaSimples;
    }

    // Reinicia na página 1 a cada nova busca
    paginaAtual = 1;
    await carregarPagina();
    document.getElementById('btnLimpar').style.display = "block";
  }

  async function carregarPagina() {
    const params = new URLSearchParams({
      ...filtrosAtivos,
      page: paginaAtual,
      per_page: porPagina
    });

    try {
        const response = await fetch(`${URL_BASE}/clientes?${params}`);
        const dados = await response.json();

        if (!response.ok) {
            alert(dados.mensagem || "Erro ao buscar clientes");
            return;
        }

        totalRegistros = dados.total;
        const lista = dados.clientes;

        // Preenche a tabela
        const tbody = document.getElementById('tabelaClientes');
        tbody.innerHTML = '';

        lista.forEach(cliente => {
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
                <td>${cliente.operacoes && cliente.operacoes.length > 0
                    ? `${cliente.operacoes[0].tipo_operacao || '---'} · ${cliente.operacoes[0].data_operacao || '---'}`
                    : '---'}</td>
                <td><button class="btn-ver-detalhes" onclick="abrirDetalhesDaLinha(this)">
                    <i class="material-symbols-outlined">open_in_new</i> Ver
                </button></td>
            `;
            tbody.appendChild(tr);
        });

        // Atualiza controles de paginação
        const totalPaginas = Math.ceil(totalRegistros / porPagina);
        document.getElementById('infoPagina').textContent = `Página ${paginaAtual} de ${totalPaginas}`;
        document.getElementById('totalRegistros').textContent = `${totalRegistros} cliente(s) encontrado(s)`;
        document.getElementById('btnAnterior').disabled = paginaAtual <= 1;
        document.getElementById('btnProximo').disabled  = paginaAtual >= totalPaginas;

      } catch (error) {
          console.error("Erro na requisição:", error);
          alert("Erro ao conectar com o servidor.");
      }
  }

  function mudarPagina(direcao) {
    paginaAtual += direcao;
    carregarPagina();
    // Sobe para o topo da tabela ao trocar de página
    document.querySelector('.telaRetornoConsulta').scrollIntoView({ behavior: 'smooth' });
  }

  // Carrega os 3 KPIs do topo
  async function carregarKPIs() {
    try {
      const response = await fetch(`${URL_BASE}/clientes/kpis`);
      if (!response.ok) return;
      const dados = await response.json();

      const elTotal = document.getElementById('kpiTotalClientes');
      const elMes   = document.getElementById('kpiNovosMes');
      const elOp    = document.getElementById('kpiOperacoesMes');

      if (elTotal) elTotal.textContent = dados.total_clientes ?? '--';
      if (elMes)   elMes.textContent   = dados.cadastros_mes ?? '--';
      if (elOp)    elOp.textContent    = dados.operacoes_mes ?? '--';
    } catch (err) {
      console.warn('KPIs indisponíveis:', err);
    }
  }

  const telaDetalhesCliente = document.querySelector('.telaDetalhesCliente')

function limpar() {
    // 1. Limpa o formulário (apaga o que foi digitado)
    const form = document.getElementById('formConsulta');
    if (form) form.reset();

    // 2. Esconde apenas os detalhes; a lista paginada permanece visível
    telaDetalhesCliente.style.display = "none";

    // 3. Reseta os filtros e recarrega a página 1 sem filtros
    filtrosAtivos = {};
    paginaAtual = 1;
    carregarPagina();

    // 4. Esconde os controles e blocos dinâmicos do formulário
    botaoLimpar.style.display = "none";
    campoSimples.style.display = "none";
    botaoBuscar.style.display = "none";
    blocoEndereco.style.display = "none";
    
    // 5. Limpa o label de busca (opcional, para garantir)
    if (labelBusca) labelBusca.textContent = "";
}

  const tbody=document.getElementById('tabelaClientes');

  // Abre detalhes ao clicar em qualquer célula da linha (exceto no botão Ver, que tem onclick próprio)
  tbody.addEventListener('click', function (e) {
    // Ignora cliques no botão "Ver" ou no ícone dentro dele (têm handler próprio)
    if (e.target.closest('.btn-ver-detalhes')) return;

    const linha = e.target.closest('tr');
    if (!linha) return;

  // Recupera os dados que salvamos na linha
    const dadosCliente = JSON.parse(linha.dataset.cliente);

    preencherDetalhes(dadosCliente);
    abrirDetalhesCliente();

  });

  // Chamada pelo botão "Ver" na célula de ação
  function abrirDetalhesDaLinha(btn) {
    const linha = btn.closest('tr');
    const dadosCliente = JSON.parse(linha.dataset.cliente);
    preencherDetalhes(dadosCliente);
    abrirDetalhesCliente();
  }

function preencherDetalhes(cliente) {
  const tela = document.querySelector('.telaDetalhesCliente');

  // 1. Dados Pessoais (Usando IDs únicos para precisão total)
  document.getElementById('det_nome').textContent = cliente.nome || "---";
  document.getElementById('det_cpf').textContent = cliente.cpf ? formatarCPF(cliente.cpf) : "---";
  document.getElementById('det_nascimento').textContent = cliente.data_nascimento 
    ? new Date(cliente.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) 
    : "---";
  document.getElementById('det_beneficio').textContent = cliente.num_beneficio ? formatarBeneficio(cliente.num_beneficio) : "---";

  // 1b. Hero do perfil (campos rápidos de identidade)
  const elCpfHero = document.getElementById('det_cpf_hero');
  const elTelHero = document.getElementById('det_telefone_hero');
  const elCidHero = document.getElementById('det_cidade_hero');
  if (elCpfHero) elCpfHero.textContent = cliente.cpf ? formatarCPF(cliente.cpf) : "---";
  if (elTelHero) elTelHero.textContent = cliente.telefone || "---";
  if (elCidHero) elCidHero.textContent = cliente.cidade ? `${cliente.cidade}/${cliente.estado}` : "---";

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

function gerarFichaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const laranja = [235, 101, 5];
    const cinzaClaro = [245, 245, 245];
    const textoPrimario = [26, 26, 26];
    const textoSecundario = [107, 114, 128];

    let y = 0;

    // Cabeçalho
    doc.setFillColor(...laranja);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MSCred Correspondente', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Ficha do Cliente', 14, 20);
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    doc.text(`Gerado em: ${dataHoje}`, 196, 20, { align: 'right' });

    y = 38;

    // Nome em destaque
    const nome = document.getElementById('det_nome').textContent;
    doc.setTextColor(...textoPrimario);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(nome, 14, y);
    y += 10;

    // Função auxiliar pra desenhar seção
    function desenharSecao(titulo, campos, yInicio) {
        // Título da seção
        doc.setFillColor(...cinzaClaro);
        doc.rect(14, yInicio, 182, 7, 'F');
        doc.setDrawColor(...laranja);
        doc.setLineWidth(0.8);
        doc.line(14, yInicio, 14, yInicio + 7);
        doc.setTextColor(...laranja);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(titulo.toUpperCase(), 18, yInicio + 5);

        let yAtual = yInicio + 13;

        campos.forEach(([label, valor], i) => {
            // fundo zebrado
            if (i % 2 === 0) {
                doc.setFillColor(252, 252, 252);
                doc.rect(14, yAtual - 5, 182, 9, 'F');
            }
            doc.setTextColor(...textoSecundario);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(label, 18, yAtual);

            doc.setTextColor(...textoPrimario);
            doc.setFont('helvetica', 'bold');
            doc.text(valor || '---', 196, yAtual, { align: 'right' });

            // linha separadora fina
            doc.setDrawColor(235, 235, 235);
            doc.setLineWidth(0.2);
            doc.line(14, yAtual + 3, 196, yAtual + 3);

            yAtual += 10;
        });

        return yAtual + 4;
    }

    // Dados pessoais
    y = desenharSecao('Dados Pessoais', [
        ['CPF',               document.getElementById('det_cpf').textContent],
        ['Data de Nascimento', document.getElementById('det_nascimento').textContent],
        ['N° Benefício',      document.getElementById('det_beneficio').textContent],
    ], y);

    // Contato e acesso
    y = desenharSecao('Contato e Acesso', [
        ['Telefone',   document.getElementById('det_telefone').textContent],
        ['Senha INSS', document.getElementById('det_senha').textContent],
    ], y);

    // Endereço
    y = desenharSecao('Endereço', [
        ['Estado', document.getElementById('det_estado').textContent],
        ['Cidade', document.getElementById('det_cidade').textContent],
        ['Bairro', document.getElementById('det_bairro').textContent],
        ['Rua',    document.getElementById('det_rua').textContent],
    ], y);

    // Operações recentes
    const linhasOp = document.querySelectorAll('#tabelaOperacoesCliente tr');

    // Título da seção operações
    doc.setFillColor(...cinzaClaro);
    doc.rect(14, y, 182, 7, 'F');
    doc.setDrawColor(...laranja);
    doc.setLineWidth(0.8);
    doc.line(14, y, 14, y + 7);
    doc.setTextColor(...laranja);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('OPERAÇÕES RECENTES', 18, y + 5);
    y += 13;

    if (linhasOp.length === 0) {
        doc.setTextColor(...textoSecundario);
        doc.setFont('helvetica', 'normal');
        doc.text('Nenhuma operação registrada', 18, y);
        y += 10;
    } else {
        // Cabeçalho da tabela
        doc.setFillColor(...laranja);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('OPERAÇÃO', 18, y);
        doc.text('DATA', 100, y, { align: 'center' });
        doc.text('BANCO / PROMOTORA', 192, y, { align: 'right' });
        y += 8;

        linhasOp.forEach((tr, i) => {
            const tds = tr.querySelectorAll('td');
            if (tds.length < 3) return;

            if (i % 2 === 0) {
                doc.setFillColor(252, 252, 252);
                doc.rect(14, y - 5, 182, 9, 'F');
            }

            doc.setTextColor(...textoPrimario);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(tds[0].textContent || '---', 18, y);
            doc.text(tds[1].textContent || '---', 100, y, { align: 'center' });
            doc.text(tds[2].textContent || '---', 192, y, { align: 'right' });

            doc.setDrawColor(235, 235, 235);
            doc.setLineWidth(0.2);
            doc.line(14, y + 3, 196, y + 3);

            y += 10;
        });
    }

    // Rodapé
    doc.setDrawColor(...laranja);
    doc.setLineWidth(0.5);
    doc.line(14, 285, 196, 285);
    doc.setTextColor(...textoSecundario);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Documento gerado pelo Sistema MSCred — uso interno', 105, 290, { align: 'center' });

    // Salva
    const nomeArquivo = `ficha_${nome.replace(/\s+/g, '_').toLowerCase()}.pdf`;
    doc.save(nomeArquivo);
}