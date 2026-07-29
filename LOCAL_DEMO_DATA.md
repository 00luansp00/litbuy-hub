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

Dentro da imagem, os equivalentes são `node dist/cli/demo-data.js seed`, `verify` e `reset --confirm`. O seed pode ser repetido: reutiliza IDs e object keys, restaura drift e não duplica registros. Objetos enviados antes de uma falha de banco podem permanecer, mas a próxima execução sobrescreve os mesmos nomes de forma segura. O verify confere contas, papéis, catálogo, imagens e objetos. O reset remove somente IDs reservados e objetos `demo/`, sem `TRUNCATE`, e pode ser repetido.

## Contas

| Papel         | E-mail                        |
| ------------- | ----------------------------- |
| comprador     | `comprador@demo.litbuy.local` |
| vendedor      | `vendedor@demo.litbuy.local`  |
| administrador | `admin@demo.litbuy.local`     |

Senha pública local: `LitBuyDemo2026!`. Ela é descartável e proibida fora desta demonstração.

Há três categorias (`demo-jogos`, `demo-gift-cards`, `demo-software`) e oito subcategorias. Seis produtos ativos são públicos: conta, gift card, moedas, licença e dois serviços. Os produtos `demo-produto-pausado` e `demo-produto-nao-publicado` são invisíveis. Todos os dados e imagens PNG são locais e fictícios.

## Erros comuns

- `DEMO_DATA_DISABLED`: use somente o env local de demonstração.
- `DEMO_DATA_DATABASE_REFUSED` / `DEMO_DATA_STORAGE_REFUSED`: confira os hosts e o nome do banco.
- `DEMO_DATA_NAMESPACE_CONFLICT`: um identificador reservado pertence a outro registro; não será sobrescrito.
- `DEMO_DATA_CONFIRMATION_REQUIRED`: acrescente `--confirm` ao reset.
- `DEMO_DATA_VERIFICATION_FAILED`: execute seed novamente e confira PostgreSQL e MinIO.
