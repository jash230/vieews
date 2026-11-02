import { clerkMiddleware } from "@clerk/nextjs/server";

// Auth is enforced where data is read: every page, server action and route handler calls
// auth.protect(); /api/mcp checks API keys. Workflow's internal routes (/.well-known/workflow/) skip it.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|\\.well-known/workflow/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
