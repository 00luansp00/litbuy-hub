# MOCKS_INVENTORY.md — LIT Buy

Inventário de tudo que é mockado no MVP.
Criticidade: **baixa / média / alta / crítica**.

## 1. Autenticação
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Login | crítica | Auth real (Supabase Auth) |
| Cadastro | crítica | Verificação de e-mail + captcha |
| Recuperação de senha | crítica | Token seguro + expiração |
| Admin | crítica | RBAC + RLS |
| activeRole (buyer/seller) | média | Sessão + claims |
| Verificação de novo dispositivo | alta | Device fingerprint + código |

## 2. Marketplace
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Produtos | alta | Tabela `products` + validação |
| Categorias / subcategorias | média | CMS admin |
| Vendedores | alta | `sellers` + perfil público |
| Reviews | média | Moderação server-side |
| Estoque | crítica | Reserva atômica no backend |
| Status do anúncio | alta | Máquina de estados server-side |
| Variações | alta | `product_variants` |
| Perguntas públicas | média | Moderação + notificação |

## 3. Carrinho / Checkout
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Carrinho | crítica | Cart server-side, preço recalculado |
| Cupom | alta | Ledger de cupons + antifraude |
| Proteção LIT | crítica | Cálculo server-side |
| Pix | crítica | Gateway (Stripe/PagBank/MP) |
| Boleto | crítica | Gateway |
| Cartão demo | crítica | Tokenização + PCI |
| Saldo LIT | crítica | Wallet real (ledger) |
| LIT Points | crítica | Ledger de pontos |

## 4. Pedidos
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Pedido | crítica | `orders` + auditoria |
| Timeline | alta | Máquina de estados |
| Pagamento | crítica | Webhook gateway |
| Entrega manual | alta | Anexos assinados |
| Entrega automática (cofre) | crítica | Storage seguro + auditoria |
| Chat do pedido | alta | Realtime + moderação |
| Mediação | crítica | Workflow admin + SLA |
| Saldo retido | crítica | Escrow real |

## 5. Vendedor
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Anúncios | alta | CRUD + aprovação |
| Vendas | crítica | Escrow |
| Financeiro | crítica | Contabilidade |
| Avaliações | média | Moderação |
| Equipe | alta | RBAC vendedor |
| LIT-MAX | média | Cálculo periódico |
| Cofre Seguro | crítica | Storage + auditoria |

## 6. Admin
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Usuários | crítica | RBAC + audit |
| Permissões | crítica | RBAC + RLS |
| Denúncias | crítica | Fila + workflow |
| Disputas | crítica | Workflow + SLA |
| Auditoria | crítica | Logs imutáveis |
| Relatórios | alta | BI real |
| Configurações | alta | Feature flags |
| Feature flags | média | Serviço dedicado |

## 7. Segurança
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| KYC | crítica | Idwall / Unico / Jumio |
| SMS | crítica | Twilio / Zenvia |
| Documento | crítica | OCR + verificação |
| Selfie | crítica | Liveness |
| Novo dispositivo | alta | Device fingerprint |
| E-mail transacional | alta | Resend / SendGrid / SES |
| Denúncia | crítica | Fila + evidências assinadas |
| Moderação | alta | Fila + regras + IA opcional |

## 8. Afiliados
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Link de afiliado | alta | Tracking real |
| Tracking | crítica | Atribuição + antifraude |
| Comissão | crítica | Ledger financeiro |
| Saque | crítica | KYC + gateway |
| Campanhas | média | CMS admin |

## 9. Notificações / e-mails
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| notificationService | alta | Fila + push + realtime |
| transactionalEmailService | alta | Provedor real |
| Templates | média | CMS + versionamento |
| Histórico | média | Persistência + retenção |
| Preferências | alta | `email_preferences` |

## 10. Páginas públicas
| Item | Criticidade | Backend futuro |
| --- | --- | --- |
| Conteúdo institucional | média | CMS |
| Termos | crítica | Revisão jurídica |
| Privacidade / LGPD | crítica | Revisão jurídica + DPO |
| Regras | alta | CMS + versão |
| Contato | média | Backend + anti-spam |

## Convenção final

- Tudo listado acima é **visual/mockado**.
- Nenhum dado real deve ser inserido enquanto backend não existir.
- Todo item marcado **crítica** exige desenvolvedor sênior + revisão
  de segurança antes de produção.
