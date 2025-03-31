// clients/web/tests/unit/Navigation.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Navigation from "../../src/components/Navigation";

// Mock de localStorage
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock del evento personalizado
window.dispatchEvent = jest.fn();

describe("Navigation Component", () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test("muestra el botón de inicio de sesión cuando el usuario no está autenticado", () => {
    render(<Navigation />);

    expect(screen.getByText("Iniciar Sesión")).toBeInTheDocument();
    expect(screen.queryByText("Cerrar Sesión")).not.toBeInTheDocument();
  });

  test("muestra el menú de usuario cuando el usuario está autenticado", () => {
    // Simular un usuario autenticado
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

    render(<Navigation />);

    // Verificar que se muestra el nombre del usuario
    expect(screen.getByText("testuser")).toBeInTheDocument();

    // Abrir el menú desplegable
    fireEvent.click(screen.getByText("testuser"));

    // Verificar opciones del menú
    expect(screen.getByText("Mi Perfil")).toBeInTheDocument();
    expect(screen.getByText("Cerrar Sesión")).toBeInTheDocument();
  });

  test('cierra sesión correctamente cuando se hace clic en "Cerrar Sesión"', () => {
    // Simular un usuario autenticado
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

    // Mock de window.location.href
    delete window.location;
    window.location = { href: jest.fn() };

    render(<Navigation />);

    // Abrir el menú desplegable
    fireEvent.click(screen.getByText("testuser"));

    // Hacer clic en cerrar sesión
    fireEvent.click(screen.getByText("Cerrar Sesión"));

    // Verificar que se eliminaron los elementos de localStorage
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("streamvio_token");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("streamvio_user");

    // Verificar que se disparó el evento de cambio de autenticación
    expect(window.dispatchEvent).toHaveBeenCalled();

    // Verificar que se redirigió al inicio
    expect(window.location.href).toBe("/");
  });
});
