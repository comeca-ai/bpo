import { getDb } from "../api/queries/connection";
import {
  clientes,
  contextProfiles,
  documentos,
  eventos,
  lotes,
  organizadores,
  validacoes,
} from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding Ajeita v1...");

  // ── Clientes ──
  await db.insert(clientes).values([
    { id: 1, nome: "Construtora Sol Nascente", cidade: "João Pessoa · PB", segmento: "Construção e obra", planoAgentes: 3, planoSkills: 2, precoMensal: 1450 },
    { id: 2, nome: "Imobiliária Porta Boa", cidade: "Recife · PE", segmento: "Imobiliária", planoAgentes: 2, planoSkills: 2, precoMensal: 1150 },
    { id: 3, nome: "Mercearia do Bairro", cidade: "Caruaru · PE", segmento: "Comércio de bairro", planoAgentes: 1, planoSkills: 1, precoMensal: 690 },
    { id: 4, nome: "Sítio Boa Esperança", cidade: "Picos · PI", segmento: "Rural", planoAgentes: 2, planoSkills: 2, precoMensal: 1190 },
  ]);

  // ── ContextProfiles (versão atual de cada cliente) ──
  await db.insert(contextProfiles).values([
    {
      clienteId: 1, versao: 7,
      namingPattern: "AAAA-MM-{TIPO}-{FORNECEDOR}-{OBRA}-{VALOR}.pdf",
      docTypes: JSON.stringify(["NF material", "Medição", "ART", "Diário de obra", "Contrato", "Recibo mão de obra", "Orçamento"]),
      taxonomy: "/Obras/{nome-da-obra}/{tipo}/{ano-mês}/ — obra atual: Litoral Plaza",
      dictionary: JSON.stringify([
        { termo: "Seu Zé", significado: "José Ferreira MEI" },
        { termo: "obra do shopping", significado: "Litoral Plaza" },
        { termo: "Pedro", significado: "mestre de obras" },
        { termo: "Gessopar", significado: "Gessopar Materiais LTDA" },
      ]),
      routingRules: JSON.stringify([
        "NF de material → pasta da obra + soma no resumo de custo",
        "Doc com “apto NNN” → também indexa por unidade",
        "Medição → alerta o financeiro no WhatsApp",
        "ART → verifica vencimento e agenda alerta 30 dias antes",
      ]),
      confidenceThreshold: 90, sampleRate: 5, concordancia: 972,
    },
    {
      clienteId: 2, versao: 4,
      namingPattern: "AAAA-MM-{TIPO}-{IMOVEL}-{PARTE}.pdf",
      docTypes: JSON.stringify(["Contrato de locação", "Laudo de vistoria", "Comprovante", "Doc de inquilino"]),
      taxonomy: "/Imóveis/{código-imovel}/{tipo}/",
      dictionary: JSON.stringify([{ termo: "dona Cida", significado: " proprietária do Ed. Solar" }]),
      routingRules: JSON.stringify(["Contrato → indexa por inquilino e por imóvel"]),
      confidenceThreshold: 90, sampleRate: 8, concordancia: 950,
    },
    {
      clienteId: 3, versao: 2,
      namingPattern: "AAAA-MM-{TIPO}-{FORNECEDOR}-{VALOR}.pdf",
      docTypes: JSON.stringify(["NF fornecedor", "Boleto", "Comprovante Pix"]),
      taxonomy: "/Financeiro/{ano-mês}/{tipo}/",
      dictionary: JSON.stringify([]),
      routingRules: JSON.stringify(["Toda NF → resumo mensal pro contador"]),
      confidenceThreshold: 95, sampleRate: 10, concordancia: 910,
    },
    {
      clienteId: 4, versao: 3,
      namingPattern: "AAAA-MM-{TIPO}-{PESSOA}-{ATIVIDADE}.pdf",
      docTypes: JSON.stringify(["Recibo diária", "Nota de insumo", "Doc de máquina", "Doc de terra"]),
      taxonomy: "/Safra/{ano}/{tipo}/",
      dictionary: JSON.stringify([{ termo: "seu Antônio", significado: "tratorista" }]),
      routingRules: JSON.stringify(["Recibo de diária → relatório de gente da semana"]),
      confidenceThreshold: 90, sampleRate: 5, concordancia: 980,
    },
  ]);

  // ── Organizadores ──
  await db.insert(organizadores).values([
    { id: 1, nome: "Nizan Jhon", papel: "Organizador · validação", validadosHoje: 187 },
    { id: 2, nome: "Pedro", papel: "Conferente", validadosHoje: 22 },
  ]);

  // ── Lotes ──
  await db.insert(lotes).values([
    {
      id: 1, numero: 482, clienteId: 1, titulo: "Notas e contratos da obra Litoral Plaza",
      canal: "whatsapp", qtdArquivos: 86, status: "em_validacao",
      solicitadoTexto: "“Organiza as notas e os contratos da obra Litoral Plaza e monta o resumo de custo por apartamento.”",
      escopoInclui: JSON.stringify(["Docs de obra", "Caixa de documentos", "+ resumo de custo por apto"]),
      escopoFora: JSON.stringify(["holerites/folha", "lançamento contábil", "assinatura/parecer"]),
      docsAjeitados: 79, tempoUsadoPct: 34,
      recebidoEm: new Date("2026-08-16T08:14:00"), prazoEm: new Date("2026-08-18T08:14:00"),
    },
    { id: 2, numero: 481, clienteId: 2, titulo: "Contratos de locação de agosto", canal: "drive", qtdArquivos: 54, status: "processando", solicitadoTexto: "“Organiza os contratos e laudos novos por imóvel.”", escopoInclui: JSON.stringify(["Caixa de documentos", "Solicitação de documentos"]), escopoFora: JSON.stringify(["parecer jurídico"]), docsAjeitados: 31, tempoUsadoPct: 22, recebidoEm: new Date("2026-08-15T16:40:00"), prazoEm: new Date("2026-08-19T16:40:00") },
    { id: 3, numero: 480, clienteId: 3, titulo: "Notas de fornecedor do mês", canal: "email", qtdArquivos: 230, status: "processando", solicitadoTexto: "“Junta as notas de julho e manda o resumo pro contador.”", escopoInclui: JSON.stringify(["Documentos de venda"]), escopoFora: JSON.stringify(["contabilidade"]), docsAjeitados: 96, tempoUsadoPct: 40, recebidoEm: new Date("2026-08-14T10:02:00"), prazoEm: new Date("2026-08-21T10:02:00") },
    { id: 4, numero: 479, clienteId: 1, titulo: "Orçamentos de acabamento", canal: "whatsapp", qtdArquivos: 22, status: "entregue", solicitadoTexto: "“Organiza os orçamentos de piso e tinta por fornecedor.”", escopoInclui: JSON.stringify(["Docs de obra"]), escopoFora: JSON.stringify(["negociação com fornecedor"]), docsAjeitados: 22, tempoUsadoPct: 100, recebidoEm: new Date("2026-08-12T09:00:00"), prazoEm: new Date("2026-08-14T09:00:00"), entregueEm: new Date("2026-08-13T15:30:00") },
    { id: 5, numero: 478, clienteId: 2, titulo: "Docs de inquilinos Ed. Solar", canal: "upload", qtdArquivos: 41, status: "aprovado", solicitadoTexto: "“Verifica e organiza a documentação dos 12 inquilinos.”", escopoInclui: JSON.stringify(["Solicitação de documentos"]), escopoFora: JSON.stringify(["análise de crédito"]), docsAjeitados: 41, tempoUsadoPct: 100, recebidoEm: new Date("2026-08-10T14:00:00"), prazoEm: new Date("2026-08-13T14:00:00"), entregueEm: new Date("2026-08-12T11:00:00") },
    { id: 6, numero: 477, clienteId: 4, titulo: "Diárias da colheita — semana 32", canal: "whatsapp", qtdArquivos: 118, status: "aprovado", solicitadoTexto: "“Organiza os recibos dos diaristas e me diz quanto foi cada dia.”", escopoInclui: JSON.stringify(["Documentos de pessoas"]), escopoFora: JSON.stringify(["folha de pagamento oficial"]), docsAjeitados: 118, tempoUsadoPct: 100, recebidoEm: new Date("2026-08-09T08:00:00"), prazoEm: new Date("2026-08-12T08:00:00"), entregueEm: new Date("2026-08-11T17:45:00") },
    { id: 7, numero: 476, clienteId: 3, titulo: "Comprovantes Pix — 1ª quinzena", canal: "drive", qtdArquivos: 96, status: "aprovado", solicitadoTexto: "“Junta os comprovantes e separa por fornecedor.”", escopoInclui: JSON.stringify(["Documentos de venda"]), escopoFora: JSON.stringify(["conciliação bancária"]), docsAjeitados: 96, tempoUsadoPct: 100, recebidoEm: new Date("2026-08-07T11:00:00"), prazoEm: new Date("2026-08-10T11:00:00"), entregueEm: new Date("2026-08-09T16:20:00") },
  ]);

  // ── Documentos do Lote #482 ──
  // 5 na fila de validação + 8 na trilha do portal (3 done, 1 doing, 4 todo)
  await db.insert(documentos).values([
    // fila de validação
    { id: 1, loteId: 1, nomeOriginal: "IMG_20260814_1432.jpg", nomeFinal: "2026-08-NF-MAT-GESSOPAR-LITORAL-R4280.pdf", tipo: "NF de material", origem: "WhatsApp · Pedro (mestre de obras)", confianca: 71, status: "validacao",
      pageLines: JSON.stringify(["GESSOPAR MATERIAIS LTDA · <hl>CNPJ 12.345.678/0001-90</hl>","NOTA FISCAL Nº <hl>8.412</hl> · <hl>14/08/2026</hl>","Gesso acartonado 42un · TOTAL <hlt>R$ 4.280,00</hlt>","Entrega: <hlt>Obra Litoral Plaza — apto 302</hlt>"]),
      metaRows: JSON.stringify([["Tipo","NF de material"],["Obra","Litoral Plaza"],["Valor","R$ 4.280,00"]]),
      duvida: "⚠ “Gessopar” ou “Gesso Pará”? Dicionário v7 tem os dois. E entra no resumo de custo do apto 302?" },
    { id: 2, loteId: 1, nomeOriginal: "WhatsApp Image 2026-08-13 at 17.52.jpeg", nomeFinal: "2026-08-DIARIO-OBRA-LITORAL-DIA13.pdf", tipo: "Diário de obra", origem: "WhatsApp · Pedro", confianca: 66, status: "validacao",
      pageLines: JSON.stringify(["DIÁRIO DE OBRA — LITORAL PLAZA","Dia <hl>13/08</hl> (ou 18?) · 14 pedreiros","Laje do 2º pavimento concretada ✓","Assinatura <hl>ilegível</hl>"]),
      metaRows: JSON.stringify([["Tipo","Diário de obra"],["Obra","Litoral Plaza"],["Data","13/08? (baixa certeza)"]]),
      duvida: "⚠ Data ambígua: “13” ou “18”? Cruzando com o diário anterior, 13/08 é o provável." },
    { id: 3, loteId: 1, nomeOriginal: "holerite antonio julho.pdf", nomeFinal: "(fora de escopo — pasta “_revisar” por enquanto)", tipo: "Holerite (fora do escopo)", origem: "E-mail · cliente", confianca: 88, status: "validacao",
      pageLines: JSON.stringify(["RECIBO DE PAGAMENTO — <hl>ANTÔNIO S.</hl>","Ref. <hl>07/2026</hl> · R$ 2.400,00","Função: pedreiro — Litoral Plaza"]),
      metaRows: JSON.stringify([["Tipo","Holerite (fora do escopo)"],["Pessoa","Antônio S."],["Valor","R$ 2.400,00"]]),
      duvida: "⚠ Confiança alta, MAS holerite é “docs de pessoas” — fora do escopo contratado. Guardar à parte e sugerir add-on." },
    { id: 4, loteId: 1, nomeOriginal: "nota 8413 torta.jpeg", nomeFinal: "(aguardando 2ª foto do mestre de obras)", tipo: "NF de material (provável)", origem: "WhatsApp · Pedro", confianca: 58, status: "validacao",
      pageLines: JSON.stringify(["Imagem torta ~30° · sombra no rodapé","Nº <hl>8.413</hl> · fornecedor ilegível","Total <hl>R$ 9?0,00</hl>"]),
      metaRows: JSON.stringify([["Tipo","NF de material (provável)"],["Legibilidade","58%"],["Valor","incerto"]]),
      duvida: "⚠ Abaixo de 0,75 em foto: regra v7 diz pedir 2ª foto antes de decidir." },
    { id: 5, loteId: 1, nomeOriginal: "contrato pedreiro FINAL final2.pdf", nomeFinal: "2026-08-CONTRATO-MO-JOSE-FERREIRA-LITORAL.pdf", tipo: "Contrato MO", origem: "Drive · pasta “contratos”", confianca: 81, status: "validacao",
      pageLines: JSON.stringify(["CONTRATO DE PRESTAÇÃO DE SERVIÇO","Contratante: <hl>Sol Nascente</hl>","Contratado: <hl>“Seu Zé”</hl> — José Ferreira MEI?","Vigência <hl>01/08 a 30/11/2026</hl>"]),
      metaRows: JSON.stringify([["Tipo","Contrato MO"],["Parte","José Ferreira MEI (dicionário v7)"],["Vigência","até 30/11/2026"]]),
      duvida: "⚠ “Seu Zé” = José Ferreira MEI (dicionário v7). Confirma? Se sim, gera alerta de vencimento p/ 30/11." },
    // trilha do portal (8 docs)
    { id: 6, loteId: 1, nomeOriginal: "IMG_20260814_1432.jpg", nomeFinal: "2026-08-NF-MAT-GESSOPAR-LITORAL-R4280.pdf", tipo: "NF material", origem: "WhatsApp", confianca: 97, status: "done" },
    { id: 7, loteId: 1, nomeOriginal: "doc (7).pdf", nomeFinal: "2026-08-MEDICAO-MAODBOBRA-LITORAL-PARCIAL2.pdf", tipo: "Medição", origem: "E-mail", confianca: 98, status: "done" },
    { id: 8, loteId: 1, nomeOriginal: "WhatsApp Image 2026-08-13 at 17.52.jpeg", nomeFinal: "2026-08-DIARIO-OBRA-LITORAL-DIA13.pdf", tipo: "Diário", origem: "WhatsApp", confianca: 66, status: "doing" },
    { id: 9, loteId: 1, nomeOriginal: "ART laje 2o pavimento.pdf", nomeFinal: "2026-08-ART-LAJE-PAV2-LITORAL.pdf", tipo: "ART", origem: "Drive", confianca: 99, status: "todo" },
    { id: 10, loteId: 1, nomeOriginal: "recibo ze agosto.jpeg", nomeFinal: "2026-08-RECIBO-MO-JOSE-FERREIRA-LITORAL.pdf", tipo: "Recibo MO", origem: "WhatsApp", confianca: 92, status: "todo" },
    { id: 11, loteId: 1, nomeOriginal: "contrato pedreiro FINAL final2.pdf", nomeFinal: "2026-08-CONTRATO-MO-ANTONIO-S-LITORAL.pdf", tipo: "Contrato", origem: "Drive", confianca: 90, status: "todo" },
    { id: 12, loteId: 1, nomeOriginal: "boleto condomínio.pdf", nomeFinal: "2026-08-BOLETO-COND-LITORAL-UN302.pdf", tipo: "Boleto", origem: "E-mail", confianca: 95, status: "todo" },
    { id: 13, loteId: 1, nomeOriginal: "orcamento tintas suvinil.pdf", nomeFinal: "2026-08-ORCAMENTO-TINTAS-SUVINIL-LITORAL.pdf", tipo: "Orçamento", origem: "Drive", confianca: 96, status: "todo" },
  ]);

  // ── Validações pendentes (HITL) ──
  await db.insert(validacoes).values([
    { documentoId: 1, motivo: "baixa_confianca" },
    { documentoId: 2, motivo: "baixa_confianca" },
    { documentoId: 3, motivo: "escopo" },
    { documentoId: 4, motivo: "baixa_confianca" },
    { documentoId: 5, motivo: "amostra" },
  ]);

  // ── Eventos iniciais (feed) ──
  await db.insert(eventos).values([
    { loteId: 1, ator: "bia", texto: "Triagem: <b>12 fotos</b> do WhatsApp classificadas (conf. média 0,94)" },
    { loteId: 1, ator: "sys", texto: "OCR concluído: <b>34 escaneados</b> · custo R$ 1,36" },
    { loteId: 1, ator: "lia", texto: "Índice: <b>apto 302</b> agora tem 9 documentos ligados" },
  ]);

  console.log("Seed completo: 4 clientes, 4 contextos, 7 lotes, 13 docs, 5 validações, 3 eventos.");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
