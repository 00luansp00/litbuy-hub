import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoPageLayout, InfoSection, ContactCard } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { ContactFormPayload, ContactOption } from "@/types";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — LIT Buy" },
      { name: "description", content: "Canais de contato demonstrativos da LIT Buy: compradores, vendedores, segurança e parcerias." },
      { property: "og:title", content: "Contato — LIT Buy" },
      { property: "og:description", content: "Fale com a LIT Buy — canais visuais e formulário demonstrativo." },
    ],
  }),
  component: ContatoPage,
});

const CATEGORIES = [
  { value: "compras", label: "Suporte a compras" },
  { value: "vendas", label: "Suporte a vendedores" },
  { value: "seguranca", label: "Segurança e denúncias" },
  { value: "parcerias", label: "Parcerias e afiliados" },
  { value: "outro", label: "Outro assunto" },
];

function ContatoPage() {
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [form, setForm] = useState<ContactFormPayload>({
    name: "", email: "", subject: "", category: "compras", message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { void infoService.getContactOptions().then(setOptions); }, []);

  const disabled = !form.name || !form.email || !form.subject || !form.message || submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    try {
      await infoService.simulateSubmitContactForm(form);
      analyticsService.track("contact_form_submitted_mocked", { category: form.category });
      toast.success("Mensagem simulada com sucesso", {
        description: "Nenhuma mensagem real foi enviada. Nada foi persistido.",
      });
      setForm({ name: "", email: "", subject: "", category: "compras", message: "" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <InfoPageLayout
      eyebrow="Contato"
      title="Fale com a LIT Buy"
      subtitle="Canais demonstrativos para compradores, vendedores, segurança e parcerias."
      icon={<Mail className="h-6 w-6 text-primary-foreground" />}
    >
      <Alert>
        <AlertTitle>Formulário demonstrativo</AlertTitle>
        <AlertDescription>
          Nenhuma mensagem real será enviada. Nada é persistido. Suporte real dependerá de backend próprio.
        </AlertDescription>
      </Alert>

      <InfoSection title="Canais de atendimento">
        <div className="grid gap-3 md:grid-cols-2">
          {options.map((o) => <ContactCard key={o.id} option={o} />)}
        </div>
      </InfoSection>

      <InfoSection title="Envie uma mensagem">
        <Card className="p-5 bg-surface/40">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Assunto</Label>
                <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
            </div>
            <Button type="submit" disabled={disabled}>
              {submitting ? "Enviando…" : "Enviar mensagem (mock)"}
            </Button>
          </form>
        </Card>
      </InfoSection>
    </InfoPageLayout>
  );
}
