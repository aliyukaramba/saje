import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  ACCOUNT_SUSPENDED: "This account is suspended. Contact the restaurant manager.",
  VALIDATION: "Please enter a valid email and password.",
  UNKNOWN: "Sign-in failed. Please try again.",
};

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="shell" style={{ maxWidth: 420, paddingTop: 48 }}>
      <h1 className="page-title"><strong>Staff</strong> sign in</h1>
      <form action={loginAction} className="card" style={{ display: "grid", gap: 14 }}>
        {error ? <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{MESSAGES[error] ?? MESSAGES.UNKNOWN}</p> : null}
        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
          Email
          <input className="search" type="email" name="email" autoComplete="username" required />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
          Password
          <input className="search" type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="btn-primary" type="submit">Sign in</button>
      </form>
    </div>
  );
}
