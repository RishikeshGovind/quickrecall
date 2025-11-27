export { default } from 'next-auth/middleware'


export const config = {
matcher: ['/decks/:path*', '/api/review/:path*'],
}