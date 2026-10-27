import { clerkMiddleware } from "@clerk/nextjs/server";

// Auth is enforced where data is read: every page, server action and route handler calls
// auth.protect(). Inngest signs its own requests; /api/mcp checks API keys.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
