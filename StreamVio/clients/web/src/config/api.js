// clients/web/src/config/api.js
const API_URL =
  import.meta.env.PUBLIC_API_URL ||
  window.location.origin.replace(/:\d+$/, "") + ":3000";

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
