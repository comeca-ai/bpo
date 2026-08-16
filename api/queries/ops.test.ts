import { describe, expect, it } from "vitest";
import { agentesPorVolume, estruturarProposta, faixaPreco } from "./ops";

describe("agentesPorVolume", () => {
  it("mapeia volume para agentes", () => {
    expect(agentesPorVolume(0)).toBe(2); // não mencionado
    expect(agentesPorVolume(300)).toBe(1);
    expect(agentesPorVolume(500)).toBe(1);
    expect(agentesPorVolume(501)).toBe(2);
    expect(agentesPorVolume(2000)).toBe(2);
    expect(agentesPorVolume(5000)).toBe(3);
    expect(agentesPorVolume(10000)).toBe(4);
    expect(agentesPorVolume(15000)).toBe(5);
  });
});

describe("estruturarProposta — proposta com faixa de preço", () => {
  it("860 docs em 48h → 2 agentes, faixa base ×1.45", () => {
    const c = estruturarProposta("tenho 860 notas fiscais e contratos pra organizar", false);
    expect(c.agentesSugeridos).toBe(2);
    expect(c.skillsDetectadas).toBe(2); // notas + contratos
    // base = 230 + 2*300 + 2*160 = 1150
    expect(c.precoPiso).toBe(1150);
    expect(c.precoTeto).toBe(Math.round(1150 * 1.45));
    expect(c.motivoPreco).toContain("860 docs");
  });

  it("até 500 docs → 1 agente", () => {
    const c = estruturarProposta("tenho 86 notas fiscais pra organizar", false);
    expect(c.agentesSugeridos).toBe(1);
  });

  it("SLA urgente (24h) amplia o teto para ×1.75", () => {
    const c = estruturarProposta("preciso disso urgente, umas 300 notas", false);
    expect(c.sla).toBe("entrega em 24h (urgente)");
    expect(c.agentesSugeridos).toBe(1);
    // base = 230 + 300 + 160 = 690
    expect(c.precoPiso).toBe(690);
    expect(c.precoTeto).toBe(Math.round(690 * 1.75));
  });

  it("sem volume mencionado → 2 agentes e teto ×1.6 (mais incerteza)", () => {
    const c = estruturarProposta("organiza meus contratos e boletos", false);
    expect(c.agentesSugeridos).toBe(2);
    expect(c.skillsDetectadas).toBe(2);
    // base = 230 + 600 + 320 = 1150
    expect(c.precoPiso).toBe(1150);
    expect(c.precoTeto).toBe(Math.round(1150 * 1.6));
  });

  it("áudio sem texto → estrutura genérica, 2 agentes, faixa 830–1490", () => {
    const c = estruturarProposta("", true);
    expect(c.agentesSugeridos).toBe(2);
    expect(c.precoPiso).toBe(830);
    expect(c.precoTeto).toBe(1490);
    expect(c.motivoPreco).toContain("transcrever");
  });

  it("skillsDetectadas nunca é menor que 1", () => {
    const c = estruturarProposta("organiza minha papelada", false);
    expect(c.skillsDetectadas).toBeGreaterThanOrEqual(1);
  });
});

describe("faixaPreco", () => {
  it("fórmula base e multiplicadores", () => {
    expect(faixaPreco(2, 1, "entrega em 48h", 86)).toEqual({
      piso: 990,
      teto: Math.round(990 * 1.45),
    });
    expect(faixaPreco(2, 1, "entrega em 24h (urgente)", 86).teto).toBe(Math.round(990 * 1.75));
    expect(faixaPreco(2, 1, "entrega em 48h", 0).teto).toBe(Math.round(990 * 1.6));
  });
});
