# Ajeita — BPO Híbrido de Documentos (v1)

> Agentes de IA fazem o volume. Humanos garantem o resultado.
> Console interno de operações + portal do cliente, full-stack.

**Produção:** https://ajeita.ia.br/ (Cloudflare) · origin http://134.209.115.177/ · **Stack:** React 19 + Vite + TypeScript + Tailwind + shadcn/ui · Hono + tRPC 11 + Drizzle ORM + MySQL 8

---

## Superfícies

| Rota | O que é |
|---|---|
| `/` (ou `/ops`) | **Console interno** — cartão do pedido (solicitado/prazo/escopo), KPIs vivos, stepper do pipeline, time de agentes + humano, log ao vivo (audit trail) e **fila de validação HITL interativa** |
| `/cliente/:numeroLote` | **Portal do cliente** — acompanhamento ao vivo do pedido, time trabalhando, feed, documentos sendo ajeitados, aprovação final ("só paga se aprovar"). Demo: `/cliente/482` |
| `/lotes` | Pipeline de lotes: KPIs do dia, filtros por status/cliente, tabela com progresso |
| `/clientes` | Clientes + **ContextProfile** (cérebro documental): padrão de nomeação, doc-types, dicionário, regras de roteamento, política de confiança, feedback-que-vira-regra |

## Arquitetura

```
React (src/)  ──tRPC──▶  Hono (api/)  ──Drizzle──▶  MySQL
     ▲                        │
     └──── polling 3s ────────┴── sim.tick (motor de simulação server-side)
```

- `db/schema.ts` — 7 tabelas: `clientes`, `context_profiles`, `lotes`, `documentos`, `validacoes`, `organizadores`, `eventos` (audit trail append-only)
- `api/queries/ops.ts` — regras de negócio (decidir validação → feedback + evento; fila zerada → pronto p/ entrega; entregar → notifica; aprovar → cobrança)
- `api/router.ts` — routers: `lotes`, `documentos`, `validacao`, `eventos`, `clientes`, `metricas`, `sim`
- `db/seed.ts` — Lote #482 (Construtora Sol Nascente) + 4 clientes + contextos + fila de validação

## Modo simulação vs. real

O pipeline de IA roda em **modo simulação** (OCR/LLM/WhatsApp simulados com latência e confiança realistas, dirigidos por `sim.tick`). Para ligar o modo real, implementar adapters com as envs: `KIMI_API_KEY` (LLM), OCR (Google Vision/Textract), WhatsApp (Evolution API). O estado, a fila, o feed e a aprovação já são 100% reais (MySQL).

## Desenvolvimento local

```bash
pnpm install
pnpm db:push        # precisa de DATABASE_URL no .env
npx tsx db/seed.ts  # popula o demo
pnpm dev            # http://localhost:3000
```

## Deploy (servidor de produção)

Servidor: Ubuntu 24.04 · Node 20 · pnpm 9 · MySQL 8 · nginx · systemd.

```bash
ssh root@134.209.115.177   # por chave (senha desabilitada)
/opt/ajeita/deploy.sh      # git pull + pnpm install + build + restart + healthcheck
```

- Código: `/opt/ajeita` (clone deste repo, branch `master`)
- Serviço: `systemctl status ajeita` · logs: `journalctl -u ajeita -f`
- Env: `/opt/ajeita/.env` (gitignored — `DATABASE_URL` de produção)
- Backup: `mysqldump` diário 03h17 em `/root/backups/` (retenção 14 dias)
- Firewall: UFW ativo (22/80/443)

## Pendências conhecidas

- [ ] HTTPS/domínio: apontar DNS `A` para `134.209.115.177` e rodar certbot/Caddy
- [ ] Auth no console ops (graft incremental: `--features auth`)
- [ ] Cadastro de novo lote pela UI (hoje: seed/SQL)
- [ ] npm no servidor tem bug ("exit handler never called") — por isso **pnpm** é o gestor oficial aqui
