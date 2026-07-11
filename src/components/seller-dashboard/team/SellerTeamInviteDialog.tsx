import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sellerTeamService } from "@/services/sellerTeamService";
import type { SellerTeamRole } from "@/types";

interface Props {
  roles: SellerTeamRole[];
  onInvited?: () => void;
}

export function SellerTeamInviteDialog({ roles, onInvited }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<SellerTeamRole["id"]>("attendant");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await sellerTeamService.simulateInviteMember({ name, email, roleId, message });
    setBusy(false);
    toast.success("Convite enviado (mock)", {
      description: "Nenhum e-mail real foi enviado.",
    });
    setOpen(false);
    setName("");
    setEmail("");
    setMessage("");
    onInvited?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Convidar membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            Convite demonstrativo. Nenhum e-mail real será enviado nesta fase.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="inv-name">Nome</Label>
            <Input id="inv-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv-email">E-mail</Label>
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Cargo</Label>
            <Select value={roleId} onValueChange={(v) => setRoleId(v as SellerTeamRole["id"])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="inv-msg">Mensagem (opcional)</Label>
            <Textarea id="inv-msg" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>Enviar convite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
