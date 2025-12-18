// backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Supabase (backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Converte yyyy-mm-dd -> dd/mm/yyyy
function isoToBr(dateStr) {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Converte Date para yyyy-mm-dd
function dateToIso(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function primeiroDiaDoMesFromIso(iso) {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function calcularIndicador(alvo, realizado) {
  const alvoNum = Number(alvo || 0);
  const realNum = Number(realizado || 0);
  const percentual = alvoNum > 0 ? (realNum / alvoNum) * 100 : 0;
  const diferenca = realNum - alvoNum;
  const faltou = Math.max(0, alvoNum - realNum);

  return {
    alvo: alvoNum,
    realizado: realNum,
    percentual: Number.isFinite(percentual) ? percentual : 0,
    diferenca,
    faltou,
    atingiu: realNum >= alvoNum,
  };
}

// Tenta extrair lista de itens do retorno da Omie (varia por conta/retorno)
function extrairListaItens(omieData) {
  const fr = omieData?.faturamentoResumo || {};

  // Tentativas comuns (ajuste depois que você confirmar no seu retorno real)
  return (
    fr.listaProdutos ||
    fr.ListaProdutos ||
    fr.lista_produtos ||
    omieData?.listaProdutos ||
    omieData?.ListaProdutos ||
    []
  );
}

// Regra simples do Supabase: {"contains":["AGUA","ÁGUA"],"campo":"descricao"}
function matchRegra(item, regra) {
  if (!regra) return false;

  const campo = (regra.campo || 'descricao').toLowerCase();
  const contains = Array.isArray(regra.contains) ? regra.contains : [];

  let texto = '';
  if (campo === 'descricao') {
    texto = String(item.cDescricao || item.descricao || item.produto || '').toUpperCase();
  } else {
    // fallback: tenta acessar campo direto do item
    texto = String(item[campo] || '').toUpperCase();
  }

  return contains.some((t) => texto.includes(String(t).toUpperCase()));
}

// ================================
//  /api/vendas (SEU ENDPOINT ATUAL)
// ================================
app.get('/api/vendas', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;

    const hoje = new Date();
    let diIso, dfIso;

    if (dataInicio && dataFim) {
      diIso = dataInicio;
      dfIso = dataFim;
    } else {
      // padrão: últimos 7 dias
      const df = new Date(hoje);
      const di = new Date(hoje);
      di.setDate(di.getDate() - 6);
      diIso = dateToIso(di);
      dfIso = dateToIso(df);
    }

    const diBr = isoToBr(diIso);
    const dfBr = isoToBr(dfIso);

    const payload = {
      call: 'ObterResumoProdutos',
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          dDataInicio: diBr,
          dDataFim: dfBr,
          lApenasResumo: true,
        },
      ],
    };

    const { data } = await axios.post(
      'https://app.omie.com.br/api/v1/produtos/vendas-resumo/',
      payload
    );

    const fr = data.faturamentoResumo || {};
    const nFaturadas = fr.nFaturadas || 0;
    const vFaturadasNum = Number(fr.vFaturadas || 0);
    const ticketMedio = nFaturadas > 0 ? vFaturadasNum / nFaturadas : 0;

    res.json({
      dataInicioIso: diIso,
      dataFimIso: dfIso,
      dataInicioBr: diBr,
      dataFimBr: dfBr,
      nFaturadas,
      vFaturadas: vFaturadasNum,
      ticketMedio,
      bruto: fr,
    });
  } catch (error) {
    console.error('Erro Omie:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Mensagem:', error.message);
    }
    res.status(500).json({ error: 'Erro ao consultar resumo de vendas na Omie' });
  }
});

// =====================================
//  /api/metas (NOVO) Supabase + Omie
// =====================================
app.get('/api/metas', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;

    // Período padrão: últimos 7 dias (igual /api/vendas)
    const hoje = new Date();
    let diIso, dfIso;

    if (dataInicio && dataFim) {
      diIso = dataInicio;
      dfIso = dataFim;
    } else {
      const df = new Date(hoje);
      const di = new Date(hoje);
      di.setDate(di.getDate() - 6);
      diIso = dateToIso(di);
      dfIso = dateToIso(df);
    }

    // Mês de referência para buscar meta (primeiro dia do mês de dataInicio)
    const mesRef = dateToIso(primeiroDiaDoMesFromIso(diIso)); // ex: 2024-12-01

    // 1) Buscar metas do mês no Supabase
    const { data: metasRows, error: metasErr } = await supabase
      .from('metas')
      .select(`
        id, mes, tipo, titulo,
        meta_componentes ( metrica, alvo, regra )
      `)
      .eq('mes', mesRef);

    if (metasErr) throw metasErr;

    // 2) Buscar Omie com lApenasResumo=false (para tentar obter itens/produtos)
    const payload = {
      call: 'ObterResumoProdutos',
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          dDataInicio: isoToBr(diIso),
          dDataFim: isoToBr(dfIso),
          lApenasResumo: false,
        },
      ],
    };

    const { data: omieData } = await axios.post(
      'https://app.omie.com.br/api/v1/produtos/vendas-resumo/',
      payload
    );

    const fr = omieData?.faturamentoResumo || {};
    const faturamentoTotal = Number(fr.vFaturadas || 0);

    const itens = extrairListaItens(omieData);
    const temItens = Array.isArray(itens) && itens.length > 0;

    // 3) Somatórios por regra (cookies/águas/enredo)
    // Observação: campos podem variar. Tentamos nQuantidade e vTotal como defaults.
    function getQtd(item) {
      return Number(item.nQuantidade ?? item.quantidade ?? 0);
    }
    function getValor(item) {
      return Number(item.vTotal ?? item.vValorTotal ?? item.valor_total ?? 0);
    }

    // Pré-calcula somas por tipo usando as regras cadastradas no Supabase
    let somaCookiesQtd = 0;
    let somaCookiesValor = 0;

    let somaAguasQtd = 0;
    let somaAguasValor = 0;

    let somaEnredoValor = 0;

    if (temItens) {
      for (const item of itens) {
        const qtd = getQtd(item);
        const val = getValor(item);

        // para aplicar regras, vamos buscar as regras nas metas
        // (a regra já está nos componentes, então varremos metas e batemos)
        // mas como são poucos (4 metas), dá para fazer direto.
        // Cookies
        const metaCookies = metasRows.find((m) => m.tipo === 'COOKIES');
        const regraCookies = metaCookies?.meta_componentes?.[0]?.regra; // você está usando só QTD por enquanto
        if (metaCookies && metaCookies.meta_componentes?.some((c) => matchRegra(item, c.regra))) {
          somaCookiesQtd += qtd;
          somaCookiesValor += val;
        }

        // Águas
        const metaAguas = metasRows.find((m) => m.tipo === 'AGUAS');
        if (metaAguas && metaAguas.meta_componentes?.some((c) => matchRegra(item, c.regra))) {
          somaAguasQtd += qtd;
          somaAguasValor += val;
        }

        // Enredo (share por faturamento)
        const metaEnredo = metasRows.find((m) => m.tipo === 'ENREDO_SHARE');
        if (metaEnredo && metaEnredo.meta_componentes?.some((c) => matchRegra(item, c.regra))) {
          somaEnredoValor += val;
        }
      }
    }

    // 4) Montar resposta calculada por meta
    const metasCalculadas = metasRows.map((m) => {
      const componentes = (m.meta_componentes || []).map((c) => {
        const alvo = Number(c.alvo || 0);
        let realizado = 0;
        const extra = {};

        if (m.tipo === 'FATURAMENTO_TOTAL') {
          // total sempre dá para calcular
          realizado = faturamentoTotal;
        } else if (!temItens) {
          // sem itens não dá para calcular por categoria/produto
          realizado = 0;
        } else if (m.tipo === 'COOKIES') {
          // hoje você cadastrou QTD; se amanhã adicionar VALOR, já funciona
          realizado = c.metrica === 'VALOR' ? somaCookiesValor : somaCookiesQtd;
        } else if (m.tipo === 'AGUAS') {
          realizado = c.metrica === 'VALOR' ? somaAguasValor : somaAguasQtd;
        } else if (m.tipo === 'ENREDO_SHARE') {
          // meta por faturamento: enredo/total
          if (c.metrica === 'PERCENTUAL') {
            realizado = faturamentoTotal > 0 ? somaEnredoValor / faturamentoTotal : 0;
            extra.base_total = faturamentoTotal;
            extra.base_parte = somaEnredoValor;
            extra.base_descricao = 'enredo/total (faturamento)';
          } else {
            // se no futuro você adicionar meta de valor do enredo
            realizado = somaEnredoValor;
          }
        }

        return {
          metrica: c.metrica,
          regra: c.regra || null,
          ...calcularIndicador(alvo, realizado),
          ...extra,
        };
      });

      // atingiu_geral = todos componentes atingiram (se tiver componentes)
      const atingiu_geral = componentes.length ? componentes.every((x) => x.atingiu) : false;

      return {
        mes: m.mes,
        tipo: m.tipo,
        titulo: m.titulo,
        atingiu_geral,
        componentes,
      };
    });

    res.json({
      mesRef,
      periodo: { dataInicio: diIso, dataFim: dfIso },
      faturamentoTotal,
      aviso: temItens
        ? null
        : 'A Omie não retornou lista de itens no resumo (lApenasResumo=false). Cookies/Águas/Enredo ficarão 0 até ajustarmos o mapeamento do retorno.',
      metas: metasCalculadas,
      debug: {
        temItens,
        totalItens: temItens ? itens.length : 0,
      },
    });
  } catch (error) {
    console.error('Erro /api/metas:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao consultar metas (Supabase) e vendas (Omie)' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/api/vendas`);
  console.log(`Acesse: http://localhost:${PORT}/api/metas`);
});
