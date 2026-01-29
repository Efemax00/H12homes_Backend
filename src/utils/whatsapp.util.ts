export function toWhatsAppLink(phone: string): string | null {
  if (!phone) return null;

  // Remove spaces, +, -, ()
  let cleaned = phone.replace(/[^\d]/g, '');

  /**
   * Nigerian formats:
   * 080xxxxxxx
   * 081xxxxxxx
   * 2348xxxxxx
   * +2348xxxxxx
   */

  // Starts with 0 → replace with 234
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.slice(1);
  }

  // Starts with 234 already → OK
  if (cleaned.startsWith('234')) {
    return `https://wa.me/${cleaned}`;
  }

  // If already international
  if (cleaned.length >= 10) {
    return `https://wa.me/${cleaned}`;
  }

  return null;
}
