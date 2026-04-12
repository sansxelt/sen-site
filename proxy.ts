export { auth as proxy } from "./auth";

export const config = {
  matcher: ["/account/:path*", "/api/account/:path*"],
};
