const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const imagePatterns = [];

if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    imagePatterns.push({
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      pathname: "/storage/v1/object/public/**",
    });
  } catch (error) {
    console.warn("NEXT_PUBLIC_SUPABASE_URL inválida para remotePatterns");
  }
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL;

if (apiBaseUrl) {
  try {
    const parsed = new URL(apiBaseUrl);
    imagePatterns.push({
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      pathname: "/storage/proxy",
    });
  } catch (error) {
    console.warn("API_BASE_URL inválida para remotePatterns");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: imagePatterns,
  },
};

export default nextConfig;
