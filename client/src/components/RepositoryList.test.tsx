import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RepositoryList from "./RepositoryList";

const baseProps = {
  items: [],
  pagination: { page: 1, totalPages: 1, total: 0 },
  search: "",
  onSearchChange: vi.fn(),
  status: "all",
  onStatusChange: vi.fn(),
  onPageChange: vi.fn(),
  onSyncRepository: vi.fn(),
  onOpenRepository: vi.fn(),
  loading: false,
};

describe("RepositoryList - add repository error handling", () => {
  it("shows the error message when adding a repository fails", async () => {
    const user = userEvent.setup();
    const onAddRepository = vi.fn().mockRejectedValue(new Error("No tienes GitHub conectado."));

    render(<RepositoryList {...baseProps} onAddRepository={onAddRepository} />);

    await user.click(screen.getByRole("button", { name: "+ Repositorio" }));
    await user.type(screen.getByPlaceholderText(/owner\/repo/i), "acme/widgets");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByText("No tienes GitHub conectado.")).toBeInTheDocument();
    expect(onAddRepository).toHaveBeenCalledWith("acme/widgets");
  });

  it("clears the form on a successful add", async () => {
    const user = userEvent.setup();
    const onAddRepository = vi.fn().mockResolvedValue(undefined);

    render(<RepositoryList {...baseProps} onAddRepository={onAddRepository} />);

    await user.click(screen.getByRole("button", { name: "+ Repositorio" }));
    await user.type(screen.getByPlaceholderText(/owner\/repo/i), "acme/widgets");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    // El formulario se cierra (showAddForm vuelve a false) tras un add exitoso
    await waitFor(() => expect(screen.queryByPlaceholderText(/owner\/repo/i)).not.toBeInTheDocument());
  });
});
