/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
    // because DiceBear returns SVGs and you're using next/image
    dangerouslyAllowSVG: true,
  },
}
export default nextConfig
