import { ipKeyGenerator } from 'express-rate-limit';

// Cloudflare's Node compatibility adapter does not always populate req.ip.
// Prefer the proxy-provided client address so rate-limit keys remain per client.
export const clientIpKey = request => {
  const cloudflareIp = request.get('cf-connecting-ip');
  if (cloudflareIp) return ipKeyGenerator(cloudflareIp);

  const forwardedFor = request.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  if (forwardedIp) return ipKeyGenerator(forwardedIp);

  return request.ip ? ipKeyGenerator(request.ip) : 'unknown-client';
};
