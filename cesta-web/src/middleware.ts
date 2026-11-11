import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

// Decisão de auth no edge é lightweight: olhamos só se a chave existe no storage
// client-side. Guard real de rota fica na página/hook useMe. Para rotas marcadas
// como públicas, redirecionamos para home se o user já está logado.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Zustand persiste no localStorage no cliente; cookies seriam necessários para
  // decisão real no edge. Deixamos o middleware sem bloqueio por ora; a página
  // valida sessão via /auth/me ao carregar.
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
