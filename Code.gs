/**
 * =========================================================
 * SISTEMA DE ETIQUETAS — CONDOR
 * Code.gs — Backend Google Apps Script
 * =========================================================
 *
 * Este arquivo reúne DOIS módulos que compartilham o mesmo Web App:
 *
 *   1) Sistema de Etiquetas (código original, sem alterações de lógica)
 *      - abas: "BANCO DADOS" e "Condor"
 *
 *   2) Controle de Materiais Importados (módulo NOVO, acrescentado)
 *      - aba: "Importação" (somente esta)
 *      - ver bloco "MÓDULO: CONTROLE DE MATERIAIS IMPORTADOS" no final
 */

const ABA_BANCO = "BANCO DADOS";
const ABA_ETIQUETAS = "Condor";
const ABA_IMPORTACAO = "Importação";

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "listarProdutos") {
      return responderJSON(listarProdutos());
    }

    if (action === "buscarProduto") {
      const codigo = e.parameter.codigo || "";
      return responderJSON(buscarProduto(codigo));
    }

    if (action === "listarImportacoes") {
      // "limite" é opcional: se informado, devolve apenas os N últimos registros.
      return responderJSON(listarImportacoes(e.parameter.limite));
    }

    if (action === "pesquisarImportacoes") {
      const termo = e.parameter.termo || "";
      return responderJSON(pesquisarImportacoes(termo));
    }

    return responderJSON({ ok: false, erro: "Ação inválida ou não informada." });
  } catch (err) {
    return responderJSON({ ok: false, erro: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === "salvarEtiqueta") {
      return responderJSON(salvarEtiqueta(body));
    }

    if (body.action === "salvarImportacao") {
      return responderJSON(salvarImportacao(body));
    }

    return responderJSON({ ok: false, erro: "Ação inválida ou não informada." });
  } catch (err) {
    return responderJSON({ ok: false, erro: String(err) });
  }
}

function listarProdutos() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(ABA_BANCO);

  if (!aba) {
    return { ok: false, erro: `Aba "${ABA_BANCO}" não encontrada.` };
  }

  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) {
    return { ok: true, produtos: [] };
  }

  const dados = aba.getRange(2, 1, ultimaLinha - 1, 2).getValues();

  const produtos = dados
    .filter((linha) => String(linha[0]).trim() !== "")
    .map((linha) => ({
      codigo: String(linha[0]).trim(),
      descricao: String(linha[1]).trim(),
    }));

  return { ok: true, produtos: produtos };
}

function buscarProduto(codigo) {
  const codigoLimpo = String(codigo).trim();

  if (!codigoLimpo) {
    return { ok: false, erro: "Código não informado." };
  }

  const resultado = listarProdutos();

  if (!resultado.ok) return resultado;

  const produto = resultado.produtos.find((p) => p.codigo === codigoLimpo);

  if (!produto) {
    return { ok: false, erro: "Produto não encontrado no banco de dados." };
  }

  return { ok: true, produto: produto };
}

function salvarEtiqueta(dados) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(ABA_ETIQUETAS);

  if (!aba) {
    return { ok: false, erro: `Aba "${ABA_ETIQUETAS}" não encontrada.` };
  }

  const codigo = String(dados.codigo || "").trim();
  const descricao = String(dados.descricao || "").trim();
  const quantidade = String(dados.quantidade || "").trim();
  const lote = String(dados.lote || "").trim();
  const validade = String(dados.validade || "").trim();
  const notaFiscal = String(dados.notaFiscal || "").trim();
  const dataRecebimento = String(dados.dataRecebimento || "").trim();

  if (!codigo || !descricao || !quantidade || !lote || !validade || !notaFiscal) {
    return { ok: false, erro: "Campos obrigatórios ausentes." };
  }

  const verificacao = buscarProduto(codigo);

  if (!verificacao.ok) {
    return { ok: false, erro: "Produto não encontrado no banco de dados." };
  }

  aba.appendRow([
    codigo,
    descricao,
    quantidade,
    lote,
    validade,
    notaFiscal,
    dataRecebimento,
  ]);

  return { ok: true, mensagem: "Etiqueta salva com sucesso!" };
}

function responderJSON(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * =========================================================
 * MÓDULO: CONTROLE DE MATERIAIS IMPORTADOS  (NOVO)
 * =========================================================
 * Trabalha SOMENTE com a aba "Importação".
 *
 *   A — Código do Produto
 *   B — Descrição
 *   C — Fornecedor
 *   D — Número do Pedido
 *   E — Data
 *   F — Quantidade
 *
 * Linha 1 = cabeçalho. Os dados começam na linha 2.
 * Nunca cria aba, nunca apaga dados, nunca bloqueia duplicidade.
 * =========================================================
 */

/**
 * Localiza a aba "Importação" PELO NOME (nunca pela posição).
 * Se não existir, devolve null — o chamador retorna o erro ao usuário.
 * A comparação de reserva apenas ignora diferenças de codificação do "ç/ã"
 * (NFC x NFD), que às vezes acontecem quando o nome é colado de outro lugar.
 */
function obterAbaImportacao() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();

  const aba = planilha.getSheetByName(ABA_IMPORTACAO);
  if (aba) return aba;

  const alvo = ABA_IMPORTACAO.normalize("NFC");
  const todas = planilha.getSheets();
  for (let i = 0; i < todas.length; i++) {
    if (todas[i].getName().normalize("NFC") === alvo) {
      return todas[i];
    }
  }

  return null;
}

function erroAbaImportacaoNaoEncontrada() {
  return { ok: false, erro: `Aba "${ABA_IMPORTACAO}" não encontrada.` };
}

/** Remove acentos e coloca em minúsculas (usado na pesquisa). */
function normalizarTextoImportacao(texto) {
  return String(texto === null || texto === undefined ? "" : texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Formata a data como DD/MM/AAAA usando o fuso horário da planilha.
 * Nunca devolve algo como "Thu Sep 21 2026...".
 */
function formatarDataImportacao(valor, fuso) {
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return "";
    return Utilities.formatDate(valor, fuso, "dd/MM/yyyy");
  }

  const texto = String(valor === null || valor === undefined ? "" : valor).trim();
  if (!texto) return "";

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return iso[3] + "/" + iso[2] + "/" + iso[1];
  }

  return texto; // já está em texto (ex.: "21/09/2026")
}

/**
 * Converte "AAAA-MM-DD" (formato enviado pelo site) ou "DD/MM/AAAA" em um
 * objeto Date à meia-noite NO FUSO DA PLANILHA. Devolve null se inválida.
 */
function converterDataImportacao(texto, fuso) {
  const t = String(texto || "").trim();
  let dia, mes, ano, m;

  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    ano = Number(m[1]);
    mes = Number(m[2]);
    dia = Number(m[3]);
  } else if ((m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    dia = Number(m[1]);
    mes = Number(m[2]);
    ano = Number(m[3]);
  } else {
    return null;
  }

  // Garante que a data existe de verdade (ex.: recusa 31/02/2026).
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    teste.getUTCFullYear() !== ano ||
    teste.getUTCMonth() !== mes - 1 ||
    teste.getUTCDate() !== dia
  ) {
    return null;
  }

  const p = (n) => (n < 10 ? "0" + n : String(n));
  return Utilities.parseDate(ano + "-" + p(mes) + "-" + p(dia), fuso, "yyyy-MM-dd");
}

/** Converte a quantidade recebida em número. Aceita "12,5" e "12.5". */
function converterQuantidadeImportacao(valor) {
  let t = String(valor === null || valor === undefined ? "" : valor)
    .trim()
    .replace(/\s/g, "");

  if (!t) return NaN;

  if (t.indexOf(",") !== -1) {
    // formato brasileiro: "1.250,5" -> "1250.5"
    t = t.replace(/\./g, "").replace(",", ".");
  }

  return Number(t);
}

/**
 * Lê todas as linhas de dados da aba "Importação" (linha 2 em diante),
 * ignorando linhas totalmente vazias.
 */
function lerImportacoes() {
  const aba = obterAbaImportacao();

  if (!aba) {
    return erroAbaImportacaoNaoEncontrada();
  }

  const fuso = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const ultimaLinha = aba.getLastRow();

  if (ultimaLinha < 2) {
    return { ok: true, registros: [] };
  }

  const dados = aba.getRange(2, 1, ultimaLinha - 1, 6).getValues();
  const registros = [];

  dados.forEach((linha, indice) => {
    const vazia = linha.every((celula) => String(celula).trim() === "");
    if (vazia) return;

    const quantidade = linha[5];

    registros.push({
      linha: indice + 2,
      codigo: String(linha[0]).trim(),
      descricao: String(linha[1]).trim(),
      fornecedor: String(linha[2]).trim(),
      pedido: String(linha[3]).trim(),
      data: formatarDataImportacao(linha[4], fuso),
      quantidade: typeof quantidade === "number" ? quantidade : String(quantidade).trim(),
    });
  });

  return { ok: true, registros: registros };
}

/**
 * GET ?action=listarImportacoes
 * GET ?action=listarImportacoes&limite=20  (somente os 20 últimos)
 * Os registros vêm na ordem da planilha (mais antigo primeiro).
 */
function listarImportacoes(limite) {
  const resultado = lerImportacoes();
  if (!resultado.ok) return resultado;

  const total = resultado.registros.length;
  const n = Number(limite);

  const registros =
    n > 0 && n < total ? resultado.registros.slice(total - n) : resultado.registros;

  return { ok: true, total: total, registros: registros };
}

/**
 * GET ?action=pesquisarImportacoes&termo=XXXXX
 * Procura o termo em: Código, Descrição, Fornecedor e Número do Pedido.
 * Ignora maiúsculas/minúsculas (e também acentos).
 */
function pesquisarImportacoes(termo) {
  const termoNormalizado = normalizarTextoImportacao(termo);

  if (!termoNormalizado) {
    return listarImportacoes();
  }

  const resultado = lerImportacoes();
  if (!resultado.ok) return resultado;

  const encontrados = resultado.registros.filter((r) => {
    return (
      normalizarTextoImportacao(r.codigo).indexOf(termoNormalizado) !== -1 ||
      normalizarTextoImportacao(r.descricao).indexOf(termoNormalizado) !== -1 ||
      normalizarTextoImportacao(r.fornecedor).indexOf(termoNormalizado) !== -1 ||
      normalizarTextoImportacao(r.pedido).indexOf(termoNormalizado) !== -1
    );
  });

  return {
    ok: true,
    termo: String(termo).trim(),
    total: encontrados.length,
    registros: encontrados,
  };
}

/**
 * POST { action: "salvarImportacao", codigo, descricao, fornecedor,
 *        pedido, data, quantidade }
 * Valida no servidor e grava uma NOVA linha na aba "Importação".
 * Não bloqueia duplicidade: cada recebimento é um novo registro.
 */
function salvarImportacao(dados) {
  const aba = obterAbaImportacao();

  if (!aba) {
    return erroAbaImportacaoNaoEncontrada();
  }

  const codigo = String(dados.codigo || "").trim();
  const descricao = String(dados.descricao || "").trim();
  const fornecedor = String(dados.fornecedor || "").trim();
  const pedido = String(dados.pedido || "").trim();
  const dataTexto = String(dados.data || "").trim();
  const quantidadeTexto = String(dados.quantidade === 0 ? "0" : dados.quantidade || "").trim();

  if (!codigo || !descricao || !fornecedor || !pedido || !dataTexto || !quantidadeTexto) {
    return { ok: false, erro: "Campos obrigatórios ausentes." };
  }

  const fuso = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  const data = converterDataImportacao(dataTexto, fuso);
  if (!data) {
    return { ok: false, erro: "Data inválida." };
  }

  const quantidade = converterQuantidadeImportacao(quantidadeTexto);
  if (!isFinite(quantidade) || quantidade <= 0) {
    return { ok: false, erro: "A quantidade deve ser maior que zero." };
  }

  // Evita que dois salvamentos simultâneos escrevam na mesma linha.
  const trava = LockService.getScriptLock();
  trava.waitLock(30000);

  try {
    // Próxima linha disponível (nunca antes da linha 2: a linha 1 é o cabeçalho).
    const linha = Math.max(aba.getLastRow(), 1) + 1;

    // Colunas A-D como TEXTO: preserva zeros à esquerda (ex.: 000123)
    // e impede que "=..." seja interpretado como fórmula.
    aba.getRange(linha, 1, 1, 4).setNumberFormat("@");

    aba.getRange(linha, 1, 1, 6).setValues([
      [codigo, descricao, fornecedor, pedido, data, quantidade],
    ]);

    // Data gravada como data de verdade, exibida em DD/MM/AAAA.
    aba.getRange(linha, 5).setNumberFormat("dd/MM/yyyy");

    SpreadsheetApp.flush();
  } finally {
    trava.releaseLock();
  }

  return { ok: true, mensagem: "Importação registrada com sucesso!" };
}
