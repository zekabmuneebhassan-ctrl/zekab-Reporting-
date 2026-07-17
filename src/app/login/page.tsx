import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-900 p-4">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="card relative z-10 w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-lg shadow-brand-900/30">
            G
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Gaming Apps Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
