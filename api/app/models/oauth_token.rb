# Access + refresh token pair for an MCP client acting as a user. Only SHA-256 digests are stored.
class OauthToken < ApplicationRecord
  ACCESS_TTL = 1.hour
  REFRESH_TTL = 60.days

  belongs_to :oauth_client
  belongs_to :user

  def self.digest(raw) = Digest::SHA256.hexdigest(raw.to_s)

  # Returns [record, access, refresh]; the raw values are not recoverable later.
  def self.issue!(client:, user:)
    access = SecureRandom.urlsafe_base64(32)
    refresh = SecureRandom.urlsafe_base64(32)
    row = create!(oauth_client: client, user: user, access_digest: digest(access), refresh_digest: digest(refresh),
                  expires_at: ACCESS_TTL.from_now, refresh_expires_at: REFRESH_TTL.from_now)
    [ row, access, refresh ]
  end

  def self.authenticate(access) = where(access_digest: digest(access)).where("expires_at > ?", Time.current).first

  # Refresh tokens rotate: the old pair dies when it is used.
  def self.rotate(refresh, client)
    row = find_by(refresh_digest: digest(refresh), oauth_client_id: client.id)
    return unless row
    row.destroy
    return if row.refresh_expires_at.past?
    issue!(client: client, user: row.user)
  end
end
