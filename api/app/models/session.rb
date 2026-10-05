class Session < ApplicationRecord
  TTL = 2.weeks
  TOUCH_EVERY = 1.hour # updated_at is the last-use time; bump it at most this often to avoid a write per request

  belongs_to :user
  has_secure_token :token

  scope :active, -> { where(updated_at: TTL.ago..) }

  # User for a bearer token, or nil if unknown/expired. Each use of a live session extends it.
  def self.user_for(token)
    return if token.blank?
    session = active.find_by(token: token)
    session&.touch if session && session.updated_at < TOUCH_EVERY.ago
    session&.user
  end

  def self.purge_expired = where(updated_at: ...TTL.ago).delete_all
end
