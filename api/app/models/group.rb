class Group < ApplicationRecord
  include SoftDeletable

  belongs_to :owner, class_name: "User"
  # Deleting a pot hides it with everything in it; `purge!` removes it for good.
  has_many :expenses
  has_many :settlements
  has_many :audit_logs
  has_many :participant_groups, -> { order(:name) }
  has_many :participants, -> { order(:position, :id) }
  has_many :memberships, class_name: "GroupMembership"

  validates :name, presence: true, length: { maximum: 255 }
  # Two-decimal currencies only: amounts are stored and entered as cents.
  CURRENCIES = %w[EUR USD GBP CHF PLN CZK SEK NOK DKK CAD AUD UAH BYN].freeze

  validates :currency, inclusion: { in: CURRENCIES }

  # Pots the user owns or joined via a share link.
  scope :accessible_by, ->(user) {
    where(owner_id: user.id).or(where(id: GroupMembership.where(user_id: user.id).select(:group_id)))
  }

  def owned_by?(user) = owner_id == user.id

  # Permanent delete of the pot and everything that belongs to it, including soft-deleted rows and its audit trail.
  # The foreign keys cascade, so the database removes the children.
  def purge! = Group.unscoped.where(id: id).delete_all

  # Idempotent: keeps the current link if there is one.
  def enable_sharing! = (share_token || update!(share_token: SecureRandom.urlsafe_base64(32)))

  def disable_sharing! = update!(share_token: nil)

  # People someone joining can pick: not the owner and not anyone already tied to a Google account (one
  # person, one account). Unlinked people and ones held by a guest session stay claimable.
  def claimable_participants
    participants.left_joins(:user).where(users: { google_sub: nil })
                .where("participants.user_id IS NULL OR participants.user_id <> ?", owner_id)
  end

  def member?(user) = owned_by?(user) || memberships.exists?(user_id: user.id)

  # Adds the user as a member (no-op for the owner / existing members) and ties them to a person of the pot:
  # an existing one (`participant_id`, re-linked to this user) or a new one named `name`.
  # Returns that person, or nil when nothing changed (owner / already joined).
  def join!(user, participant_id: nil, name: nil)
    return if owned_by?(user)
    transaction do
      memberships.find_or_create_by!(user: user)
      next if participants.exists?(user_id: user.id)
      if participant_id.present?
        claimable_participants.find(participant_id).tap { |person| person.update!(user: user) }
      else
        participants.create!(name: name.to_s, user: user)
      end
    end
  end
end
