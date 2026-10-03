class User < ApplicationRecord
  has_many :sessions, dependent: :destroy
  has_many :groups, foreign_key: :owner_id, inverse_of: :owner, dependent: :destroy
  has_many :participants, dependent: :nullify
  has_many :group_memberships, dependent: :destroy
  has_many :oauth_codes, dependent: :destroy
  has_many :oauth_tokens, dependent: :destroy

  normalizes :email, with: ->(e) { e.strip.downcase }

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true

  # Account without Google sign-in, created when someone opens a share link. Keeps access via its session token.
  def self.create_guest!(name)
    create!(email: "guest-#{SecureRandom.hex(8)}@guest.invalid", name: name.to_s.strip.squeeze(" ").first(44))
  end

  # Finds by Google subject id; falls back to email for accounts created earlier.
  def self.from_google(payload)
    user = find_by(google_sub: payload["sub"]) || find_or_initialize_by(email: payload["email"])
    user.google_sub = payload["sub"]
    user.name = payload["name"].presence || payload["email"] if user.name.blank?
    user.avatar_url = payload["picture"]
    user.save!
    user
  end
end
