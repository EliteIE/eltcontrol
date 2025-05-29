// elitecontrol-data-firebase.js - Versão com Firebase integrado

// Referências para coleções do Firestore
const db = firebase.firestore();
const produtosRef = db.collection('produtos');
const vendasRef = db.collection('vendas');
const usuariosRef = db.collection('usuarios');
const notificacoesRef = db.collection('notificacoes');
const configuracoesRef = db.collection('configuracoes');

// Cache local para melhorar performance
let produtosCache = [];
let vendasCache = [];
let usuariosCache = [];
let notificacoesCache = [];
let configuracoesCache = null;

// Funções auxiliares
function gerarId(collection) {
    return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

// Inicialização e carregamento de dados
async function inicializarDados() {
    try {
        // Verificar se já existem dados no Firestore
        const configSnapshot = await configuracoesRef.doc('sistema').get();
        
        if (!configSnapshot.exists) {
            // Primeira execução - carregar dados iniciais do localStorage
            console.log("Primeira execução com Firebase - migrando dados do localStorage");
            await migrarDadosLocalStorageParaFirebase();
        } else {
            // Já existem dados no Firebase - carregar para cache local
            await carregarDadosFirebaseParaCache();
        }
        
        // Configurar listeners para atualizações em tempo real
        configurarListenersFirebase();
        
        return true;
    } catch (error) {
        console.error("Erro ao inicializar dados:", error);
        showTemporaryAlert("Erro ao conectar ao banco de dados. Usando modo offline.", "error");
        // Fallback para localStorage em caso de erro
        carregarDadosLocalStorage();
        return false;
    }
}

async function migrarDadosLocalStorageParaFirebase() {
    try {
        // Carregar dados do localStorage
        carregarDadosLocalStorage();
        
        // Migrar produtos
        const batchProdutos = db.batch();
        produtosCache.forEach(produto => {
            const docRef = produtosRef.doc(produto.sku);
            batchProdutos.set(docRef, produto);
        });
        await batchProdutos.commit();
        
        // Migrar vendas em lotes (para evitar limites de tamanho de batch)
        for (let i = 0; i < vendasCache.length; i += 500) {
            const batchVendas = db.batch();
            const chunk = vendasCache.slice(i, i + 500);
            chunk.forEach(venda => {
                const docRef = vendasRef.doc(venda.id.toString());
                batchVendas.set(docRef, venda);
            });
            await batchVendas.commit();
        }
        
        // Migrar usuários
        const batchUsuarios = db.batch();
        usuariosCache.forEach(usuario => {
            const docRef = usuariosRef.doc(usuario.id.toString());
            batchUsuarios.set(docRef, usuario);
        });
        await batchUsuarios.commit();
        
        // Migrar notificações
        const batchNotificacoes = db.batch();
        notificacoesCache.forEach(notificacao => {
            const docRef = notificacoesRef.doc(notificacao.id.toString());
            batchNotificacoes.set(docRef, notificacao);
        });
        await batchNotificacoes.commit();
        
        // Salvar configuração do sistema
        await configuracoesRef.doc('sistema').set({
            versao: '1.0',
            ultimaAtualizacao: new Date().toISOString(),
            migradoDeLocalStorage: true
        });
        
        console.log("Migração de dados do localStorage para Firebase concluída com sucesso!");
        showTemporaryAlert("Migração para banco de dados na nuvem concluída com sucesso!", "success");
    } catch (error) {
        console.error("Erro ao migrar dados para Firebase:", error);
        showTemporaryAlert("Erro ao migrar dados para a nuvem. Usando modo offline.", "error");
    }
}

async function carregarDadosFirebaseParaCache() {
    try {
        // Carregar produtos
        const produtosSnapshot = await produtosRef.get();
        produtosCache = produtosSnapshot.docs.map(doc => doc.data());
        
        // Carregar vendas (limitado às 1000 mais recentes para performance)
        const vendasSnapshot = await vendasRef.orderBy('data', 'desc').limit(1000).get();
        vendasCache = vendasSnapshot.docs.map(doc => doc.data());
        
        // Carregar usuários
        const usuariosSnapshot = await usuariosRef.get();
        usuariosCache = usuariosSnapshot.docs.map(doc => doc.data());
        
        // Carregar notificações (limitado às 100 mais recentes para performance)
        const notificacoesSnapshot = await notificacoesRef.orderBy('timestamp', 'desc').limit(100).get();
        notificacoesCache = notificacoesSnapshot.docs.map(doc => doc.data());
        
        // Carregar configurações
        const configSnapshot = await configuracoesRef.doc('sistema').get();
        configuracoesCache = configSnapshot.data();
        
        console.log("Dados carregados do Firebase para cache com sucesso!");
    } catch (error) {
        console.error("Erro ao carregar dados do Firebase:", error);
        showTemporaryAlert("Erro ao carregar dados da nuvem. Alguns dados podem estar desatualizados.", "warning");
    }
}

function configurarListenersFirebase() {
    // Listener para produtos
    produtosRef.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const produto = change.doc.data();
            if (change.type === 'added' || change.type === 'modified') {
                const index = produtosCache.findIndex(p => p.sku === produto.sku);
                if (index >= 0) {
                    produtosCache[index] = produto;
                } else {
                    produtosCache.push(produto);
                }
            } else if (change.type === 'removed') {
                produtosCache = produtosCache.filter(p => p.sku !== produto.sku);
            }
        });
    }, error => {
        console.error("Erro no listener de produtos:", error);
    });
    
    // Listener para notificações (para manter o sistema de notificações atualizado)
    notificacoesRef.orderBy('timestamp', 'desc').limit(100).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const notificacao = change.doc.data();
            if (change.type === 'added') {
                const index = notificacoesCache.findIndex(n => n.id === notificacao.id);
                if (index === -1) {
                    notificacoesCache.push(notificacao);
                    // Disparar evento para atualizar interface
                    document.dispatchEvent(new CustomEvent('novaNotificacao'));
                }
            } else if (change.type === 'modified') {
                const index = notificacoesCache.findIndex(n => n.id === notificacao.id);
                if (index >= 0) {
                    notificacoesCache[index] = notificacao;
                    // Disparar evento para atualizar interface
                    document.dispatchEvent(new CustomEvent('notificacaoLida'));
                }
            }
        });
    }, error => {
        console.error("Erro no listener de notificações:", error);
    });
}

// Fallback para localStorage
function carregarDadosLocalStorage() {
    try {
        produtosCache = JSON.parse(localStorage.getItem('produtos')) || [];
        vendasCache = JSON.parse(localStorage.getItem('vendas')) || [];
        usuariosCache = JSON.parse(localStorage.getItem('usuarios')) || [];
        notificacoesCache = JSON.parse(localStorage.getItem('notificacoes')) || [];
        
        // Se não existirem usuários, criar o usuário padrão
        if (usuariosCache.length === 0) {
            usuariosCache = [
                {
                    id: 1,
                    nome: "Admin",
                    email: "admin@elitecontrol.com",
                    senha: "admin123",
                    perfil: "gerente",
                    ativo: true,
                    dataCriacao: new Date().toISOString()
                },
                {
                    id: 2,
                    nome: "Vendedor",
                    email: "vendedor@elitecontrol.com",
                    senha: "vendedor123",
                    perfil: "vendas",
                    ativo: true,
                    dataCriacao: new Date().toISOString()
                },
                {
                    id: 3,
                    nome: "Estoque",
                    email: "estoque@elitecontrol.com",
                    senha: "estoque123",
                    perfil: "inventario",
                    ativo: true,
                    dataCriacao: new Date().toISOString()
                }
            ];
            localStorage.setItem('usuarios', JSON.stringify(usuariosCache));
        }
    } catch (error) {
        console.error("Erro ao carregar dados do localStorage:", error);
        // Inicializar com arrays vazios em caso de erro
        produtosCache = [];
        vendasCache = [];
        usuariosCache = [];
        notificacoesCache = [];
    }
}

// Funções de Produtos
async function obterProdutos() {
    // Retorna a cache local para performance
    return produtosCache;
}

async function obterProdutoPorSku(sku) {
    // Primeiro tenta na cache local
    const produtoCache = produtosCache.find(p => p.sku === sku);
    if (produtoCache) return produtoCache;
    
    // Se não encontrar, busca no Firebase
    try {
        const docRef = await produtosRef.doc(sku).get();
        if (docRef.exists) {
            const produto = docRef.data();
            // Atualiza a cache
            const index = produtosCache.findIndex(p => p.sku === sku);
            if (index >= 0) {
                produtosCache[index] = produto;
            } else {
                produtosCache.push(produto);
            }
            return produto;
        }
        return null;
    } catch (error) {
        console.error(`Erro ao buscar produto ${sku}:`, error);
        return null;
    }
}

async function adicionarProduto(produto) {
    if (!produto.sku) {
        throw new Error("SKU é obrigatório");
    }
    
    // Verificar se já existe
    const existente = await obterProdutoPorSku(produto.sku);
    if (existente) {
        throw new Error(`Produto com SKU ${produto.sku} já existe`);
    }
    
    // Adicionar campos padrão
    produto.dataCriacao = new Date().toISOString();
    produto.dataAtualizacao = new Date().toISOString();
    
    try {
        // Salvar no Firebase
        await produtosRef.doc(produto.sku).set(produto);
        
        // Atualizar cache local
        produtosCache.push(produto);
        
        return produto.sku;
    } catch (error) {
        console.error("Erro ao adicionar produto:", error);
        throw new Error(`Erro ao adicionar produto: ${error.message}`);
    }
}

async function atualizarProduto(sku, dadosAtualizados) {
    // Verificar se existe
    const produto = await obterProdutoPorSku(sku);
    if (!produto) {
        throw new Error(`Produto com SKU ${sku} não encontrado`);
    }
    
    // Atualizar campos
    const produtoAtualizado = { ...produto, ...dadosAtualizados };
    produtoAtualizado.dataAtualizacao = new Date().toISOString();
    
    try {
        // Salvar no Firebase
        await produtosRef.doc(sku).update(produtoAtualizado);
        
        // Atualizar cache local
        const index = produtosCache.findIndex(p => p.sku === sku);
        if (index >= 0) {
            produtosCache[index] = produtoAtualizado;
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao atualizar produto ${sku}:`, error);
        throw new Error(`Erro ao atualizar produto: ${error.message}`);
    }
}

async function excluirProduto(sku) {
    // Verificar se existe
    const produto = await obterProdutoPorSku(sku);
    if (!produto) {
        throw new Error(`Produto com SKU ${sku} não encontrado`);
    }
    
    // Verificar se há vendas associadas
    const vendasComProduto = vendasCache.some(v => 
        v.itens && v.itens.some(i => i.produtoSku === sku)
    );
    
    if (vendasComProduto) {
        throw new Error(`Não é possível excluir: produto possui vendas associadas`);
    }
    
    try {
        // Excluir do Firebase
        await produtosRef.doc(sku).delete();
        
        // Atualizar cache local
        produtosCache = produtosCache.filter(p => p.sku !== sku);
        
        return true;
    } catch (error) {
        console.error(`Erro ao excluir produto ${sku}:`, error);
        throw new Error(`Erro ao excluir produto: ${error.message}`);
    }
}

// Funções de Vendas
async function obterVendas() {
    // Retorna a cache local para performance
    return vendasCache;
}

async function obterVendaPorId(id) {
    if (!id) return null;
    
    // Converter para string se for número
    const idString = id.toString();
    
    // Primeiro tenta na cache local
    const vendaCache = vendasCache.find(v => v.id.toString() === idString);
    if (vendaCache) return vendaCache;
    
    // Se não encontrar, busca no Firebase
    try {
        const docRef = await vendasRef.doc(idString).get();
        if (docRef.exists) {
            const venda = docRef.data();
            // Atualiza a cache
            vendasCache.push(venda);
            return venda;
        }
        return null;
    } catch (error) {
        console.error(`Erro ao buscar venda ${id}:`, error);
        return null;
    }
}

async function registrarVenda(dadosVenda) {
    if (!dadosVenda || !dadosVenda.itens || dadosVenda.itens.length === 0) {
        throw new Error("Dados da venda inválidos ou sem itens");
    }
    
    // Gerar ID único
    const id = parseInt(Date.now().toString().slice(-10));
    
    // Preparar objeto de venda
    const venda = {
        ...dadosVenda,
        id: id,
        data: new Date().toISOString(),
        status: 'finalizada'
    };
    
    try {
        // Atualizar estoque dos produtos
        for (const item of venda.itens) {
            const produto = await obterProdutoPorSku(item.produtoSku);
            if (!produto) {
                throw new Error(`Produto com SKU ${item.produtoSku} não encontrado`);
            }
            
            if (produto.quantidade < item.quantidade) {
                throw new Error(`Estoque insuficiente para ${produto.nome}`);
            }
            
            // Atualizar estoque
            await atualizarProduto(item.produtoSku, {
                quantidade: produto.quantidade - item.quantidade
            });
        }
        
        // Salvar venda no Firebase
        await vendasRef.doc(id.toString()).set(venda);
        
        // Atualizar cache local
        vendasCache.unshift(venda);
        
        return id;
    } catch (error) {
        console.error("Erro ao registrar venda:", error);
        throw new Error(`Erro ao registrar venda: ${error.message}`);
    }
}

async function cancelarVenda(id, usuarioId) {
    // Verificar se existe
    const venda = await obterVendaPorId(id);
    if (!venda) {
        throw new Error(`Venda #${id} não encontrada`);
    }
    
    if (venda.status === 'cancelada') {
        throw new Error(`Venda #${id} já está cancelada`);
    }
    
    try {
        // Restaurar estoque dos produtos
        for (const item of venda.itens) {
            const produto = await obterProdutoPorSku(item.produtoSku);
            if (produto) {
                await atualizarProduto(item.produtoSku, {
                    quantidade: produto.quantidade + item.quantidade
                });
            }
        }
        
        // Atualizar status da venda
        const vendaAtualizada = {
            ...venda,
            status: 'cancelada',
            dataCancelamento: new Date().toISOString(),
            usuarioCancelamentoId: usuarioId
        };
        
        // Salvar no Firebase
        await vendasRef.doc(id.toString()).update(vendaAtualizada);
        
        // Atualizar cache local
        const index = vendasCache.findIndex(v => v.id === id);
        if (index >= 0) {
            vendasCache[index] = vendaAtualizada;
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao cancelar venda ${id}:`, error);
        throw new Error(`Erro ao cancelar venda: ${error.message}`);
    }
}

// Funções de Usuários
async function obterUsuarios() {
    // Retorna a cache local para performance
    return usuariosCache;
}

async function obterUsuarioPorId(id) {
    if (!id) return null;
    
    // Converter para string se for número
    const idString = id.toString();
    
    // Primeiro tenta na cache local
    const usuarioCache = usuariosCache.find(u => u.id.toString() === idString);
    if (usuarioCache) return usuarioCache;
    
    // Se não encontrar, busca no Firebase
    try {
        const docRef = await usuariosRef.doc(idString).get();
        if (docRef.exists) {
            const usuario = docRef.data();
            // Atualiza a cache
            usuariosCache.push(usuario);
            return usuario;
        }
        return null;
    } catch (error) {
        console.error(`Erro ao buscar usuário ${id}:`, error);
        return null;
    }
}

async function autenticarUsuario(email, senha) {
    if (!email || !senha) return null;
    
    try {
        // Buscar usuário por email
        const usuariosSnapshot = await usuariosRef.where('email', '==', email).limit(1).get();
        
        if (usuariosSnapshot.empty) {
            return null;
        }
        
        const usuario = usuariosSnapshot.docs[0].data();
        
        // Verificar senha
        if (usuario.senha === senha && usuario.ativo) {
            // Remover senha antes de retornar
            const { senha, ...usuarioSemSenha } = usuario;
            return usuarioSemSenha;
        }
        
        return null;
    } catch (error) {
        console.error("Erro ao autenticar usuário:", error);
        return null;
    }
}

// Funções de Notificações
async function obterNotificacoes(perfil) {
    // Filtrar por perfil
    return notificacoesCache.filter(n => 
        !n.perfisAlvo || n.perfisAlvo.includes(perfil)
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function obterNotificacoesNaoLidas(perfil) {
    const notificacoes = await obterNotificacoes(perfil);
    return notificacoes.filter(n => !n.lida);
}

async function criarNotificacao(dados) {
    if (!dados.titulo || !dados.mensagem) {
        throw new Error("Título e mensagem são obrigatórios");
    }
    
    // Gerar ID único
    const id = parseInt(Date.now().toString().slice(-10));
    
    // Preparar objeto de notificação
    const notificacao = {
        ...dados,
        id: id,
        timestamp: new Date().toISOString(),
        lida: false
    };
    
    try {
        // Salvar no Firebase
        await notificacoesRef.doc(id.toString()).set(notificacao);
        
        // Atualizar cache local
        notificacoesCache.unshift(notificacao);
        
        // Disparar evento para atualizar interface
        document.dispatchEvent(new CustomEvent('novaNotificacao'));
        
        return id;
    } catch (error) {
        console.error("Erro ao criar notificação:", error);
        throw new Error(`Erro ao criar notificação: ${error.message}`);
    }
}

async function marcarNotificacaoComoLida(id) {
    // Verificar se existe
    const index = notificacoesCache.findIndex(n => n.id === id);
    if (index === -1) {
        throw new Error(`Notificação #${id} não encontrada`);
    }
    
    try {
        // Atualizar no Firebase
        await notificacoesRef.doc(id.toString()).update({ lida: true });
        
        // Atualizar cache local
        notificacoesCache[index].lida = true;
        
        // Disparar evento para atualizar interface
        document.dispatchEvent(new CustomEvent('notificacaoLida'));
        
        return true;
    } catch (error) {
        console.error(`Erro ao marcar notificação ${id} como lida:`, error);
        throw new Error(`Erro ao atualizar notificação: ${error.message}`);
    }
}

async function marcarTodasComoLidas(perfil) {
    const notificacoes = await obterNotificacoesNaoLidas(perfil);
    if (notificacoes.length === 0) return true;
    
    try {
        // Atualizar em lotes no Firebase
        const batch = db.batch();
        notificacoes.forEach(n => {
            batch.update(notificacoesRef.doc(n.id.toString()), { lida: true });
        });
        await batch.commit();
        
        // Atualizar cache local
        notificacoes.forEach(n => {
            const index = notificacoesCache.findIndex(c => c.id === n.id);
            if (index >= 0) {
                notificacoesCache[index].lida = true;
            }
        });
        
        // Disparar evento para atualizar interface
        document.dispatchEvent(new CustomEvent('notificacoesLidas'));
        
        return true;
    } catch (error) {
        console.error("Erro ao marcar todas notificações como lidas:", error);
        throw new Error(`Erro ao atualizar notificações: ${error.message}`);
    }
}

// Funções de Relatórios
async function obterRelatorioVendasPorPeriodo(dataInicio, dataFim) {
    // Implementação mantida similar, mas usando dados do cache
    const vendas = vendasCache.filter(v => 
        v.status === 'finalizada' && 
        v.data >= dataInicio && 
        v.data <= dataFim + 'T23:59:59'
    );
    
    // Agrupar por data
    const vendasPorData = {};
    vendas.forEach(venda => {
        const data = venda.data.split('T')[0];
        if (!vendasPorData[data]) {
            vendasPorData[data] = {
                data: data,
                quantidadeVendas: 0,
                totalItens: 0,
                totalValor: 0
            };
        }
        vendasPorData[data].quantidadeVendas++;
        vendasPorData[data].totalItens += venda.itens.reduce((sum, item) => sum + item.quantidade, 0);
        vendasPorData[data].totalValor += venda.total;
    });
    
    // Converter para array e ordenar por data
    return Object.values(vendasPorData).sort((a, b) => a.data.localeCompare(b.data));
}

// Exportar todas as funções
window.obterProdutos = obterProdutos;
window.obterProdutoPorSku = obterProdutoPorSku;
window.adicionarProduto = adicionarProduto;
window.atualizarProduto = atualizarProduto;
window.excluirProduto = excluirProduto;
window.obterVendas = obterVendas;
window.obterVendaPorId = obterVendaPorId;
window.registrarVenda = registrarVenda;
window.cancelarVenda = cancelarVenda;
window.obterUsuarios = obterUsuarios;
window.obterUsuarioPorId = obterUsuarioPorId;
window.autenticarUsuario = autenticarUsuario;
window.obterNotificacoes = obterNotificacoes;
window.obterNotificacoesNaoLidas = obterNotificacoesNaoLidas;
window.criarNotificacao = criarNotificacao;
window.marcarNotificacaoComoLida = marcarNotificacaoComoLida;
window.marcarTodasComoLidas = marcarTodasComoLidas;
window.obterRelatorioVendasPorPeriodo = obterRelatorioVendasPorPeriodo;
window.inicializarDados = inicializarDados;

// Inicializar dados quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando sistema de dados com Firebase...");
    inicializarDados().then(success => {
        if (success) {
            console.log("Sistema de dados inicializado com Firebase!");
        } else {
            console.warn("Sistema de dados inicializado em modo offline (localStorage)");
        }
    });
});
