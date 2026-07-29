# Dados locais de demonstração

Esta fundação cria um conjunto **fictício, determinístico e descartável** no PostgreSQL e no bucket privado do MinIO locais. Ela nunca deve ser usada em produção e o frontend ainda não consome o catálogo público real.

## Proteções e pré-requisitos

Use Docker Desktop/Compose. O CLI exige `DEMO_DATA_ENABLED=true`, recusa `NODE_ENV=production`, banco sem `local`, `test` ou `demo`, hosts externos de PostgreSQL/MinIO e reset sem `--confirm`. O arquivo `backend/.env.staging.local.example` contém somente credenciais públicas e descartáveis da demonstração.

Suba a infraestrutura com `docker compose -f docker-compose.staging.yml --profile demo up -d postgres redis minio minio-init migrate backend`. As URLs locais padrão são API `http://localhost:13001/api/v1`, frontend `http://localhost:13000` e console MinIO `http://localhost:19001`.

## Uso

```bash
bun run demo:seed
bun run demo:verify
bun run demo:reset
```

Dentro da imagem, os equivalentes são `node dist/cli/demo-data.js seed`, `verify` e `reset --confirm`. O único ponto público do módulo executa o guard antes de criar clientes, portanto seed, verify e reset não possuem um caminho desprotegido. O seed pode ser repetido: reutiliza IDs e object keys, restaura drift (inclusive filhos inesperados) e não duplica registros.

Antes de reutilizar um objeto órfão, o seed compara content type, tamanho e SHA-256 com a imagem canônica. Conteúdo desconhecido causa `DEMO_DATA_NAMESPACE_CONFLICT` e nunca é sobrescrito. O verify usa o `PublicProductCatalogService` real, gera URLs assinadas, baixa os bytes e confirma que a leitura anônima é negada. O CI executa a suíte real e também seed/verify/seed/verify/reset/reset pelo serviço compilado do Compose.

O reset remove somente IDs reservados e object keys canônicas, sem `TRUNCATE`, e pode ser repetido. Ele remove sessões, dispositivos e desafios criados pelo uso real das contas antes de removê-las; `SecurityEvent` é preservado e suas relações opcionais são anuladas pelas constraints existentes. Registros e objetos externos permanecem intactos.

## Contas

| Papel         | E-mail                        |
| ------------- | ----------------------------- |
| comprador     | `comprador@demo.litbuy.local` |
| vendedor      | `vendedor@demo.litbuy.local`  |
| administrador | `admin@demo.litbuy.local`     |

Senha pública local: `LitBuyDemo2026!`. Ela é descartável e proibida fora desta demonstração.

Há três categorias (`demo-jogos`, `demo-gift-cards`, `demo-software`) e oito subcategorias. Seis produtos ativos são públicos: conta, gift card, moedas, licença e dois serviços. Os produtos `demo-produto-pausado` e `demo-produto-nao-publicado` são invisíveis. O produto de conta possui apenas metadados fictícios de procedência e recuperação, sem credenciais. Todos os dados são fictícios e cada produto possui um dos oito PNGs locais, pequenos, visualmente distintos e com hash determinístico.

## Erros comuns

- `DEMO_DATA_DISABLED`: use somente o env local de demonstração.
- `DEMO_DATA_DATABASE_REFUSED` / `DEMO_DATA_STORAGE_REFUSED`: confira os hosts e o nome do banco.
- `DEMO_DATA_NAMESPACE_CONFLICT`: um identificador reservado pertence a outro registro; não será sobrescrito.
- `DEMO_DATA_CONFIRMATION_REQUIRED`: acrescente `--confirm` ao reset.
- `DEMO_DATA_VERIFICATION_FAILED`: execute seed novamente e confira PostgreSQL e MinIO.
