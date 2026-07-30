# Runbook da fundação pública local

## O que este ambiente representa

Esta é uma simulação local, não produção. Os dados são fictícios. Home, categoria e detalhe consultam o backend local real; busca, loja e comércio continuam demonstrativos. Nunca insira dados pessoais ou financeiros reais.

## Pré-requisitos

Abra o repositório na pasta `litbuy-hub`, inicie o Docker Desktop e tenha Docker Compose e Bun instalados. As portas `13000`, `13001`, `15432`, `16379`, `19000` e `19001` precisam estar livres.

## Verificação inicial

```bash
docker version
docker compose version
bun --version
```

Cada comando deve mostrar uma versão sem erro. Pare se Docker não responder ou algum comando não existir.

## Preparação completa

```bash
bun install --frozen-lockfile
bun run demo:prepare
```

A primeira execução pode baixar imagens e construir containers. Aguarde o resumo com `"ok": true`; o ambiente permanece ligado.

## URLs

```text
Frontend: http://localhost:13000
API: http://localhost:13001/api/v1
Health: http://localhost:13001/api/v1/health/ready
MinIO Console: http://localhost:19001
```

## Contas fictícias

`comprador@demo.litbuy.local`, `vendedor@demo.litbuy.local` e `admin@demo.litbuy.local`, todas com senha `LitBuyDemo2026!`. São credenciais públicas, fictícias, exclusivamente locais e proibidas em produção.

## Páginas para conferir

- `http://localhost:13000/`: anúncios recentes públicos.
- `http://localhost:13000/categoria/demo-jogos`: categoria, subcategorias e produtos públicos.
- `http://localhost:13000/produto/demo-conta-jogo`: conta com galeria e dados do anúncio.
- `http://localhost:13000/produto/demo-moedas-virtuais`: moedas e variações.
- `http://localhost:13000/produto/demo-servico-acompanhamento`: serviço de acompanhamento.
- `http://localhost:13000/produto/demo-servico-personalizado`: serviço personalizado.

## Operação

Verificar novamente (não altera dados): `bun run demo:check`. Consultar containers: `bun run demo:status`. Ver os últimos logs: `bun run demo:logs`. Remover somente os dados reservados: `bun run demo:reset`. Parar sem apagar volumes: `bun run demo:down`. Para reiniciar:

```bash
bun run demo:up
bun run demo:check
```

## Erros comuns

- **Docker não iniciado:** abra o Docker Desktop e repita a verificação inicial.
- **Porta ocupada:** encerre o programa que usa a porta indicada; não altere para um host remoto.
- **Health não pronto ou falha de build:** rode `bun run demo:status` e `bun run demo:logs`.
- **Falha de seed/verify:** confirme que executou `demo:prepare`; para dados antigos divergentes, rode `demo:reset` e depois `demo:prepare`.
- **Imagem assinada falha:** confirme MinIO saudável no status e colete logs.
- **Frontend abre, catálogo falha:** confira o health da API e os logs de `backend` e `frontend`.
- Ao compartilhar logs, revise e remova tokens, cookies, URLs assinadas, connection strings e qualquer secret. Nunca publique `.env`.

## Windows

Use PowerShell, abra o Docker Desktop antes de começar e execute os mesmos comandos na pasta do projeto. O orquestrador não exige sintaxe específica de Bash.

## Observações sobre a verificação

`demo:check` também valida CORS e a infraestrutura local, usando a API na porta `13001` e o frontend na `13000`. Não é necessário instalar `curl`: os health checks usam o `fetch` nativo do Bun. `PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED` significa que algum alvo configurado não é estritamente loopback local ou possui URL/porta/path inválido. O resumo do modo CI descreve sua execução descartável após dois resets; não representa dados persistentes do ambiente local.
