import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Bell } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunicationPreferencesPanel } from "@/components/email/CommunicationPreferencesPanel";
import { EmailHistoryTable } from "@/components/email/EmailHistoryTable";
import { EmailSecurityNotice } from "@/components/email/EmailSecurityNotice";
import { TransactionalEmailEventList } from "@/components/email/TransactionalEmailEventList";
import { transactionalEmailService } from "@/services/transactionalEmailService";
import type {
  CommunicationPreference,
  EmailHistoryItem,
  TransactionalEmailEvent,
} from "@/types";

export const Route = createFileRoute("/perfil/preferencias")({
  loader: async () => {
    const [preferences, history, orderEvents, sellerEvents, adminEvents, securityEvents] =
      await Promise.all([
        transactionalEmailService.getUserCommunicationPreferences(),
        transactionalEmailService.getEmailHistory(),
        transactionalEmailService.getOrderEmailEvents(),
        transactionalEmailService.getSellerEmailEvents(),
        transactionalEmailService.getAdminEmailEvents(),
        transactionalEmailService.getSecurityEmailEvents(),
      ]);
    return { preferences, history, orderEvents, sellerEvents, adminEvents, securityEvents };
  },
  component: PreferenciasPage,
  head: () => ({
    meta: [
      { title: "Preferências de comunicação — LIT Buy" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Gerencie os canais e eventos de comunicação da sua conta." },
    ],
  }),
});

function PreferenciasPage() {
  const { preferences, history, orderEvents, sellerEvents, adminEvents } =
    Route.useLoaderData() as {
      preferences: CommunicationPreference[];
      history: EmailHistoryItem[];
      orderEvents: TransactionalEmailEvent[];
      sellerEvents: TransactionalEmailEvent[];
      adminEvents: TransactionalEmailEvent[];
    };
  const [tab, setTab] = useState("prefs");
  useEffect(() => {
    // no-op — analytics de visualização já são cobertos em rotas específicas
  }, []);

  return (
    <AuthGate>
      <AccountLayout
        title="Preferências de comunicação"
        description="Escolha como você quer receber notificações da LIT Buy."
      >
        <EmailSecurityNotice />

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="prefs">
              <Bell className="mr-1.5 h-4 w-4" /> Preferências
            </TabsTrigger>
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="history">
              <Mail className="mr-1.5 h-4 w-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prefs">
            <CommunicationPreferencesPanel initial={preferences} />
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <TransactionalEmailEventList title="Pedidos, pagamentos, entregas e mensagens" events={orderEvents} />
            <TransactionalEmailEventList title="Eventos do vendedor" events={sellerEvents} />
            <TransactionalEmailEventList title="Eventos administrativos" events={adminEvents} />
          </TabsContent>

          <TabsContent value="history">
            <EmailHistoryTable history={history} />
          </TabsContent>
        </Tabs>
      </AccountLayout>
    </AuthGate>
  );
}
