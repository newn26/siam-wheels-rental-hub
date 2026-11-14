/**
 * After signing in, each role lands on its own home page. The role comes from the
 * database (fetchRole), mocked here. Fictional credentials only.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  role: "customer" as string,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(() =>
        Promise.resolve({ data: { user: { id: "u-1" } }, error: null }),
      ),
      signOut: vi.fn(),
    },
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, role: "customer", isDemo: false, loading: false }),
  fetchRole: () => Promise.resolve(mocks.role),
}));
vi.mock("@/lib/demo.functions", () => ({ createDemoAccount: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      ...opts,
      options: opts,
      useSearch: () => ({}),
    }),
    useNavigate: () => mocks.navigate,
  };
});

import { Route } from "@/routes/auth";

const AuthPage = (Route as unknown as { options: { component: ComponentType } }).options.component;

async function signInAs(role: string) {
  mocks.role = role;
  render(<AuthPage />);
  fireEvent.change(screen.getByLabelText(/อีเมล/), { target: { value: "someone@example.test" } });
  fireEvent.change(screen.getByLabelText(/รหัสผ่าน/), { target: { value: "secret-123" } });
  fireEvent.submit(screen.getByLabelText(/อีเมล/).closest("form") as HTMLFormElement);
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
}

afterEach(() => vi.clearAllMocks());

describe("sign-in redirect", () => {
  it("an admin lands on the admin dashboard", async () => {
    await signInAs("admin");
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/admin" });
  });

  it("a demo admin lands on the demo dashboard", async () => {
    await signInAs("demo_admin");
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/demo-admin" });
  });

  it("a customer lands on the home page", async () => {
    await signInAs("customer");
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
