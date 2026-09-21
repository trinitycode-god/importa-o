/* =========================================================
   CONTROLE DE MATERIAIS IMPORTADOS — Condor
   script.js — JavaScript puro, sem frameworks
   ========================================================= */
"use strict";

/* ---------------------------------------------------------
   CONFIGURAÇÃO
   Cole abaixo a URL do Web App do Apps Script (termina em /exec).
   Não coloque senhas nem credenciais neste arquivo.
   --------------------------------------------------------- */
const API_URL = "https://script.google.com/macros/s/AKfycbxYwWj9m3zUAykhSZ7f2E8EZOI5xEymbIwc0HNGm8kNBodFAO0XWm9odc-7AI4kyA3f/exec";

const LIMITE_INICIAL = 20; // últimos registros mostrados ao abrir a página
const TEMPO_LIMITE_MS = 60000; // o Apps Script pode demorar na primeira chamada

const MSG_ERRO_SALVAR =
  "Não foi possível registrar o material. Verifique a conexão e tente novamente.";
const MSG_ERRO_CONSULTA =
  "Não foi possível consultar os registros. Verifique a conexão e tente novamente.";
const MSG_SEM_CONFIG =
  "Configure a URL do Apps Script (API_URL) no arquivo script.js.";

/* ---------------------------------------------------------
   Referências da página
   --------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const campos = {
  codigo: $("codigo"),
  descricao: $("descricao"),
  fornecedor: $("fornecedor"),
  pedido: $("pedido"),
  data: $("data"),
  quantidade: $("quantidade"),
};

const dataNativa = $("dataNativa");
const formRecebimento = $("formRecebimento");
const formPesquisa = $("formPesquisa");
const btnSalvar = $("btnSalvar");

const SVG_NS = "http://www.w3.org/2000/svg";

/* ---------------------------------------------------------
   Utilitários
   --------------------------------------------------------- */
function apiConfigurada() {
  return Boolean(API_URL) && API_URL.indexOf("COLE_AQUI") === -1;
}

function doisDigitos(n) {
  return String(n).padStart(2, "0");
}

function criarIcone(id) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icone");
  const uso = document.createElementNS(SVG_NS, "use");
  uso.setAttribute("href", "#" + id);
  svg.appendChild(uso);
  return svg;
}

/** Formata número no padrão brasileiro; se não for número, devolve o texto original. */
function formatarQuantidade(valor) {
  const texto = String(valor === null || valor === undefined ? "" : valor).trim();
  if (texto === "") return "";
  const numero = typeof valor === "number" ? valor : Number(texto.replace(",", "."));
  if (isFinite(numero)) {
    return numero.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  }
  return texto;
}

/* ---------------------------------------------------------
   Datas
   Visual: DD/MM/AAAA  ·  Envio ao Apps Script: AAAA-MM-DD
   (a data é montada como texto, sem passar por objeto Date,
   para que o fuso horário nunca desloque o dia)
   --------------------------------------------------------- */
function dataHojeBR() {
  const d = new Date();
  return doisDigitos(d.getDate()) + "/" + doisDigitos(d.getMonth() + 1) + "/" + d.getFullYear();
}

/** "21/09/2026" -> "2026-09-21". Devolve null se a data não existir. */
function brParaISO(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto).trim());
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);

  if (ano < 2000 || ano > 2100) return null;

  const teste = new Date(ano, mes - 1, dia);
  if (teste.getFullYear() !== ano || teste.getMonth() !== mes - 1 || teste.getDate() !== dia) {
    return null;
  }

  return ano + "-" + doisDigitos(mes) + "-" + doisDigitos(dia);
}

/* Máscara enquanto digita: 21092026 -> 21/09/2026 */
campos.data.addEventListener("input", () => {
  const digitos = campos.data.value.replace(/\D/g, "").slice(0, 8);
  let texto = digitos;

  if (digitos.length > 4) {
    texto = digitos.slice(0, 2) + "/" + digitos.slice(2, 4) + "/" + digitos.slice(4);
  } else if (digitos.length > 2) {
    texto = digitos.slice(0, 2) + "/" + digitos.slice(2);
  }

  campos.data.value = texto;
});

/* Calendário nativo (fica invisível sobre o ícone) */
dataNativa.addEventListener("click", () => {
  dataNativa.value = brParaISO(campos.data.value) || "";
  if (typeof dataNativa.showPicker === "function") {
    try {
      dataNativa.showPicker();
    } catch (_) {
      /* alguns navegadores só abrem o calendário no toque direto */
    }
  }
});

dataNativa.addEventListener("change", () => {
  if (!dataNativa.value) return;
  const partes = dataNativa.value.split("-"); // AAAA-MM-DD
  campos.data.value = partes[2] + "/" + partes[1] + "/" + partes[0];
  limparErroCampo("data");
  renderizarEmail();
});

/* ---------------------------------------------------------
   Formulário: leitura e validação
   --------------------------------------------------------- */
function lerFormulario() {
  return {
    codigo: campos.codigo.value.trim(),
    descricao: campos.descricao.value.trim(),
    fornecedor: campos.fornecedor.value.trim(),
    pedido: campos.pedido.value.trim(),
    data: campos.data.value.trim(),
    quantidade: campos.quantidade.value.trim(),
  };
}

function validar(dados) {
  const erros = {};

  if (!dados.codigo) erros.codigo = "Informe o código do produto.";
  if (!dados.descricao) erros.descricao = "Informe a descrição.";
  if (!dados.fornecedor) erros.fornecedor = "Informe o fornecedor.";
  if (!dados.pedido) erros.pedido = "Informe o número do pedido.";

  if (!dados.data) {
    erros.data = "Informe a data.";
  } else if (!brParaISO(dados.data)) {
    erros.data = "Data inválida. Use o formato DD/MM/AAAA.";
  }

  const quantidade = Number(dados.quantidade);
  if (dados.quantidade === "" || !isFinite(quantidade) || quantidade <= 0) {
    erros.quantidade = "Informe uma quantidade maior que zero.";
  }

  return erros;
}

function mostrarErros(erros) {
  let primeiro = null;

  Object.keys(campos).forEach((nome) => {
    if (erros[nome]) {
      campos[nome].setAttribute("aria-invalid", "true");
      const span = $("erro-" + nome);
      span.textContent = erros[nome];
      span.hidden = false;
      if (!primeiro) primeiro = campos[nome];
    }
  });

  if (primeiro) primeiro.focus();
}

function limparErroCampo(nome) {
  campos[nome].removeAttribute("aria-invalid");
  const span = $("erro-" + nome);
  span.textContent = "";
  span.hidden = true;
}

function limparTodosErros() {
  Object.keys(campos).forEach(limparErroCampo);
}

Object.keys(campos).forEach((nome) => {
  campos[nome].addEventListener("input", () => {
    limparErroCampo(nome);
    renderizarEmail();
  });
});

/* ---------------------------------------------------------
   Mensagens (formulário e toast)
   --------------------------------------------------------- */
let temporizadorMensagem = null;

function mostrarMensagemForm(tipo, texto, detalhe) {
  const caixa = $("mensagemForm");
  clearTimeout(temporizadorMensagem);

  caixa.className = "mensagem mensagem--" + tipo;
  caixa.replaceChildren();
  caixa.appendChild(criarIcone(tipo === "sucesso" ? "i-ok" : "i-alerta"));

  const bloco = document.createElement("div");
  bloco.appendChild(document.createTextNode(texto));

  if (detalhe) {
    const small = document.createElement("small");
    small.textContent = detalhe;
    bloco.appendChild(small);
  }

  caixa.appendChild(bloco);
  caixa.hidden = false;

  if (tipo === "sucesso") {
    temporizadorMensagem = setTimeout(() => {
      caixa.hidden = true;
    }, 8000);
  }
}

function esconderMensagemForm() {
  clearTimeout(temporizadorMensagem);
  $("mensagemForm").hidden = true;
}

let temporizadorToast = null;

function toast(texto, tipo) {
  const el = $("toast");
  clearTimeout(temporizadorToast);

  el.className = "toast toast--" + (tipo || "sucesso");
  el.replaceChildren(
    criarIcone(tipo === "erro" ? "i-alerta" : "i-ok"),
    document.createTextNode(texto)
  );

  void el.offsetWidth; // reinicia a transição
  el.classList.add("visivel");

  temporizadorToast = setTimeout(() => el.classList.remove("visivel"), 3200);
}

/* ---------------------------------------------------------
   E-mail
   --------------------------------------------------------- */
function saudacao(agora) {
  const hora = (agora || new Date()).getHours();
  if (hora < 12) return "Bom dia!";
  if (hora < 18) return "Boa tarde!";
  return "Boa noite!";
}

function montarEmail(dados) {
  const campo = (rotulo, valor, marcador) => ({
    rotulo: rotulo,
    texto: valor || marcador,
    vazio: !valor,
  });

  const texto = (t) => ({ texto: t });

  const quantidade = dados.quantidade ? formatarQuantidade(dados.quantidade) : "";

  const assunto =
    "Recebimento de Material Importado – " +
    (dados.codigo || "[CÓDIGO]") +
    " – Pedido " +
    (dados.pedido || "[PEDIDO]");

  // Cada item é um parágrafo; cada parágrafo é uma lista de linhas.
  const blocos = [
    [texto(saudacao())],
    [texto("Prezados,")],
    [texto("Informamos que o material importado abaixo foi recebido:")],
    [campo("Código do Produto", dados.codigo, "[CÓDIGO]")],
    [campo("Descrição", dados.descricao, "[DESCRIÇÃO]")],
    [campo("Fornecedor", dados.fornecedor, "[FORNECEDOR]")],
    [campo("Número do Pedido", dados.pedido, "[PEDIDO]")],
    [campo("Data do Recebimento", dados.data, "[DATA]")],
    [campo("Quantidade Recebida", quantidade, "[QUANTIDADE]")],
    [texto("O material foi recebido e registrado para controle.")],
    [texto("Atenciosamente,"), texto("Almoxarifado")],
  ];

  const corpo = blocos
    .map((bloco) =>
      bloco
        .map((linha) => (linha.rotulo ? linha.rotulo + ": " + linha.texto : linha.texto))
        .join("\n")
    )
    .join("\n\n");

  return { assunto: assunto, blocos: blocos, corpo: corpo };
}

function renderizarEmail() {
  const email = montarEmail(lerFormulario());

  $("emailAssunto").textContent = email.assunto;

  const corpo = $("emailCorpo");
  corpo.replaceChildren();

  email.blocos.forEach((bloco) => {
    const p = document.createElement("p");

    bloco.forEach((linha, indice) => {
      if (indice > 0) p.appendChild(document.createElement("br"));

      if (linha.rotulo) {
        const rotulo = document.createElement("span");
        rotulo.className = "email__rotulo";
        rotulo.textContent = linha.rotulo + ": ";
        p.appendChild(rotulo);
      }

      if (linha.vazio) {
        const vazio = document.createElement("span");
        vazio.className = "email__vazio";
        vazio.textContent = linha.texto;
        p.appendChild(vazio);
      } else {
        p.appendChild(document.createTextNode(linha.texto));
      }
    });

    corpo.appendChild(p);
  });
}

/** Só libera copiar/abrir e-mail com todos os campos preenchidos e válidos. */
function emailPronto() {
  const erros = validar(lerFormulario());

  if (Object.keys(erros).length > 0) {
    mostrarErros(erros);
    toast("Preencha todos os campos para gerar o e-mail.", "erro");
    return false;
  }

  return true;
}

async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (_) {
    /* tenta o método alternativo abaixo */
  }

  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copiou = document.execCommand("copy");
    document.body.removeChild(area);
    return copiou;
  } catch (_) {
    return false;
  }
}

$("btnCopiar").addEventListener("click", async () => {
  if (!emailPronto()) return;

  const email = montarEmail(lerFormulario());
  const copiou = await copiarTexto("Assunto: " + email.assunto + "\n\n" + email.corpo);

  if (copiou) {
    toast("E-mail copiado com sucesso!", "sucesso");
  } else {
    toast("Não foi possível copiar. Selecione o texto e copie manualmente.", "erro");
  }
});

$("btnMailto").addEventListener("click", () => {
  if (!emailPronto()) return;

  const email = montarEmail(lerFormulario());
  const corpo = email.corpo.replace(/\n/g, "\r\n");

  // Abre o programa de e-mail com assunto e corpo preenchidos.
  // Nada é enviado automaticamente: o usuário clica em Enviar.
  window.location.href =
    "mailto:?subject=" + encodeURIComponent(email.assunto) + "&body=" + encodeURIComponent(corpo);
});

/* ---------------------------------------------------------
   Comunicação com o Apps Script
   --------------------------------------------------------- */
async function chamarApi(url, opcoes) {
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(
      url,
      Object.assign({}, opcoes, { signal: controle.signal, cache: "no-store" })
    );

    if (!resposta.ok) throw new Error("HTTP " + resposta.status);

    return await resposta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

/* ---------------------------------------------------------
   Salvar recebimento
   --------------------------------------------------------- */
let salvando = false;

const iconeSalvar = btnSalvar.querySelector(".icone");
const spinnerSalvar = document.createElement("span");
spinnerSalvar.className = "spinner";

function definirSalvando(ativo) {
  salvando = ativo;
  btnSalvar.disabled = ativo;
  btnSalvar.querySelector("span:not(.spinner)").textContent = ativo
    ? "SALVANDO..."
    : "SALVAR RECEBIMENTO";

  if (ativo) {
    if (iconeSalvar.isConnected) iconeSalvar.replaceWith(spinnerSalvar);
  } else if (spinnerSalvar.isConnected) {
    spinnerSalvar.replaceWith(iconeSalvar);
  }
}

function limparFormulario() {
  Object.keys(campos).forEach((nome) => {
    campos[nome].value = "";
  });
  campos.data.value = dataHojeBR();
  limparTodosErros();
  renderizarEmail();

  // Em computador, devolve o cursor ao primeiro campo para o próximo lançamento.
  if (window.matchMedia("(pointer: fine)").matches) {
    campos.codigo.focus();
  }
}

formRecebimento.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (salvando) return;

  esconderMensagemForm();

  const dados = lerFormulario();
  const erros = validar(dados);

  if (Object.keys(erros).length > 0) {
    mostrarErros(erros);
    return;
  }

  if (!apiConfigurada()) {
    mostrarMensagemForm("erro", MSG_ERRO_SALVAR, MSG_SEM_CONFIG);
    return;
  }

  definirSalvando(true);

  try {
    const resposta = await chamarApi(API_URL, {
      method: "POST",
      // text/plain evita a requisição "preflight" (CORS) que o Apps Script não responde
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "salvarImportacao",
        codigo: dados.codigo,
        descricao: dados.descricao,
        fornecedor: dados.fornecedor,
        pedido: dados.pedido,
        data: brParaISO(dados.data), // AAAA-MM-DD
        quantidade: String(Number(dados.quantidade)),
      }),
    });

    if (resposta && resposta.ok) {
      mostrarMensagemForm("sucesso", "Material registrado com sucesso!");
      limparFormulario();
      consultar(termoAtivo);
    } else {
      // Os dados digitados são mantidos para o usuário tentar de novo.
      const detalhe = resposta && resposta.erro ? "Detalhe: " + resposta.erro : "";
      mostrarMensagemForm("erro", MSG_ERRO_SALVAR, detalhe);
    }
  } catch (erro) {
    console.error("Erro ao salvar:", erro);
    mostrarMensagemForm("erro", MSG_ERRO_SALVAR);
  } finally {
    definirSalvando(false);
  }
});

/* ---------------------------------------------------------
   Consulta / tabela
   --------------------------------------------------------- */
let termoAtivo = "";
let numeroRequisicao = 0;

function ocultarResultados() {
  $("tabelaWrap").hidden = true;
  $("estado").hidden = true;
}

function mostrarEstado(tipo, texto, comNovaTentativa) {
  const estado = $("estado");
  $("tabelaWrap").hidden = true;

  estado.className = "estado" + (tipo === "erro" ? " estado--erro" : "");
  estado.replaceChildren();

  if (tipo === "carregando") {
    const spinner = document.createElement("span");
    spinner.className = "spinner spinner--grande";
    estado.appendChild(spinner);
  } else if (tipo === "erro") {
    estado.appendChild(criarIcone("i-alerta"));
  } else {
    estado.appendChild(criarIcone("i-busca"));
  }

  const mensagem = document.createElement("span");
  mensagem.textContent = texto;
  estado.appendChild(mensagem);

  if (comNovaTentativa) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn--secundario";
    botao.textContent = "TENTAR NOVAMENTE";
    botao.addEventListener("click", () => consultar(termoAtivo));
    estado.appendChild(botao);
  }

  estado.hidden = false;
}

function celula(rotulo, texto, classe) {
  const td = document.createElement("td");
  td.dataset.label = rotulo;
  if (classe) td.className = classe;
  td.textContent = texto;
  return td;
}

function renderizarTabela(registros) {
  const corpo = $("tabelaCorpo");
  corpo.replaceChildren();

  const fragmento = document.createDocumentFragment();

  registros.forEach((r) => {
    const tr = document.createElement("tr");

    const tdQuantidade = document.createElement("td");
    tdQuantidade.dataset.label = "Quantidade";
    tdQuantidade.className = "num";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = formatarQuantidade(r.quantidade);
    tdQuantidade.appendChild(badge);

    tr.appendChild(celula("Código", r.codigo, "codigo"));
    tr.appendChild(celula("Descrição", r.descricao));
    tr.appendChild(celula("Fornecedor", r.fornecedor));
    tr.appendChild(celula("Pedido", r.pedido, "pedido"));
    tr.appendChild(celula("Data", r.data, "data"));
    tr.appendChild(tdQuantidade);

    fragmento.appendChild(tr);
  });

  corpo.appendChild(fragmento);
  $("estado").hidden = true;
  $("tabelaWrap").hidden = false;
}

/**
 * Consulta o Apps Script.
 *  - termo vazio  -> últimos LIMITE_INICIAL registros
 *  - termo preenchido -> pesquisa em código, descrição, fornecedor e pedido
 */
async function consultar(termo) {
  termoAtivo = termo || "";
  const contagem = $("contagem");

  if (!apiConfigurada()) {
    contagem.textContent = "";
    mostrarEstado("erro", MSG_SEM_CONFIG, false);
    return;
  }

  const numero = ++numeroRequisicao; // ignora respostas antigas
  contagem.textContent = "";
  mostrarEstado("carregando", "Consultando registros...", false);

  try {
    const url = termoAtivo
      ? API_URL + "?action=pesquisarImportacoes&termo=" + encodeURIComponent(termoAtivo)
      : API_URL + "?action=listarImportacoes&limite=" + LIMITE_INICIAL;

    const resposta = await chamarApi(url, { method: "GET" });

    if (numero !== numeroRequisicao) return;

    if (!resposta || !resposta.ok) {
      throw new Error((resposta && resposta.erro) || "Resposta inválida do servidor.");
    }

    const registros = Array.isArray(resposta.registros) ? resposta.registros : [];

    if (registros.length === 0) {
      mostrarEstado("vazio", "Nenhum material encontrado.", false);
      return;
    }

    // A planilha devolve do mais antigo para o mais recente; mostramos o mais recente primeiro.
    renderizarTabela(registros.slice().reverse());

    const total = typeof resposta.total === "number" ? resposta.total : registros.length;

    if (!termoAtivo && total > registros.length) {
      contagem.textContent =
        "Exibindo os últimos " + registros.length + " de " + total + " registros";
    } else {
      contagem.textContent =
        registros.length === 1
          ? "1 registro encontrado"
          : registros.length + " registros encontrados";
    }
  } catch (erro) {
    if (numero !== numeroRequisicao) return;
    console.error("Erro ao consultar:", erro);
    mostrarEstado("erro", MSG_ERRO_CONSULTA, true);
  }
}

formPesquisa.addEventListener("submit", (evento) => {
  evento.preventDefault();
  consultar($("termo").value.trim());
});

$("btnLimpar").addEventListener("click", () => {
  $("termo").value = "";
  consultar("");
  $("termo").focus();
});

/* ---------------------------------------------------------
   Início
   --------------------------------------------------------- */
function iniciar() {
  campos.data.value = dataHojeBR();
  renderizarEmail();

  // Mantém a saudação correta caso o horário vire com a página aberta.
  setInterval(renderizarEmail, 60000);

  if (!apiConfigurada()) {
    $("avisoConfig").hidden = false;
  }

  ocultarResultados();
  consultar("");
}

iniciar();
