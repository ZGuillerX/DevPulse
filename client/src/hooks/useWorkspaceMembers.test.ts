import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWorkspaceMembers } from "./useWorkspaceMembers";
import { apiRequest } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

describe("useWorkspaceMembers", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("loads members on mount", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      members: [{ id: "u1", email: "a@example.com", name: "A", avatar_url: null, role: "owner" }],
    });

    const { result } = renderHook(() => useWorkspaceMembers("ws-1"));

    await waitFor(() => expect(result.current.members).toHaveLength(1));
    expect(result.current.members[0].email).toBe("a@example.com");
  });

  it("reloads the member list after a successful invite", async () => {
    mockedApiRequest
      .mockResolvedValueOnce({ members: [] })
      .mockResolvedValueOnce({ message: "ok" })
      .mockResolvedValueOnce({
        members: [{ id: "u2", email: "b@example.com", name: null, avatar_url: null, role: "member" }],
      });

    const { result } = renderHook(() => useWorkspaceMembers("ws-1"));
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.inviteMember("b@example.com", "member");
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0].email).toBe("b@example.com");
  });

  // El propio componente que usa este hook (SettingsPanel) depende de que
  // los errores se propaguen para poder mostrarlos — si el hook los tragara,
  // volvería el mismo bug de "sync now no hace nada" pero para invitar.
  it("propagates invite errors instead of swallowing them", async () => {
    mockedApiRequest
      .mockResolvedValueOnce({ members: [] })
      .mockRejectedValueOnce(new Error("No existe un usuario con ese correo."));

    const { result } = renderHook(() => useWorkspaceMembers("ws-1"));
    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1));

    await expect(result.current.inviteMember("nobody@example.com", "member")).rejects.toThrow(
      "No existe un usuario con ese correo."
    );
  });

  it("does nothing when there is no active workspace", () => {
    renderHook(() => useWorkspaceMembers(null));
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });
});
