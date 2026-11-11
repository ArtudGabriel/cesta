// Pool de User-Agents de navegadores atuais (fingerprint menos óbvio que UA
// único). Rotaciona por request. Mantém identificação transparente via header
// "From" ou via contato no próprio UA para redes que respeitam robots.txt.

const POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

export function pickUserAgent(): string {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

/** UA identificado (para redes amigáveis que preferem transparência). */
export const IDENTIFIED_UA =
  'Cesta-App/0.1 (+contact: gabriel.augusto@vonex.com.br)';
