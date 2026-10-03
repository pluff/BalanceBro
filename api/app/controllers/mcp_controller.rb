# MCP server (Streamable HTTP transport, stateless: every POST is one JSON-RPC message, answered as JSON).
# Authenticated with an OAuth access token issued by OauthController.
class McpController < ActionController::API
  before_action :authenticate!

  # POST /mcp
  def handle
    message = JSON.parse(request.raw_post)
    reply = Mcp::Server.new(@user, ip: request.remote_ip).call(message)
    reply ? render(json: reply) : head(:accepted)
  rescue JSON::ParserError
    render json: { jsonrpc: "2.0", id: nil, error: { code: -32700, message: "Parse error" } }, status: :bad_request
  end

  # No server-initiated stream, no sessions.
  def unsupported
    head :method_not_allowed, allow: "POST"
  end

  private

  def authenticate!
    token = OauthToken.authenticate(request.authorization.to_s.delete_prefix("Bearer ").presence)
    return @user = token.user if token

    response.headers["WWW-Authenticate"] = %(Bearer resource_metadata="#{request.base_url}/.well-known/oauth-protected-resource")
    render json: { error: "unauthorized" }, status: :unauthorized
  end
end
