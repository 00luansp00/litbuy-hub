/**
 * moderation.ts — utilitários mockados de censura visual anti-poaching.
 * Não é moderação real: apenas substitui padrões evidentes de contato
 * externo por um marcador visual antes de renderizar/enviar em modo demo.
 * A moderação de produção exige backend (ver SECURITY_NOTES.md).
 */

export const REMOVED_CONTACT_MARK = "[CONTATO REMOVIDO PELA MODERAÇÃO]";

export interface ModerationResult {
  original: string;
  sanitized: string;
  removed: boolean;
  matches: string[];
}

const PATTERNS: RegExp[] = [
  // URLs http(s) e www.
  /\bhttps?:\/\/\S+/gi,
  /\bwww\.[^\s]+/gi,
  // e-mails
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi,
  // menções @usuario (mínimo 3 chars)
  /(^|\s)@[a-zA-Z0-9_.]{3,}/g,
  // números longos (>= 8 dígitos, aceita espaço/traço/parênteses/+)
  /(\+?\d[\s().-]?){8,}\d/g,
  // apps de contato externo
  /\b(whats?app|wpp|zap|telegram|tele?g|discord|disc|insta(gram)?|skype|signal|kik|snap(chat)?)\b/gi,
];

export function sanitizeExternalContact(text: string): string {
  return moderateText(text).sanitized;
}

export function moderateText(text: string): ModerationResult {
  if (!text) {
    return { original: text, sanitized: text, removed: false, matches: [] };
  }
  const matches: string[] = [];
  let sanitized = text;
  for (const rx of PATTERNS) {
    sanitized = sanitized.replace(rx, (match) => {
      matches.push(match.trim());
      const prefix = /^\s/.test(match) ? " " : "";
      return `${prefix}${REMOVED_CONTACT_MARK}`;
    });
  }
  return {
    original: text,
    sanitized,
    removed: matches.length > 0,
    matches,
  };
}
