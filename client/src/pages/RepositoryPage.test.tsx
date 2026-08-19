import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RepositoryPage from "./RepositoryPage";
import { apiRequest, ApiError } from "@/lib/api";
import type { Workspace } from "@/types";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiRequest: vi.fn() };
});

const mockedApiRequest = vi.mocked(apiRequest);

const workspace: Workspace = { id: "ws-1", name: "Test Workspace", role: "member" };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/repos/repo-1"]}>
      <Routes>
        <Route path="/repos/:repositoryId" element={<RepositoryPage workspace={workspace} />} />
      </Routes>
    </MemoryRouter>
  );
}

function mockHappyLoad() {
  mockedApiRequest.mockImplementation((path: string) => {
    if (path.includes("/pull-requests")) {
      return Promise.resolve({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } });
    }
    if (path.includes("/issues")) {
      return Promise.resolve({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } });
    }
    if (path.includes("/health-history")) {
      return Promise.resolve({ history: [] });
    }
    return Promise.resolve({ repo: { id: "repo-1", full_name: "acme/widgets" }, health: null });
  });
}

// Regression test for a real bug: handleSync() had no catch block, so a
// failed "Sync now" reset the button with zero feedback — the user saw
// nothing happen and had no way to know why. See git history for the fix.
describe("RepositoryPage - Sync now error handling", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("shows an error message when syncing fails, instead of failing silently", async () => {
    const user = userEvent.setup();
    mockHappyLoad();

    renderPage();
    await waitFor(() => expect(screen.getByText("acme/widgets")).toBeInTheDocument());

    mockedApiRequest.mockImplementationOnce(() =>
      Promise.reject(new ApiError("Tu conexión con GitHub ya no es válida.", "GITHUB_TOKEN_INVALID", 400))
    );

    await user.click(screen.getByRole("button", { name: /sync now/i }));

    expect(await screen.findByText("Tu conexión con GitHub ya no es válida.")).toBeInTheDocument();
  });

  it("clears the sync button back to its normal label after a failed sync", async () => {
    const user = userEvent.setup();
    mockHappyLoad();

    renderPage();
    await waitFor(() => expect(screen.getByText("acme/widgets")).toBeInTheDocument());

    mockedApiRequest.mockImplementationOnce(() => Promise.reject(new ApiError("falló", "X", 500)));

    const button = screen.getByRole("button", { name: /sync now/i });
    await user.click(button);

    await waitFor(() => expect(button).not.toBeDisabled());
    expect(button).toHaveTextContent("Sync now");
  });
});
