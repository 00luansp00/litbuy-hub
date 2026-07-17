import { ApiError } from "@/lib/api/client";
const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar.",
  DEVICE_APPROVAL_REQUIRED: "Aprove este dispositivo pelo link enviado ao e-mail.",
  TWO_FACTOR_REQUIRED: "Informe o código de verificação para concluir o login.",
  INVALID_OR_EXPIRED_TOKEN: "Token inválido, expirado ou já utilizado.",
  INVALID_OR_EXPIRED_2FA_CODE: "Código inválido, expirado ou já utilizado.",
  TWO_FACTOR_CHALLENGE_LOCKED: "Muitas tentativas. Solicite um novo código.",
  INVALID_RECOVERY_CODE: "Recovery code inválido.",
  INVALID_SESSION: "Sua sessão expirou. Entre novamente.",
  INVALID_CSRF: "Não foi possível validar a sessão. Recarregue a página.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos.",
  INVALID_PHONE: "Informe um celular brasileiro válido.",
  PHONE_ALREADY_VERIFIED: "Este telefone já está confirmado.",
  PHONE_UNAVAILABLE: "Telefone indisponível.",
  PHONE_RESEND_COOLDOWN: "Aguarde antes de solicitar outro SMS.",
  SMS_DELIVERY_UNAVAILABLE: "Entrega de SMS indisponível no momento.",
  INVALID_OR_EXPIRED_CODE: "Código inválido, expirado ou já utilizado.",
  CHALLENGE_LOCKED: "Muitas tentativas. Solicite um novo código.",
  EMAIL_UNCHANGED: "Informe um e-mail diferente do atual.",
  EMAIL_UNAVAILABLE: "E-mail indisponível.",
  EMAIL_DELIVERY_UNAVAILABLE: "Entrega de e-mail indisponível no momento.",
  TWO_FACTOR_ALREADY_ENABLED: "O 2FA já está ativo nesta conta.",
  TWO_FACTOR_NOT_ENABLED: "O 2FA não está ativo nesta conta.",
  TWO_FACTOR_METHOD_UNAVAILABLE: "Método de 2FA indisponível no momento.",
  TWO_FACTOR_CHALLENGE_CONFLICT: "Há um desafio de 2FA em andamento. Solicite um novo código.",
  TWO_FACTOR_DELIVERY_UNAVAILABLE: "Entrega do código indisponível no momento.",
  OUTDATED_TERMS_OR_PRIVACY: "Atualize a página e aceite as versões atuais dos termos.",
  INVALID_REGISTRATION: "Revise os dados do cadastro.",
  INVALID_2FA_INPUT: "Informe código de seis dígitos ou recovery code, nunca ambos.",
  STEP_UP_NOT_AVAILABLE: "Step-up indisponível para esta ação no momento.",
  STEP_UP_DELIVERY_UNAVAILABLE: "Não foi possível enviar o código. Inicie novamente em instantes.",
  STEP_UP_REQUIRED: "Confirme a ação sensível antes de continuar.",
  INVALID_OR_EXPIRED_STEP_UP_CODE:
    "Código inválido ou expirado. Corrija os dados ou solicite reenvio.",
  STEP_UP_CHALLENGE_LOCKED: "Muitas tentativas. Inicie uma nova confirmação.",
  INVALID_OR_EXPIRED_STEP_UP_GRANT: "A confirmação expirou. Inicie novamente.",
  STEP_UP_SCOPE_MISMATCH: "A confirmação não corresponde a esta ação. Inicie novamente.",
  FORBIDDEN: "Você não tem permissão para concluir esta ação.",
  RECOVERY_REGENERATION_OUTCOME_UNKNOWN:
    "Não foi possível confirmar o resultado da regeneração dos recovery codes.",
  MALFORMED_RESPONSE: "Resposta inválida da API.",
  HTTP_ERROR: "Não foi possível concluir a operação.",
  NETWORK_ERROR: "Não foi possível conectar à API.",
};
export function friendlyAuthError(error: unknown) {
  if (error instanceof ApiError)
    return {
      message: messages[error.code] ?? messages.HTTP_ERROR,
      requestId: error.requestId,
      code: error.code,
      status: error.status,
    };
  return { message: messages.NETWORK_ERROR };
}
