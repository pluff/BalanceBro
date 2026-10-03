# OAuth 2.1 authorization server for MCP clients: discovery, dynamic client registration (RFC 7591),
# authorization code + PKCE (S256 only) and refresh tokens. Users sign in with Google on the consent page.
class OauthController < ActionController::API
  before_action { response.headers["Cache-Control"] = "no-store" }

  class AuthzError < StandardError; end

  # GET /.well-known/oauth-protected-resource(/mcp)
  def resource_metadata
    render json: { resource: "#{base}/mcp", authorization_servers: [ base ], bearer_methods_supported: %w[header] }
  end

  # GET /.well-known/oauth-authorization-server
  def server_metadata
    render json: {
      issuer: base,
      authorization_endpoint: "#{base}/oauth/authorize",
      token_endpoint: "#{base}/oauth/token",
      registration_endpoint: "#{base}/oauth/register",
      response_types_supported: %w[code],
      grant_types_supported: %w[authorization_code refresh_token],
      code_challenge_methods_supported: %w[S256],
      token_endpoint_auth_methods_supported: %w[none]
    }
  end

  # POST /oauth/register { client_name, redirect_uris: [...] }
  def register
    client = OauthClient.new(name: params[:client_name].to_s.strip.presence || "MCP client",
                             redirect_uris: Array(params[:redirect_uris]).map(&:to_s))
    return render(json: { error: "invalid_redirect_uri", error_description: client.errors.full_messages.to_sentence },
                  status: :bad_request) unless client.save

    render json: { client_id: client.client_id, client_name: client.name, redirect_uris: client.redirect_uris,
                   grant_types: %w[authorization_code refresh_token], response_types: %w[code],
                   token_endpoint_auth_method: "none" }, status: :created
  end

  # GET /oauth/authorize: consent page with Google sign-in. Errors here are shown, never redirected, because
  # the redirect_uri is not trusted yet.
  def authorize
    client = validate_authorization_request!
    render html: consent_page(client).html_safe, layout: false
  rescue AuthzError => e
    render html: error_page(e.message).html_safe, layout: false, status: :bad_request
  end

  # POST /oauth/authorize { id_token, + the authorize params }: answers { redirect_to } for the page script.
  def approve
    client = validate_authorization_request!
    user = User.from_google(GoogleIdentity.verify(params[:id_token]))
    code = OauthCode.issue!(client: client, user: user, redirect_uri: params[:redirect_uri],
                            code_challenge: params[:code_challenge])
    target = URI.parse(params[:redirect_uri])
    pairs = URI.decode_www_form(target.query.to_s) + [ [ "code", code ] ]
    pairs << [ "state", params[:state] ] if params[:state].present?
    target.query = URI.encode_www_form(pairs)
    render json: { redirect_to: target.to_s }
  rescue AuthzError => e
    render json: { error: e.message }, status: :bad_request
  rescue GoogleIdentity::Error
    render json: { error: "Google sign-in failed" }, status: :unauthorized
  end

  # POST /oauth/token (form encoded)
  def token
    client = OauthClient.find_by(client_id: params[:client_id])
    return oauth_error("invalid_client", status: :unauthorized) unless client

    case params[:grant_type]
    when "authorization_code" then exchange_code(client)
    when "refresh_token" then refresh(client)
    else oauth_error("unsupported_grant_type")
    end
  end

  private

  def base = request.base_url

  def exchange_code(client)
    code = OauthCode.consume(params[:code])
    unless code && code.oauth_client_id == client.id && code.redirect_uri == params[:redirect_uri] && code.pkce_ok?(params[:code_verifier])
      return oauth_error("invalid_grant")
    end
    render_tokens(*OauthToken.issue!(client: client, user: code.user).drop(1))
  end

  def refresh(client)
    rotated = OauthToken.rotate(params[:refresh_token], client) or return oauth_error("invalid_grant")
    render_tokens(*rotated.drop(1))
  end

  def render_tokens(access, refresh)
    render json: { access_token: access, token_type: "Bearer", expires_in: OauthToken::ACCESS_TTL.to_i, refresh_token: refresh }
  end

  def oauth_error(code, status: :bad_request) = render(json: { error: code }, status: status)

  def validate_authorization_request!
    client = OauthClient.find_by(client_id: params[:client_id]) or raise AuthzError, "Unknown client."
    raise AuthzError, "redirect_uri is not registered for this client." unless client.redirect_uri?(params[:redirect_uri])
    raise AuthzError, "A PKCE code_challenge is required." if params[:code_challenge].blank?
    if action_name == "authorize"
      raise AuthzError, "Only response_type=code is supported." unless params[:response_type] == "code"
      raise AuthzError, "Only code_challenge_method=S256 is supported." unless params[:code_challenge_method] == "S256"
    end
    client
  end

  def esc(value) = ERB::Util.html_escape(value)

  def web_client_id = ENV["GOOGLE_WEB_CLIENT_ID"].presence || ENV.fetch("GOOGLE_CLIENT_IDS", "").split(",").first.to_s.strip

  PAGE = <<~HTML
    <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>BalanceBro</title>
    <style>body{font:16px system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f4;color:#1b1b1b}
    main{max-width:380px;margin:16px;padding:28px;background:#fff;border-radius:16px;box-shadow:0 2px 12px #0001;text-align:center}
    h1{font-size:20px;margin:0 0 8px}p{color:#555;line-height:1.4}#err{color:#b00020}</style></head><body><main>%s</main></body></html>
  HTML

  def error_page(message) = format(PAGE, "<h1>Cannot sign in</h1><p>#{esc(message)}</p>")

  def consent_page(client)
    keys = %w[client_id redirect_uri code_challenge state]
    context = params.permit(*keys).to_h.merge("google_client_id" => web_client_id)
    body = <<~HTML
      <h1>Connect #{esc(client.name)}</h1>
      <p>Sign in to let <b>#{esc(client.name)}</b> read your MoneyPots and add expenses and paybacks on your behalf.</p>
      <div id="btn" style="display:flex;justify-content:center"></div><p id="err"></p>
      <script>
      const ctx = #{context.to_json.gsub("<", '<')};
      const err = (m) => document.getElementById("err").textContent = m;
      async function onCredential(r) {
        const res = await fetch("/oauth/authorize", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...ctx, id_token: r.credential }) });
        const data = await res.json().catch(() => ({}));
        if (res.ok) location.href = data.redirect_to; else err(data.error || "Sign-in failed");
      }
      function init() {
        if (!ctx.google_client_id) return err("Google sign-in is not configured.");
        google.accounts.id.initialize({ client_id: ctx.google_client_id, callback: onCredential });
        google.accounts.id.renderButton(document.getElementById("btn"), { theme: "outline", size: "large" });
      }
      </script>
      <script src="https://accounts.google.com/gsi/client" async onload="init()" onerror="err('Could not load Google sign-in')"></script>
    HTML
    format(PAGE, body)
  end
end
