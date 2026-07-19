ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_CATEGORY_CREATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_CATEGORY_UPDATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_CATEGORY_STATUS_CHANGED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_SUBCATEGORY_CREATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_SUBCATEGORY_UPDATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_SUBCATEGORY_STATUS_CHANGED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_ATTRIBUTE_CREATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_ATTRIBUTE_UPDATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CATALOG_ATTRIBUTE_STATUS_CHANGED';
CREATE TYPE "CatalogEntityStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "CatalogProductType" AS ENUM ('ACCOUNT','VIRTUAL_CURRENCY','GIFT_CARD','KEY','SKIN','ITEM','SERVICE','SUBSCRIPTION','GAME','SOFTWARE','OTHER');
CREATE TYPE "CatalogAttributeInputType" AS ENUM ('TEXT','NUMBER','SELECT','BOOLEAN');

CREATE TABLE "CatalogCategory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "slug" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
  "description" TEXT, "iconKey" TEXT, "colorHex" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "featured" BOOLEAN NOT NULL DEFAULT false, "status" "CatalogEntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CatalogSubcategory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "categoryId" UUID NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "status" "CatalogEntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CatalogSubcategory_categoryId_slug_key" UNIQUE ("categoryId","slug")
);
CREATE TABLE "CatalogAttribute" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "subcategoryId" UUID, "productType" "CatalogProductType", "key" TEXT NOT NULL, "label" TEXT NOT NULL,
  "inputType" "CatalogAttributeInputType" NOT NULL, "placeholder" TEXT, "required" BOOLEAN NOT NULL DEFAULT false, "selectOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "status" "CatalogEntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogAttribute_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "CatalogSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CatalogAttribute_scope_xor" CHECK ((("subcategoryId" IS NOT NULL)::int + ("productType" IS NOT NULL)::int) = 1)
);
CREATE INDEX "CatalogCategory_status_sortOrder_idx" ON "CatalogCategory"("status","sortOrder");
CREATE INDEX "CatalogCategory_featured_status_sortOrder_idx" ON "CatalogCategory"("featured","status","sortOrder");
CREATE INDEX "CatalogSubcategory_categoryId_status_sortOrder_idx" ON "CatalogSubcategory"("categoryId","status","sortOrder");
CREATE INDEX "CatalogAttribute_subcategoryId_status_sortOrder_idx" ON "CatalogAttribute"("subcategoryId","status","sortOrder");
CREATE INDEX "CatalogAttribute_productType_status_sortOrder_idx" ON "CatalogAttribute"("productType","status","sortOrder");
CREATE UNIQUE INDEX "CatalogAttribute_subcategory_key_unique" ON "CatalogAttribute"("subcategoryId","key") WHERE "subcategoryId" IS NOT NULL;
CREATE UNIQUE INDEX "CatalogAttribute_product_type_key_unique" ON "CatalogAttribute"("productType","key") WHERE "productType" IS NOT NULL;

INSERT INTO "CatalogCategory" ("id","slug","name","description","iconKey","colorHex","sortOrder","featured") VALUES
('00000000-0000-4000-8000-000000000001','contas','Contas','Contas prontas para diversos jogos e plataformas.','UserCircle2','#8B5CF6',1,true),
('00000000-0000-4000-8000-000000000002','gift-cards','Gift Cards','Códigos digitais para as principais lojas do mundo.','Gift','#EC4899',2,true),
('00000000-0000-4000-8000-000000000003','moedas','Moedas','Moedas virtuais com entrega rápida e segura.','Coins','#F59E0B',3,true),
('00000000-0000-4000-8000-000000000004','skins','Skins','Skins raras e cosméticos para os seus jogos favoritos.','Sparkles','#06B6D4',4,true),
('00000000-0000-4000-8000-000000000005','itens','Itens','Itens in-game, drops e coleções exclusivas.','Package','#22C55E',5,false),
('00000000-0000-4000-8000-000000000006','servicos','Serviços','Serviços profissionais para vitaminar sua jornada.','Wrench','#3B82F6',6,false),
('00000000-0000-4000-8000-000000000007','boost','Boost','Boost de rank, XP e conquistas realizado por PROs.','Rocket','#EF4444',7,false),
('00000000-0000-4000-8000-000000000008','assinaturas','Assinaturas','Game Pass, PS Plus e demais assinaturas premium.','BadgeCheck','#14B8A6',8,false),
('00000000-0000-4000-8000-000000000009','software','Software','Licenças originais de software e produtividade.','MonitorSmartphone','#6366F1',9,false),
('00000000-0000-4000-8000-000000000010','jogos','Jogos','Chaves originais para PC e consoles.','Gamepad2','#A855F7',10,false),
('00000000-0000-4000-8000-000000000011','streaming','Streaming','Assinaturas de streaming de vídeo, música e cloud.','Play','#F43F5E',11,false),
('00000000-0000-4000-8000-000000000012','outros','Outros','Tudo o que não cabe em uma categoria só.','LayoutGrid','#64748B',12,false)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CatalogSubcategory" ("id","categoryId","slug","name","sortOrder") VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','free-fire','Free Fire',1),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','league-of-legends','League of Legends',2),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','valorant','Valorant',3),
('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000001','roblox','Roblox',4),
('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000001','fortnite','Fortnite',5),
('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000001','minecraft','Minecraft',6),
('00000000-0000-4000-8000-000000000107','00000000-0000-4000-8000-000000000001','outros-contas','Outros',7),
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000002','steam','Steam',8),
('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000002','playstation','PlayStation',9),
('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000002','xbox','Xbox',10),
('00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000002','google-play','Google Play',11),
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000003','gold-wow','Gold (WoW)',12),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000003','riot-points','Riot Points',13),
('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000003','diamantes-ff','Diamantes Free Fire',14),
('00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000003','robux','Robux',15),
('00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000003','v-bucks','V-Bucks',16),
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000004','skins-valorant','Skins Valorant',17),
('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000004','skins-cs2','Skins CS2',18),
('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000004','skins-lol','Skins League of Legends',19),
('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000006','boost-elo','Boost de Elo',20),
('00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000006','coaching','Coaching',21),
('00000000-0000-4000-8000-000000000603','00000000-0000-4000-8000-000000000006','farm','Farm',22)
ON CONFLICT ("categoryId","slug") DO NOTHING;

INSERT INTO "CatalogAttribute" ("id","subcategoryId","productType","key","label","inputType","placeholder","selectOptions","sortOrder") VALUES
('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000102',NULL,'elo','Elo','SELECT',NULL,ARRAY['Ferro','Bronze','Prata','Ouro','Platina','Esmeralda','Diamante','Mestre','Grão-Mestre','Desafiante']::TEXT[],1),
('00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000102',NULL,'servidor','Servidor','SELECT',NULL,ARRAY['BR','LAN','NA','EUW','KR']::TEXT[],2),
('00000000-0000-4000-8000-000000001003','00000000-0000-4000-8000-000000000102',NULL,'skins','Quantidade de skins','NUMBER','0',ARRAY[]::TEXT[],3),
('00000000-0000-4000-8000-000000001004','00000000-0000-4000-8000-000000000102',NULL,'essencias','Essências','NUMBER','0',ARRAY[]::TEXT[],4),
('00000000-0000-4000-8000-000000001005','00000000-0000-4000-8000-000000000102',NULL,'campeoes','Campeões','NUMBER','0',ARRAY[]::TEXT[],5),
('00000000-0000-4000-8000-000000001006','00000000-0000-4000-8000-000000000102',NULL,'nivel','Nível da conta','NUMBER','0',ARRAY[]::TEXT[],6),
('00000000-0000-4000-8000-000000001011','00000000-0000-4000-8000-000000000103',NULL,'elo','Elo','SELECT',NULL,ARRAY['Ferro','Bronze','Prata','Ouro','Platina','Diamante','Ascendente','Imortal','Radiante']::TEXT[],1),
('00000000-0000-4000-8000-000000001012','00000000-0000-4000-8000-000000000103',NULL,'servidor','Servidor','SELECT',NULL,ARRAY['BR','LATAM','NA','EU']::TEXT[],2),
('00000000-0000-4000-8000-000000001013','00000000-0000-4000-8000-000000000103',NULL,'agentes','Agentes desbloqueados','NUMBER','0',ARRAY[]::TEXT[],3),
('00000000-0000-4000-8000-000000001014','00000000-0000-4000-8000-000000000103',NULL,'skins_raras','Skins raras','NUMBER','0',ARRAY[]::TEXT[],4),
('00000000-0000-4000-8000-000000001015','00000000-0000-4000-8000-000000000103',NULL,'vp','Pontos Valorant (VP)','NUMBER','0',ARRAY[]::TEXT[],5),
('00000000-0000-4000-8000-000000001016','00000000-0000-4000-8000-000000000103',NULL,'nivel','Nível da conta','NUMBER','0',ARRAY[]::TEXT[],6),
('00000000-0000-4000-8000-000000001021','00000000-0000-4000-8000-000000000101',NULL,'level','Level','NUMBER','0',ARRAY[]::TEXT[],1),
('00000000-0000-4000-8000-000000001022','00000000-0000-4000-8000-000000000101',NULL,'diamantes','Diamantes','NUMBER','0',ARRAY[]::TEXT[],2),
('00000000-0000-4000-8000-000000001023','00000000-0000-4000-8000-000000000101',NULL,'skins_raras','Skins raras','NUMBER','0',ARRAY[]::TEXT[],3),
('00000000-0000-4000-8000-000000001024','00000000-0000-4000-8000-000000000101',NULL,'personagens','Personagens','NUMBER','0',ARRAY[]::TEXT[],4),
('00000000-0000-4000-8000-000000001025','00000000-0000-4000-8000-000000000101',NULL,'regiao','Região','TEXT','Ex.: Brasil',ARRAY[]::TEXT[],5),
('00000000-0000-4000-8000-000000001026','00000000-0000-4000-8000-000000000101',NULL,'vinculacao','Vinculação da conta','SELECT',NULL,ARRAY['Facebook','Google','VK','Convidado']::TEXT[],6),
('00000000-0000-4000-8000-000000001031',NULL,'VIRTUAL_CURRENCY','jogo','Jogo','TEXT','Ex.: WoW',ARRAY[]::TEXT[],1),
('00000000-0000-4000-8000-000000001032',NULL,'VIRTUAL_CURRENCY','servidor','Servidor','TEXT','Ex.: Azralon',ARRAY[]::TEXT[],2),
('00000000-0000-4000-8000-000000001033',NULL,'VIRTUAL_CURRENCY','quantidade','Quantidade disponível','NUMBER','0',ARRAY[]::TEXT[],3),
('00000000-0000-4000-8000-000000001034',NULL,'VIRTUAL_CURRENCY','preco_unidade','Preço por unidade (BRL)','NUMBER','0,00',ARRAY[]::TEXT[],4),
('00000000-0000-4000-8000-000000001035',NULL,'VIRTUAL_CURRENCY','compra_minima','Quantidade mínima','NUMBER','1',ARRAY[]::TEXT[],5)
ON CONFLICT DO NOTHING;
