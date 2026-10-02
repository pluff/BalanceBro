# Verifies a Google ID token (JWT) issued to one of our OAuth client IDs
# (web, iOS, Android) and returns its claims. Raises Error otherwise.
class GoogleIdentity
  class Error < StandardError; end

  def self.verify(id_token)
    client_ids = ENV.fetch("GOOGLE_CLIENT_IDS", "").split(",").map(&:strip).reject(&:empty?)
    raise Error, "GOOGLE_CLIENT_IDS not configured" if client_ids.empty?

    payload = Google::Auth::IDTokens.verify_oidc(id_token.to_s, aud: client_ids)
    raise Error, "email not verified" unless payload["email_verified"]
    payload
  rescue Google::Auth::IDTokens::VerificationError => e
    raise Error, e.message
  end
end
