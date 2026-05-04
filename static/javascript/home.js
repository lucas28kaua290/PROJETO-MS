// --- CONFIGURAÇÕES INICIAIS ---
const idDono = localStorage.getItem('usuarioId');

async function inicializarHome() {
    await carregarConfiguracoes(); // Primeiro carrega as metas
    await carregarDashboardDoBanco(); // Depois carrega a produção e cards
}

function formatBRL(valor) {
    return parseFloat(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// 1. BUSCA METAS E ATUALIZA OS DISPLAYS
async function carregarConfiguracoes() {
    try {
        const response = await fetch('https://sistemamscred.com.br/api/configuracoes');
        if (!response.ok) return;

        const config = await response.json();

        // Atualiza o display da Meta Geral
        const displayMetaGeral = document.getElementById('meta-geral-home');
        if(displayMetaGeral) {
            displayMetaGeral.innerText = parseFloat(config.meta_geral).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
        }

        // Atualiza o display da Meta Individual (que a barra usa)
        const displayMetaInd = document.getElementById('meta-individual-home');
        if(displayMetaInd) {
            displayMetaInd.innerText = parseFloat(config.meta_individual).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
        }

        const containerRegras = document.getElementById('lista-regras-home');
        
        if (containerRegras && config.regras_json) {
            containerRegras.innerHTML = ""; // Limpa as regras antigas estáticas

            config.regras_json.forEach(regra => {
                const linha = document.createElement('div');
                linha.className = 'regra-linha';
                
                linha.innerHTML = `
                    <span>${regra.operacao || '-'}</span>
                    <span>${regra.banco || '-'}</span>
                    <span>${regra.promotora || '-'}</span>
                `;
                
                containerRegras.appendChild(linha);
            });
        }
        
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

const CORES_CONVENIO = [
    '#378ADD', // azul
    '#1D9E75', // teal
    '#D85A30', // coral
    '#BA7517', // amber
    '#7F77DD', // roxo
    '#D4537E', // rosa
    '#639922', // verde
    '#E24B4A', // vermelho
];

let chartProducao = null;

// 2. BUSCA PRODUÇÃO E GERA OS CARDS
async function carregarDashboardDoBanco() {
    try {
        // Buscamos as propostas do usuário logado
        const response = await fetch(`https://sistemamscred.com.br/propostas?usuario_id=${idDono}`);
        const propostas = await response.json();

        const agora = new Date();
        const mesAtual = agora.getMonth();
        const anoAtual = agora.getFullYear();

        // Agrupa por convênio só as propostas finalizadas do mês atual
        const grupos = {};
        let somaTotalUsuario = 0;

        const container = document.getElementById('containerCardsHome');
        if(container) container.innerHTML = ""; 

        propostas.forEach(p => {

            const dataFinalizacao = new Date(p.data_finalizacao);
            const mesProposta = dataFinalizacao.getMonth();
            const anoProposta = dataFinalizacao.getFullYear();

            const t = parseFloat(p.valor_operacao) || 0;
            const s = parseFloat(p.saldo_devedor_estimado) || 0;
            const isPort = (p.operacao_feita || "").toLowerCase().includes('port');
            const valorReal = isPort ? (t + s) : t;

            if (p.status_proposta === 'Finalizado' && mesProposta === mesAtual && anoProposta === anoAtual) {
                somaTotalUsuario += valorReal;

                // Usa convenio se existir, senão cai pro banco
                const chave = p.convenio || p.banco || 'Outros';
                if (!grupos[chave]) grupos[chave] = { total: 0, produtos: {} };
                grupos[chave].total += valorReal;

                const produto = p.operacao_feita || 'Outros';
                grupos[chave].produtos[produto] = (grupos[chave].produtos[produto] || 0) + valorReal;
            }

            gerarCardNoDashboard(p, valorReal);

        });

        // Monta array ordenado por valor decrescente
        const gruposArray = Object.entries(grupos)
            .map(([convenio, dados]) => ({ convenio, total: dados.total, produtos: dados.produtos }))
            .sort((a, b) => b.total - a.total);

        renderizarGraficoProducao(gruposArray, somaTotalUsuario);

        // Atualiza o texto da produção na tela
        const elProd = document.getElementById('prod-mes-anterior');
        if(elProd) {
            elProd.innerText = somaTotalUsuario.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
        }

        // AGORA SIM, com os valores na tela, atualiza a barra!
        atualizarProgressoMeta();

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

let tooltipElement = null; // Variável global para o tooltip

function renderizarGraficoProducao(grupos, total) {
    const canvas = document.getElementById('graficoProducao');
    if (!canvas) return;


    if (chartProducao) {
        chartProducao.destroy();
        chartProducao = null;
    }

    const legendaContainer = document.getElementById('legendaProducao');

    if (grupos.length === 0) {
        if (legendaContainer) {
            legendaContainer.innerHTML = '<div style="color:#6b7280;font-size:12px;text-align:center;">Nenhuma proposta finalizada este mês.</div>';
        }
        return;
    }

    const labels = grupos.map(g => g.convenio);
    const valores = grupos.map(g => g.total);
    const cores = grupos.map((_, i) => CORES_CONVENIO[i % CORES_CONVENIO.length]);

    chartProducao = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: cores,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false } // Desativa o tooltip padrão do Chart.js
            },
            onHover: (event, activeElements) => {
                

                // VALIDAÇÃO: se não tem elementos ativos
                if (!activeElements || activeElements.length === 0) {
                    esconderTooltip();
                    return;
                }
                
                const idx = activeElements[0].index;
                

                // VALIDAÇÃO: se o índice é válido e o grupo existe
                if (idx === undefined || !grupos[idx]) {
        
                    esconderTooltip();
                    return;
                }
                
                const grupo = grupos[idx];
              
                // VALIDAÇÃO: se o grupo tem total
                if (grupo.total === undefined) {
                    esconderTooltip();
                    return;
                }
                
                const pct = total > 0 ? ((grupo.total / total) * 100).toFixed(1) : 0;
                
                // Pega a posição do mouse
                let mouseX = 0;
                let mouseY = 0;

                // Tenta pegar do event.native (Chart.js v3)
                if (event.native && event.native.clientX) {
                    mouseX = event.native.clientX;
                    mouseY = event.native.clientY;
                } 
                // Tenta pegar do próprio event
                else if (event.clientX) {
                    mouseX = event.clientX;
                    mouseY = event.clientY;
                }
                // Último recurso: usa a posição do canvas
                else {
                    const rect = canvas.getBoundingClientRect();
                    mouseX = rect.left + rect.width / 2;
                    mouseY = rect.top + rect.height / 2;
                }
                
              

                // Monta o conteúdo do tooltip
                let conteudo = `
                    <div class="tooltip-titulo">📊 ${grupo.convenio}</div>
                    <div class="tooltip-linha">
                        <span>💰 Total:</span>
                        <span class="tooltip-valor">${grupo.total.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                `;
                
                // Adiciona os produtos (com validação extra)
                if (grupo.produtos && Object.keys(grupo.produtos).length > 0) {
                    conteudo += `<hr>`;
                    Object.entries(grupo.produtos).forEach(([prod, val]) => {
                        conteudo += `
                            <div class="tooltip-linha">
                                <span class="tooltip-produto">📌 ${prod}:</span>
                                <span class="tooltip-valor">${val.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        `;
                    });
                }
                
                mostrarTooltip(conteudo, mouseX, mouseY);
            }
        }
    });

    canvas.addEventListener('mouseleave', () => {
        esconderTooltip();
    });

    // Legenda customizada com valor de cada convênio
    if (legendaContainer) {
        legendaContainer.innerHTML = grupos.map((g, i) => `
            <div class="legenda-item">
                <div class="legenda-nome">
                    <span class="legenda-cor" style="background: ${cores[i]};"></span>
                    <span>${g.convenio}</span>
                </div>
                <div class="legenda-valor">${g.total.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}</div>
            </div>
        `).join('');
    }
}

function mostrarTooltip(conteudo, mouseX, mouseY) {

    


    if (!tooltipElement) {
      
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'grafico-tooltip';
        document.body.appendChild(tooltipElement);
    }
    
    tooltipElement.innerHTML = conteudo;
    tooltipElement.style.display = 'block';
    tooltipElement.style.opacity = '1';
    
    // Posiciona o tooltip (um pouco à direita e acima do mouse)
    let left = mouseX + 15;
    let top = mouseY - 10;
    
    // Ajusta para não sair da tela
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (left + tooltipRect.width > viewportWidth) {
        left = mouseX - tooltipRect.width - 15;
    }
    
    if (top + tooltipRect.height > viewportHeight) {
        top = mouseY - tooltipRect.height - 10;
    }
    
    if (top < 0) top = mouseY + 20;
    
    tooltipElement.style.left = left + 'px';
    tooltipElement.style.top = top + 'px';


}

// Função para esconder o tooltip
function esconderTooltip() {
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
}

function gerarCardNoDashboard(p, valorReal) {
    const container = document.getElementById('containerCardsHome');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'card-item';
    div.innerHTML = `
        <div class="info">
            <strong>${p.nome_cliente}</strong>
            <span>${p.banco} - ${p.operacao_feita}</span>
        </div>
        <div class="valor-status">
            <span class="v">${valorReal.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}</span>
            <span class="s status-${p.status_proposta.toLowerCase()}">${p.status_proposta}</span>
        </div>
    `;
    container.appendChild(div);
}

// 4. LÓGICA DA BARRA DE PROGRESSO
function atualizarProgressoMeta() {
    const producaoTexto = document.getElementById('prod-mes-anterior').innerText;
    const metaTexto = document.getElementById('meta-individual-home').innerText;

    const limparMoeda = (valor) => {
        return parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
    };

    const producao = limparMoeda(producaoTexto);
    const meta = limparMoeda(metaTexto);

    let porcentagem = meta > 0 ? (producao / meta) * 100 : 0;
    
    const barra = document.querySelector('.barra-progresso');
    const labelPorcentagem = document.getElementById('porcentagem-valor');

    if (barra) barra.style.width = Math.min(porcentagem, 100) + "%";
    if (labelPorcentagem) {
        labelPorcentagem.innerText = porcentagem.toFixed(1) + "%";
        if (porcentagem >= 100) labelPorcentagem.innerText += " 🔥";
    }
}


async function carregarOportunidades() {
    try {
        const container = document.getElementById('oportunidadesContainer');
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner">Carregando oportunidades...</div>';

        const response = await fetch(`https://sistemamscred.com.br/api/oportunidades`)
        const oportunidades = await response.json();

        if (!oportunidades || oportunidades.length === 0) {
            container.innerHTML = '<div class="loading-spinner">Nenhuma oportunidade encontrada no momento.</div>';
            return;
        }

        let totais = {
            margem: { total: 0, disponivel: 0, rmc: 0, rcc: 0, clientes: 0 },
            portabilidade: { total: 0, liberado: 0, saldo: 0, contratos: 0, clientes: 0 },
            cartao: { cartoes: 0, clientes: 0 }
        };

        oportunidades.forEach(op => {
            const tipos = op.tipo.split('+');
            
            if (tipos.includes('margem')) {
                totais.margem.disponivel += parseFloat(op.margem_disponivel) || 0;
                totais.margem.clientes++;
            }
            // Margem RMC
            if (tipos.includes('margem_rmc')) {
                totais.margem.rmc += parseFloat(op.margem_rmc) || 0;
                if (!tipos.includes('margem')) totais.margem.clientes++;
            }

            if (tipos.includes('margem_rcc')) {
                totais.margem.rcc += parseFloat(op.margem_rcc) || 0;
                if (!tipos.includes('margem') && !tipos.includes('margem_rmc')) totais.margem.clientes++;
            }

            totais.margem.total = totais.margem.disponivel + totais.margem.rmc + totais.margem.rcc;

            if (tipos.includes('portabilidade')) {
                totais.portabilidade.clientes++;
                totais.portabilidade.contratos += op.contratos_portaveis?.length || 0;

                // soma quitacao de cada contrato
                (op.contratos_portaveis || []).forEach(ct => {
                    totais.portabilidade.saldo += parseFloat(ct.quitacao) || 0;
                });

                // soma valor_cliente de cada simulacao
                (op.simulacao_portabilidade || []).forEach(s => {
                    if (s.simulacao?.valor_cliente) {
                        const v = parseFloat(s.simulacao.valor_cliente.replace('.', '').replace(',', '.')) || 0;
                        totais.portabilidade.liberado += v;
                    }
                });

                totais.portabilidade.total = totais.portabilidade.liberado + totais.portabilidade.saldo;
            }
            if (tipos.includes('cartao')) {
                totais.cartao.cartoes += op.cartoes?.length || 0;
                totais.cartao.clientes++;
            }
        });

        const margemEl = document.getElementById('resumo-margem');
        const margemQtdEl = document.getElementById('resumo-qtd-margem');

        if (margemEl) {
            // Cria o HTML com detalhamento
            margemEl.innerHTML = `
                <div style="font-size: 28px; font-weight: bold; color: #219653;">
                    R$ ${formatBRL(totais.margem.total)}
                </div>
                <div style="font-size: 13px; color: #666; margin-top: 8px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                        <span>• Margem disponível:</span>
                        <span style="font-weight: 500;">R$ ${formatBRL(totais.margem.disponivel)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                        <span>• RMC:</span>
                        <span style="font-weight: 500;">R$ ${formatBRL(totais.margem.rmc)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                        <span>• RCC:</span>
                        <span style="font-weight: 500;">R$ ${formatBRL(totais.margem.rcc)}</span>
                    </div>
                </div>
            `;
        }
        const qtdMargem = document.getElementById('resumo-qtd-margem');
        if (qtdMargem) qtdMargem.innerText = `${totais.margem.clientes} cliente${totais.margem.clientes !== 1 ? 's' : ''}`;

        
        const portEl = document.getElementById('resumo-portabilidade');
        if (portEl) {
            portEl.innerHTML = `
                <div style="font-size: 28px; font-weight: bold; color: #1a73e8;">
                    R$ ${formatBRL(totais.portabilidade.total)}
                </div>
                <div style="font-size: 13px; color: #666; margin-top: 8px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                        <span>💰 Valor liberado:</span>
                        <span style="font-weight: 500;">R$ ${formatBRL(totais.portabilidade.liberado)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                        <span>🏦 Saldo devedor:</span>
                        <span style="font-weight: 500;">R$ ${formatBRL(totais.portabilidade.saldo)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 2px 0; margin-top: 4px; opacity: 0.7;">
                        <span>📋 Contratos:</span>
                        <span>${totais.portabilidade.contratos} (${totais.portabilidade.clientes} clientes)</span>
                    </div>
                </div>
            `;
        }

        const qtdPort = document.getElementById('resumo-qtd-port');
        if (qtdPort) qtdPort.innerText = `${totais.portabilidade.clientes} cliente${totais.portabilidade.clientes !== 1 ? 's' : ''}`;

        // ── Resumo cartão ──
        const resumoCartoes = document.getElementById('resumo-cartoes');
        if (resumoCartoes) resumoCartoes.innerText = totais.cartao.cartoes;
        const qtdCartao = document.getElementById('resumo-qtd-cartao');
        if (qtdCartao) qtdCartao.innerText = `${totais.cartao.clientes} cliente${totais.cartao.clientes !== 1 ? 's' : ''}`;

        container.innerHTML = '';

        oportunidades.forEach(op => {
            const tipos = op.tipo.split('+');
            const card = document.createElement('div');
            card.className = 'oportunidade-card';

            let icones = '';
            if (tipos.includes('margem')) {
                icones += `<span class="tipo-badge tipo-margem">💰 R$ ${formatBRL(op.margem_disponivel)}</span>`;
            }
            if (tipos.includes('margem_rmc')) {
                icones += `<span class="tipo-badge tipo-margem">💰 RMC R$ ${formatBRL(op.margem_rmc)}</span>`;
            }
            if (tipos.includes('margem_rcc')) {
                icones += `<span class="tipo-badge tipo-margem">💰 RCC R$ ${formatBRL(op.margem_rcc)}</span>`;
            }
            if (tipos.includes('portabilidade')) {
                icones += `<span class="tipo-badge tipo-portabilidade">📦 ${op.contratos_portaveis?.length || 0} contrato(s)</span>`;
            }
            if (tipos.includes('cartao')) {
                const qtd = op.cartoes?.length || 0;
                icones += `<span class="tipo-badge tipo-cartao">💳 ${qtd} ${qtd > 1 ? 'cartões' : 'cartão'} BMG</span>`;
            }

            let contratosHtml = '';
            if (tipos.includes('portabilidade') && op.contratos_portaveis?.length) {
                op.contratos_portaveis.forEach((ct, idx) => {
                    // busca simulação correspondente pelo banco_origem
                    const simObj = (op.simulacao_portabilidade || []).find(s => s.banco_origem === ct.banco && s.parcela === ct.parcela);
                    const sim = simObj?.simulacao;

                    const liberado = sim?.valor_cliente || '—';
                    const saldo = ct.quitacao ? `R$ ${formatBRL(ct.quitacao)}` : '—';

                    contratosHtml += `
                        <div class="mini-card-contrato">
                            <div class="mini-card-header">
                                <span class="mini-banco">🏦 ${ct.banco}</span>
                            </div>
                            <div class="mini-card-info">
                                <span>Parcela: <strong>R$ ${formatBRL(ct.parcela)}</strong></span>
                                <span>Pagas: <strong>${ct.parcelas_pagas}</strong></span>
                                <span>Saldo: <strong>${saldo}</strong></span>
                            </div>
                            <div class="mini-card-valores">
                                <span class="valor-liberado">💰 Liberado: <strong>${sim ? 'R$ ' + liberado : '—'}</strong></span>
                            </div>
                            ${sim ? `
                            <div class="mini-card-simulacao" id="sim-${op.cpf}-${idx}" style="display:none;">
                                <div class="sim-detalhe">
                                    <span>🏦 Banco destino: <strong>${sim.banco_destino}</strong></span>
                                    <span>📋 Parcela nova: <strong>R$ ${sim.parcela_nova}</strong></span>
                                    <span>📊 Taxa: <strong>${sim.taxa}%</strong></span>
                                    <span>🔁 Troco: <strong>R$ ${sim.troco}</strong></span>
                                </div>
                            </div>
                            <button class="btn-ver-simulacao" onclick="toggleSimulacao('sim-${op.cpf}-${idx}', this)">
                                ▼ Ver Simulação
                            </button>
                            ` : ''}
                        </div>
                    `;
                });
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <strong>${op.nome}</strong>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">
                            CPF: ${op.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                        </div>
                    </div>
                    <span style="color: #666; font-size: 12px; background: #f0f0f0; padding: 2px 8px; border-radius: 12px;">
                        ${op.idade || '?'} anos
                    </span>
                </div>
                <div style="margin: 10px 0; display: flex; gap: 8px; flex-wrap: wrap;">
                    ${icones}
                </div>
                ${contratosHtml ? `<div class="contratos-portaveis-wrapper">${contratosHtml}</div>` : ''}
                <div style="margin-top: 10px;">
                    <span style="font-size: 11px; color: #999;">📅 ${op.data_consulta}</span>
                </div>
            `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error('Erro ao carregar oportunidades:', error);
        const container = document.getElementById('oportunidadesContainer')
        if (container) {
            container.innerHTML = '<div class="loading-spinner">Erro ao carregar oportunidades.</div>';
        }

        }
}

function toggleSimulacao(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const aberto = el.style.display !== 'none';
    el.style.display = aberto ? 'none' : 'block';
    btn.textContent = aberto ? '▼ Ver Simulação' : '▲ Fechar Simulação';
}

document.addEventListener('DOMContentLoaded', () => {
    carregarOportunidades();
})

// --- EVENTOS DE INTERFACE ---
document.addEventListener('DOMContentLoaded', inicializarHome);

document.getElementById('toggleMenu').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('aberto');
});

function fazerLogout() {
    localStorage.clear();
    window.location.replace("telalogin.html");
}