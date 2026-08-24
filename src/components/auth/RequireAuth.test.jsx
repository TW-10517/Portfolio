// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./RequireAuth.jsx";
import { useAuthStore } from "../../store/useAuthStore.js";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/editor"
          element={
            <RequireAuth>
              <p>Editor</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => useAuthStore.setState({ token: null, user: null }));

describe("RequireAuth", () => {
  it("sends a signed-out visitor to the login page", () => {
    renderAt("/editor");
    expect(screen.getByText("Login page")).toBeTruthy();
    expect(screen.queryByText("Editor")).toBeNull();
  });

  it("lets a signed-in user through", () => {
    useAuthStore.setState({ token: "a-token", user: { id: 1, name: "Ada" } });
    renderAt("/editor");
    expect(screen.getByText("Editor")).toBeTruthy();
  });

  it("guards on the token, not on the user object", () => {
    // refreshUser() can leave `user` momentarily null while a valid session
    // token is still held; that must not bounce someone out of the editor.
    useAuthStore.setState({ token: "a-token", user: null });
    renderAt("/editor");
    expect(screen.getByText("Editor")).toBeTruthy();
  });

  it("does not treat an empty-string token as a session", () => {
    useAuthStore.setState({ token: "", user: { id: 1 } });
    renderAt("/editor");
    expect(screen.getByText("Login page")).toBeTruthy();
  });
});
