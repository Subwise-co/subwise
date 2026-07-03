// Protect the authenticated app routes. Unauthenticated users hitting these are sent to "/" (the
// landing page is our sign-in surface — Google + email/password dialog).
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/commitments/:path*", "/payments/:path*", "/settings/:path*", "/welcome"],
};
