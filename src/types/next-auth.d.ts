import { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      pharmacieId: string
    } & DefaultSession['user']
  }

  interface User {
    role: string
    pharmacieId: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: string
    pharmacieId: string
    id: string
  }
}
