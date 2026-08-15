/* Dados estáticos de fallback — verbatim dos arquivos de design
   (lotes.md / clientes.md). Usados quando a API tRPC falha e como
   "extras" editoriais (contagens, timeline, exemplos) que o banco ainda
   não versiona. A página nunca quebra: erro → estes dados. */

export type StatusBucket =
  | 'recebido'
  | 'processando'
  | 'em_validacao'
  | 'pronto_entrega'
  | 'entregue'
  | 'aprovado';

/** View-model único da linha da tabela de lotes (API e fallback convergem aqui). */
export type LoteVM = {
  id: number;
  numero: number;
  descricao: string; // "86 arq · obra Litoral Plaza"
  clienteNome: string;
  canalIcon: string;
  canalLabel: string;
  recebidoTxt: string;
  prazoTxt: string;
  prazoHint: string | null; // ex.: "31h" (laranja)
  progresso: number; // 0..100
  fila: number | null; // pill laranja de validação
  bucket: StatusBucket;
  responsavel: string | null; // 'NJ' | null
};

export const LOTES_FALLBACK: LoteVM[] = [
  {
    id: 1,
    numero: 482,
    descricao: '86 arq · obra Litoral Plaza',
    clienteNome: 'Construtora Sol Nascente',
    canalIcon: '🟢',
    canalLabel: 'WhatsApp',
    recebidoTxt: 'sáb 08h14',
    prazoTxt: 'seg 18/08 08h14',
    prazoHint: '31h',
    progresso: 63,
    fila: 5,
    bucket: 'em_validacao',
    responsavel: 'NJ',
  },
  {
    id: 2,
    numero: 481,
    descricao: '42 arq · contratos locação',
    clienteNome: 'Imobiliária Porta Boa',
    canalIcon: '✉',
    canalLabel: 'E-mail',
    recebidoTxt: 'sex 16h40',
    prazoTxt: 'entregue sáb 11h02',
    prazoHint: null,
    progresso: 100,
    fila: null,
    bucket: 'entregue',
    responsavel: 'NJ',
  },
  {
    id: 3,
    numero: 480,
    descricao: '118 arq · caixa de notas',
    clienteNome: 'Mercearia do Bairro',
    canalIcon: '📁',
    canalLabel: 'Drive',
    recebidoTxt: 'sex 14h22',
    prazoTxt: 'dom 17/08 14h22',
    prazoHint: '20h',
    progresso: 81,
    fila: 4,
    bucket: 'em_validacao',
    responsavel: 'NJ',
  },
  {
    id: 4,
    numero: 479,
    descricao: '23 arq · notas da fazenda',
    clienteNome: 'Sítio Boa Esperança',
    canalIcon: '🟢',
    canalLabel: 'WhatsApp',
    recebidoTxt: 'sáb 09h51',
    prazoTxt: 'seg 18/08 09h51',
    prazoHint: null,
    progresso: 22,
    fila: null,
    bucket: 'processando',
    responsavel: null,
  },
  {
    id: 5,
    numero: 478,
    descricao: '64 arq · 1ª quinzena ago',
    clienteNome: 'Construtora Sol Nascente',
    canalIcon: '🟢',
    canalLabel: 'WhatsApp',
    recebidoTxt: '01/08',
    prazoTxt: 'entregue 03/08',
    prazoHint: null,
    progresso: 100,
    fila: null,
    bucket: 'aprovado',
    responsavel: 'NJ',
  },
  {
    id: 6,
    numero: 477,
    descricao: '35 arq · recibos + boletos',
    clienteNome: 'Mercearia do Bairro',
    canalIcon: '✉',
    canalLabel: 'E-mail',
    recebidoTxt: '28/07',
    prazoTxt: 'entregue 29/07',
    prazoHint: null,
    progresso: 100,
    fila: null,
    bucket: 'aprovado',
    responsavel: 'NJ',
  },
  {
    id: 7,
    numero: 476,
    descricao: '51 arq · documentos de venda',
    clienteNome: 'Imobiliária Porta Boa',
    canalIcon: '📁',
    canalLabel: 'Drive',
    recebidoTxt: '25/07',
    prazoTxt: 'entregue 26/07',
    prazoHint: null,
    progresso: 100,
    fila: null,
    bucket: 'aprovado',
    responsavel: 'NJ',
  },
];

/* ---------- Clientes ---------- */

export type ClienteCard = {
  id: number;
  nome: string;
  cidade: string;
  segmento: string;
  iniciais: string;
  avatarBg: string;
  avatarFg: string;
};

export const CLIENTES_FALLBACK: ClienteCard[] = [
  { id: 1, nome: 'Construtora Sol Nascente', cidade: 'João Pessoa/PB', segmento: 'Construção', iniciais: 'SN', avatarBg: '#F5820D', avatarFg: '#FFFFFF' },
  { id: 2, nome: 'Imobiliária Porta Boa', cidade: 'Recife/PE', segmento: 'Imobiliária', iniciais: 'PB', avatarBg: '#2FC79E', avatarFg: '#FFFFFF' },
  { id: 3, nome: 'Mercearia do Bairro', cidade: 'Campina Grande/PB', segmento: 'Varejo', iniciais: 'MB', avatarBg: '#2E2721', avatarFg: '#FBF6EE' },
  { id: 4, nome: 'Sítio Boa Esperança', cidade: 'Caruaru/PE', segmento: 'Agro', iniciais: 'BE', avatarBg: '#6E5F4B', avatarFg: '#FBF6EE' },
];

/** Avatar de iniciais por cliente (cor canônica do design; hash p/ desconhecidos). */
export function clienteAvatar(nome: string): { iniciais: string; bg: string; fg: string } {
  const n = nome.toLowerCase();
  if (n.includes('sol nascente')) return { iniciais: 'SN', bg: '#F5820D', fg: '#FFFFFF' };
  if (n.includes('porta boa')) return { iniciais: 'PB', bg: '#2FC79E', fg: '#FFFFFF' };
  if (n.includes('mercearia')) return { iniciais: 'MB', bg: '#2E2721', fg: '#FBF6EE' };
  if (n.includes('boa esperança') || n.includes('sítio') || n.includes('sitio'))
    return { iniciais: 'BE', bg: '#6E5F4B', fg: '#FBF6EE' };
  const parts = nome.trim().split(/\s+/);
  const iniciais = ((parts[0]?.[0] ?? '?') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  const palette = ['#F5820D', '#2FC79E', '#2E2721', '#6E5F4B'];
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 997;
  return { iniciais, bg: palette[h % palette.length], fg: '#FBF6EE' };
}

/* ---------- Extras editoriais do ContextProfile (por cliente) ---------- */

export type TimelineItem = { versao: string; data: string; texto: string; atual?: boolean };

export type ClienteExtras = {
  versao: number;
  concordancia: number; // milésimos: 972 = 97,2%
  threshold: number; // 0-100
  sampleRate: number; // %
  ativoDesde: string;
  feedbacks: number;
  namingPattern: string | null; // null = em construção
  docTypes: string[];
  docCounts: Record<string, number>; // palavra-chave (minúscula) → contagem do mês
  foraEscopo: string | null;
  taxonomyTree: string[] | null;
  taxonomyText: string;
  dictionary: { termo: string; significado: string; origem?: string }[];
  routingRules: string[];
  example: { from: string; to: string } | null;
  thresholdNote: string;
  sampleNote: string;
  contextoJovem: string | null;
  timeline: TimelineItem[];
};

export const CLIENTE_EXTRAS: ClienteExtras[] = [
  {
    versao: 7,
    concordancia: 972,
    threshold: 90,
    sampleRate: 5,
    ativoDesde: '03/07/2026',
    feedbacks: 41,
    namingPattern: 'AAAA-MM-{TIPO}-{FORNECEDOR}-{OBRA}-{VALOR}.pdf',
    docTypes: ['NF de material', 'Medição', 'ART', 'Diário de obra', 'Contrato MO', 'Recibo', 'Registro de obra (foto)'],
    docCounts: { nf: 214, 'medição': 38, art: 12, 'diário': 57, contrato: 23, recibo: 96, registro: 141 },
    foraEscopo: 'holerite — fora do escopo (skill não contratada)',
    taxonomyTree: [
      '/Obras/Litoral-Plaza/',
      '  ├─ notas-fiscais/2026-08/',
      '  ├─ medições/',
      '  ├─ diários/',
      '  ├─ contratos/',
      '  └─ _revisar/   ← fora de escopo e dúvidas',
    ],
    taxonomyText: '/Obras/{nome-da-obra}/{tipo}/{ano-mês}/ — obra atual: Litoral Plaza',
    dictionary: [
      { termo: 'Seu Zé', significado: 'José Ferreira MEI', origem: 'aprendido na validação · v5' },
      { termo: 'obra do shopping', significado: 'Litoral Plaza', origem: 'setup inicial · v1' },
      { termo: 'Gessopar / Gesso Pará', significado: 'Gessopar Materiais Ltda', origem: 'ambiguidade resolvida · v7' },
      { termo: 'nota do gesso', significado: 'NF material · fornecedor Gessopar', origem: 'busca do cliente · v6' },
    ],
    routingRules: [
      'NF de obra → pasta da obra + soma no resumo de custo do apto',
      'Contrato MO → contratos/ + alerta de vencimento D-10',
      'Foto de fachada → registro de obra',
      'confiança < 0,75 em foto → pedir 2ª foto antes de decidir',
    ],
    example: { from: 'IMG_20260814_1432.jpg', to: '2026-08-NF-MAT-GESSOPAR-LITORAL-R4280.pdf' },
    thresholdNote: 'começou em 0,95 · desce conforme a IA acerta',
    sampleNote: 'começou em 10% · piso 2% · Pedro revisa mesmo com confiança alta',
    contextoJovem: null,
    timeline: [
      { versao: 'v7', data: '14/08', texto: 'correção do holerite → regra "docs de pessoas = fora de escopo, guardar em _revisar + sugerir add-on"', atual: true },
      { versao: 'v6', data: '09/08', texto: 'busca "nota do gesso" virou sinônimo de NF Gessopar' },
      { versao: 'v5', data: '02/08', texto: '"Seu Zé" mapeado para José Ferreira MEI' },
      { versao: 'v4', data: '26/07', texto: 'threshold 0,95 → 0,92 (concordância sustentada > 96%)' },
      { versao: 'v1', data: '03/07', texto: 'setup inicial (R$ 490 · 3h com o cliente)' },
    ],
  },
  {
    versao: 4,
    concordancia: 958,
    threshold: 92,
    sampleRate: 5,
    ativoDesde: '10/07/2026',
    feedbacks: 18,
    namingPattern: 'AAAA-MM-{TIPO}-{IMOVEL}-{PARTE}.pdf',
    docTypes: ['Contrato de locação', 'Vistoria', 'Recibo de aluguel', 'IPTU', 'Boleto'],
    docCounts: {},
    foraEscopo: null,
    taxonomyTree: null,
    taxonomyText: '/Imóveis/{código-imovel}/{tipo}/',
    dictionary: [
      { termo: 'prédio da beira-mar', significado: 'Ed. Mar de Boa Viagem', origem: 'aprendido na validação · v3' },
    ],
    routingRules: ['Vistoria → pasta do imóvel + alerta de revisão anual'],
    example: null,
    thresholdNote: 'estável desde a v3 · concordância sustentada',
    sampleNote: 'Pedro revisa mesmo com confiança alta',
    contextoJovem: null,
    timeline: [
      { versao: 'v4', data: '28/07', texto: 'vistoria passou a gerar alerta de revisão anual do imóvel', atual: true },
      { versao: 'v3', data: '19/07', texto: '"prédio da beira-mar" mapeado para Ed. Mar de Boa Viagem' },
      { versao: 'v1', data: '10/07', texto: 'setup inicial (R$ 490 · 2h com o cliente)' },
    ],
  },
  {
    versao: 5,
    concordancia: 964,
    threshold: 90,
    sampleRate: 8,
    ativoDesde: '17/07/2026',
    feedbacks: 12,
    namingPattern: 'AAAA-MM-{TIPO}-{FORNECEDOR}-{VALOR}.pdf',
    docTypes: ['NF de compra', 'Boleto fornecedor', 'Recibo', 'Nota de venda (resumo)'],
    docCounts: {},
    foraEscopo: null,
    taxonomyTree: null,
    taxonomyText: '/Financeiro/{ano-mês}/{tipo}/',
    dictionary: [
      { termo: 'o açougue', significado: 'Frigorífico Boi Bom', origem: 'aprendido na validação · v4' },
    ],
    routingRules: ['Boleto → alerta de vencimento D-3'],
    example: null,
    thresholdNote: 'padrão do plano · sobe quando a concordância sustentar',
    sampleNote: 'amostra maior enquanto o dicionário cresce',
    contextoJovem: null,
    timeline: [
      { versao: 'v5', data: '08/08', texto: 'boleto passou a gerar alerta de vencimento D-3 (2 atrasos em julho)', atual: true },
      { versao: 'v4', data: '30/07', texto: '"o açougue" mapeado para Frigorífico Boi Bom' },
      { versao: 'v1', data: '17/07', texto: 'setup inicial (R$ 490 · 2h com o cliente)' },
    ],
  },
  {
    versao: 2,
    concordancia: 910,
    threshold: 95,
    sampleRate: 10,
    ativoDesde: '05/08/2026',
    feedbacks: 3,
    namingPattern: null,
    docTypes: ['Nota de insumo', 'Nota de defensivo', 'Recibo de diária', 'Comprovante'],
    docCounts: {},
    foraEscopo: null,
    taxonomyTree: null,
    taxonomyText: '/Safra/{ano}/{tipo}/',
    dictionary: [],
    routingRules: ['Recibo de diária → relatório de gente da semana'],
    example: null,
    thresholdNote: 'contexto jovem — começa conservador em 0,95',
    sampleNote: 'amostra 10% — IA ainda aprendendo os fornecedores',
    contextoJovem: 'amostra 10% — IA ainda aprendendo os fornecedores',
    timeline: [
      { versao: 'v2', data: '12/08', texto: 'primeiros fornecedores recorrentes entraram no dicionário', atual: true },
      { versao: 'v1', data: '05/08', texto: 'setup inicial (R$ 490 · 4h com o cliente)' },
    ],
  },
];

/** Casa os extras pelo id do cliente (seed) ou pelo nome. */
export function extrasDoCliente(id: number, nome: string): ClienteExtras {
  const byId = CLIENTE_EXTRAS[id - 1];
  if (byId && id >= 1 && id <= CLIENTE_EXTRAS.length) return byId;
  const n = nome.toLowerCase();
  if (n.includes('sol nascente')) return CLIENTE_EXTRAS[0];
  if (n.includes('porta boa')) return CLIENTE_EXTRAS[1];
  if (n.includes('mercearia')) return CLIENTE_EXTRAS[2];
  return CLIENTE_EXTRAS[3];
}

/* ---------- helpers de formato ---------- */

/** Milésimos → "97,2%". */
export function fmtConcordancia(milesimos: number): string {
  return `${(milesimos / 10).toFixed(1).replace('.', ',')}%`;
}

/** 0-100 → "0,90". */
export function fmtThreshold(v: number): string {
  return (v / 100).toFixed(2).replace('.', ',');
}
