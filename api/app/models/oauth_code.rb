# One-time authorization code (10 minutes). Only its SHA-256 digest is stored.
class OauthCode < ApplicationRecord
  TTL = 10.minutes

  belongs_to :oauth_client
  belongs_to :user

  def self.issue!(client:, user:, redirect_uri:, code_challenge:)
    code = SecureRandom.urlsafe_base64(32)
    create!(oauth_client: client, user: user, redirect_uri: redirect_uri, code_challenge: code_challenge,
            code_digest: OauthToken.digest(code), expires_at: TTL.from_now)
    code
  end

  # Deletes the row, so a code works once whatever happens next.
  def self.consume(code)
    row = find_by(code_digest: OauthToken.digest(code.to_s)) or return
    row.destroy
    row unless row.expires_at.past?
  end

  def pkce_ok?(verifier)
    expected = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier.to_s), padding: false)
    ActiveSupport::SecurityUtils.secure_compare(expected, code_challenge)
  end
end
