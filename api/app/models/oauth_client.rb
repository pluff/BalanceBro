# Public client (an MCP app) registered via dynamic client registration. No secret: PKCE protects the code.
class OauthClient < ApplicationRecord
  has_many :codes, class_name: "OauthCode", dependent: :destroy
  has_many :tokens, class_name: "OauthToken", dependent: :destroy

  attribute :client_id, :string, default: -> { SecureRandom.uuid }

  validates :name, presence: true, length: { maximum: 100 }
  validate :redirect_uris_valid

  def redirect_uri?(uri) = redirect_uris.include?(uri)

  private

  # https, loopback http (native apps) or a custom app scheme; never a fragment.
  def redirect_uris_valid
    uris = Array(redirect_uris)
    return errors.add(:redirect_uris, "must not be empty") if uris.empty? || uris.size > 10
    errors.add(:redirect_uris, "invalid") unless uris.all? { |u| valid_redirect?(u) }
  end

  def valid_redirect?(value)
    uri = URI.parse(value.to_s)
    return false if uri.scheme.blank? || uri.fragment || %w[javascript data vbscript file].include?(uri.scheme.downcase)
    return true unless %w[http https].include?(uri.scheme)
    uri.scheme == "https" || %w[localhost 127.0.0.1 [::1]].include?(uri.host)
  rescue URI::InvalidURIError
    false
  end
end
