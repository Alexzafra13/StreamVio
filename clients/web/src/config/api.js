// clients/web/src/config/api.js
const API_URL =
  import.meta.env.PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? window.location.origin.replace(/:\d+$/, "") + ":3000"
    : "http://localhost:3000");

console.log("API URL configurada:", API_URL);

export default {
  API_URL,
  endpoints: {
    health: "/api/health",
    auth: "/api/auth",
    libraries: "/api/libraries",
    media: "/api/media",
    admin: "/api/admin",
  },
};
