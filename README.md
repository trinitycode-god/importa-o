# Controle de Materiais Importados — Condor

Módulo novo para registrar e consultar materiais importados recebidos.

- **Frontend:** HTML + CSS + JavaScript puro, hospedado no **GitHub Pages**
- **Backend:** **Google Apps Script** (o mesmo Web App do sistema de etiquetas)
- **Banco de dados:** planilha **Google Sheets**, somente a aba **`Importação`**

> O sistema de etiquetas **não foi alterado**. As abas `BANCO DADOS` e `Condor`, as funções
> `listarProdutos`, `buscarProduto` e `salvarEtiqueta` e o `doGet`/`doPost` originais continuam
> com a mesma lógica. O módulo novo foi apenas **acrescentado**.

---

## 1. Arquivos deste pacote

| Arquivo | Para que serve | Onde colocar |
|---|---|---|
| `Code.gs` | Apps Script completo (código antigo + módulo novo) | Editor do Apps Script da planilha |
| `index.html` | Página do sistema | Repositório do GitHub |
| `style.css` | Visual | Repositório do GitHub (mesma pasta do `index.html`) |
| `script.js` | Lógica da página | Repositório do GitHub (mesma pasta) |
| `logo.png` | Logo da Condor no cabeçalho | Repositório do GitHub (mesma pasta) |
| `README.md` | Este guia | Opcional |

Os quatro arquivos do site (`index.html`, `style.css`, `script.js`, `logo.png`) precisam ficar
**na mesma pasta**.

---

## 2. Preparar a planilha

Planilha: `12kHIExQJrFFQo0jYYFlL0Hi1lho2ux9LImMwkM6dDYE`

1. Confirme que existe uma aba chamada exatamente **`Importação`** (com acento, sem espaços extras).
   O sistema **não cria** a aba: se ela não existir, ele devolve o erro `Aba "Importação" não encontrada.`
2. Na **linha 1** dessa aba, deixe o cabeçalho:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Código do Produto | Descrição | Fornecedor | Número do Pedido | Data | Quantidade |

Os dados começam na linha 2. Registros já existentes não são apagados; os novos vão para a
próxima linha livre.

---

## 3. Publicar o Apps Script

1. Abra a planilha e vá em **Extensões → Apps Script**.
2. Abra o arquivo **`Code.gs`** do editor.
3. **Selecione todo o conteúdo e substitua** pelo conteúdo do `Code.gs` deste pacote.
   (Ele já contém o seu código atual, intacto, mais o módulo de importação.)
4. Clique em **Salvar** (ícone do disquete).
5. Clique em **Implantar → Gerenciar implantações**.
6. Na implantação que o sistema de etiquetas já usa, clique no **lápis (editar)**.
7. Em **Versão**, escolha **Nova versão** e clique em **Implantar**.
   - Assim a **URL continua a mesma** e o sistema de etiquetas segue funcionando, agora com as
     funções novas.
   - Confira: *Executar como* **Eu** e *Quem pode acessar* **Qualquer pessoa** (necessário para o GitHub Pages).
8. Se o Google pedir autorização, aceite.
9. Copie a **URL do app da Web** (termina em `/exec`).

> Se você criar uma implantação **nova** em vez de editar a antiga, a URL muda. Nesse caso o
> sistema de etiquetas continuaria apontando para a versão antiga, e você teria de atualizar a URL nele também.

---

## 4. Onde colocar a URL do Apps Script

Abra o `script.js`. Perto do início está:

```javascript
const API_URL = "COLE_AQUI_A_URL_DO_APPS_SCRIPT";
```

Troque pelo endereço copiado, mantendo as aspas:

```javascript
const API_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
```

Enquanto isso não for feito, a página mostra um aviso amarelo no topo. Não há senha nem
credencial nos arquivos.

---

## 5. Publicar no GitHub Pages

**Opção A — repositório novo (mais simples)**

1. No GitHub, crie um repositório, por exemplo `controle-importados`.
2. Clique em **Add file → Upload files** e envie `index.html`, `style.css`, `script.js` e `logo.png`.
3. Clique em **Commit changes**.
4. Vá em **Settings → Pages**.
5. Em **Build and deployment**, escolha *Deploy from a branch*, branch **main**, pasta **/(root)**, e clique em **Save**.
6. Em 1 a 2 minutos o endereço aparece: `https://SEU-USUARIO.github.io/controle-importados/`.

**Opção B — dentro do repositório do sistema de etiquetas**

Crie uma **pasta nova** (por exemplo `importados/`) e coloque os quatro arquivos dentro dela.
Não envie `index.html` para a raiz, para não sobrescrever o `index.html` das etiquetas.
Endereço: `https://SEU-USUARIO.github.io/NOME-DO-REPO/importados/`.

Sempre que editar um arquivo, faça um novo commit; o site atualiza sozinho. Se a página antiga
continuar aparecendo, recarregue com **Ctrl + F5**.

---

## 6. Como testar

### Testar o Apps Script direto no navegador

Troque `URL` pela URL do Web App:

| Teste | Endereço | Resultado esperado |
|---|---|---|
| Etiquetas continuam OK | `URL?action=listarProdutos` | `{"ok":true,"produtos":[...]}` |
| Listar importações | `URL?action=listarImportacoes` | `{"ok":true,"total":N,"registros":[...]}` |
| Só os 20 últimos | `URL?action=listarImportacoes&limite=20` | No máximo 20 registros |
| Pesquisar | `URL?action=pesquisarImportacoes&termo=abc` | Registros que contêm "abc" em qualquer caixa |

Se a aba não existir: `{"ok":false,"erro":"Aba \"Importação\" não encontrada."}`.

### Testar SALVAR

1. Abra o site.
2. Preencha: código, descrição, fornecedor, número do pedido, data (já vem com hoje) e quantidade.
3. Clique em **SALVAR RECEBIMENTO**.
4. Deve aparecer o botão em "SALVANDO...", depois a mensagem verde **"Material registrado com sucesso!"**, o formulário limpo e o novo registro no topo da tabela.
5. Abra a aba `Importação` na planilha: a linha deve estar na próxima posição livre, com a data em DD/MM/AAAA.
6. Teste também os bloqueios: deixe um campo vazio ou use quantidade `0`. Nada deve ser gravado.
7. Salve **o mesmo produto duas vezes**: devem aparecer dois registros (duplicidade é permitida).

Se ocorrer erro de conexão, aparece **"Não foi possível registrar o material. Verifique a conexão e tente novamente."** e os dados digitados são mantidos.

### Testar a PESQUISA

1. Ao abrir a página, aparecem os últimos 20 registros.
2. Digite parte de um código, descrição, fornecedor ou pedido (maiúsculas/minúsculas não importam; acentos também são ignorados) e clique em **PESQUISAR** (ou Enter).
3. A contagem aparece: **"X registros encontrados"**. Sem resultado: **"Nenhum material encontrado."**
4. **LIMPAR PESQUISA** volta aos últimos 20.

### Testar o E-MAIL

1. Preencha o formulário: a pré-visualização muda enquanto você digita.
2. A saudação segue o horário: antes das 12:00 *Bom dia!*, das 12:00 às 17:59 *Boa tarde!*, a partir das 18:00 *Boa noite!*.
3. **COPIAR E-MAIL** copia assunto + corpo e mostra **"E-mail copiado com sucesso!"**.
4. **ABRIR NO E-MAIL** abre o programa de e-mail com assunto e corpo preenchidos. Nada é enviado: você clica em Enviar.

> Copiar e abrir o e-mail só funcionam com o formulário completo, para não sair e-mail com
> `[CÓDIGO]` ou `[PEDIDO]` em branco. Copie o e-mail **antes** de salvar, pois salvar limpa o formulário.

---

## 7. Detalhes técnicos importantes

- **Aba por nome:** o script usa `getSheetByName("Importação")`, nunca a posição da aba.
- **Datas:** o site envia `AAAA-MM-DD`; o Apps Script converte usando o **fuso horário da planilha**, grava como data real (formato `dd/MM/yyyy`) e devolve sempre `DD/MM/AAAA`. Nunca aparece texto como `Thu Sep 21 2026...`.
- **Código e pedido como texto:** as colunas A–D são gravadas como texto, o que preserva zeros à esquerda (`000123`).
- **Validação no servidor:** nenhum registro é gravado sem código, descrição, fornecedor, pedido, data válida e quantidade maior que zero.
- **Gravação segura:** usa trava (`LockService`) para dois salvamentos simultâneos não caírem na mesma linha.
- **CORS:** o POST é enviado como `text/plain` para o navegador não fazer a requisição de verificação que o Apps Script não responde. O `doPost` continua lendo o JSON normalmente.
- **Primeira chamada lenta:** o Apps Script pode levar alguns segundos na primeira consulta; a página mostra "Consultando registros...".

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Aviso amarelo no topo | `API_URL` não foi preenchida | Cole a URL no `script.js` |
| "Não foi possível consultar os registros" | URL errada ou acesso não liberado | Confira `/exec` no final e *Quem pode acessar = Qualquer pessoa* |
| Erro `Aba "Importação" não encontrada` | Nome da aba diferente | Renomeie a aba para exatamente `Importação` |
| Site não mostra mudanças | Cache do navegador | Ctrl + F5 |
| Funções novas não respondem | Implantação antiga | Editar a implantação e escolher **Nova versão** |
| Logo não aparece | `logo.png` fora da pasta do `index.html` | Coloque na mesma pasta |
