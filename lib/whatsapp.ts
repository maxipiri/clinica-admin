/**
 * Convierte un teléfono chileno a formato internacional para wa.me.
 * Acepta "9 1234 5678", "+56 9 1234 5678", "912345678", "12345678".
 * Devuelve null si no parece un celular válido.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "569" + d; // 1234 5678
  else if (d.length === 9 && d.startsWith("9")) d = "56" + d; // 9 1234 5678
  if (!/^56\d{9}$/.test(d)) return null;
  return d;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const n = toWhatsAppNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}
