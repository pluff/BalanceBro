# Web dev server + Capacitor webviews (capacitor://localhost on iOS, http://localhost on Android).
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  # OAuth + MCP endpoints: browser-based MCP clients call these from any origin. They use bearer tokens, not cookies.
  allow do
    origins "*"
    resource "/.well-known/*", headers: :any, methods: %i[get options]
    resource "/oauth/register", headers: :any, methods: %i[post options]
    resource "/oauth/token", headers: :any, methods: %i[post options]
    resource "/mcp", headers: :any, methods: %i[get post delete options], expose: %w[WWW-Authenticate]
  end

  allow do
    origins(*ENV.fetch("CORS_ORIGINS", "http://localhost:5173,capacitor://localhost,http://localhost").split(","))
    resource "*", headers: :any, methods: %i[get post put patch delete options head]
  end
end
