// clients/web/tests/setup.js
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock para localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Configurar mocks globales
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock para window.location
Object.defineProperty(window, "location", {
  value: {
    href: vi.fn(),
    pathname: "/test-path",
    origin: "http://localhost:4321",
    search: "",
    hash: "",
  },
  writable: true,
});

// Mock para API_URL
import.meta.env.PUBLIC_API_URL = "http://localhost:3000";

// Mock para eventos personalizados
window.dispatchEvent = vi.fn();
window.addEventListener = vi.fn();
window.removeEventListener = vi.fn();

// Mock para fetch API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    headers: new Headers(),
  })
);

// Restablecer todos los mocks entre tests
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// Mock para axios
vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn(() => Promise.resolve({ data: {} })),
      post: vi.fn(() => Promise.resolve({ data: {} })),
      put: vi.fn(() => Promise.resolve({ data: {} })),
      delete: vi.fn(() => Promise.resolve({ data: {} })),
      defaults: {
        headers: {
          common: {},
        },
      },
    },
  };
});

// Solución para ResizeObserver en jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Solución para IntersectionObserver en jsdom
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock para HTMLMediaElement (video/audio)
Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: vi.fn().mockImplementation(() => Promise.resolve()),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
  configurable: true,
  get: vi.fn().mockReturnValue(0),
  set: vi.fn(),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "duration", {
  configurable: true,
  get: vi.fn().mockReturnValue(100),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
  configurable: true,
  get: vi.fn().mockReturnValue(true),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "volume", {
  configurable: true,
  get: vi.fn().mockReturnValue(1),
  set: vi.fn(),
});

// Función de ayuda para simular la navegación
global.navigateTo = (path) => {
  window.location.pathname = path;
  return path;
};

// Función de ayuda para simular usuario autenticado
global.setupAuthenticatedUser = () => {
  localStorageMock.getItem.mockImplementation((key) => {
    if (key === "streamvio_token") return "fake-token";
    if (key === "streamvio_user")
      return JSON.stringify({
        id: 1,
        username: "testuser",
        email: "test@example.com",
      });
    return null;
  });
};

// Datos de prueba estándar
global.testData = {
  user: {
    id: 1,
    username: "testuser",
    email: "test@example.com",
  },
  media: [
    {
      id: 1,
      title: "Test Movie 1",
      type: "movie",
      duration: 5400,
      size: 1024000,
      thumbnail_path: "/path/to/thumbnail.jpg",
      file_path: "/path/to/movie.mp4",
    },
    {
      id: 2,
      title: "Test Series 1",
      type: "series",
      year: 2023,
    },
  ],
  libraries: [
    {
      id: 1,
      name: "Test Movies",
      path: "/path/to/movies",
      type: "movies",
      itemCount: 5,
    },
    {
      id: 2,
      name: "Test Series",
      path: "/path/to/series",
      type: "series",
      itemCount: 3,
    },
  ],
};

// Polyfill para crypto.getRandomValues
if (typeof global.crypto !== "object") {
  global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== "function") {
  global.crypto.getRandomValues = function getRandomValues(array) {
    return require("crypto").randomFillSync(array);
  };
}
