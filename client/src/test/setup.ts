import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Sin `test.globals: true` en vite.config.ts, @testing-library/react no
// encuentra un `afterEach` global del que colgar su auto-cleanup, así que
// hay que registrarlo explícitamente — si no, el DOM de un test queda
// montado cuando arranca el siguiente.
afterEach(() => {
  cleanup();
});
