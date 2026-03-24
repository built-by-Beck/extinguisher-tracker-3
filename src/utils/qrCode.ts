import QRCode from 'qrcode';

export async function generateQRDataUrl(url: string, size = 150): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export function getExtinguisherQRUrl(orgId: string, extId: string): string {
  return `${window.location.origin}/qr/${orgId}/${extId}`;
}
