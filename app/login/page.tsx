import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center px-4">
          <p className="text-zinc-500">Indlæser…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
