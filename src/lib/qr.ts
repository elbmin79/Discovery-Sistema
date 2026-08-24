export const QR_PREFIX = "DISCOVERY";

export function pickupPayload(code: string, token: string) {
  return `${QR_PREFIX}:${code}:${token}`;
}

export function parsePickupPayload(value: string) {
  const trimmed = value.trim();
  const parts = trimmed.split(":");
  if (parts[0] === QR_PREFIX && parts.length >= 3) {
    return { code: parts[1], token: parts[2] };
  }
  if (/^\d{4}$/.test(trimmed)) {
    return { code: trimmed, token: undefined };
  }
  return null;
}
