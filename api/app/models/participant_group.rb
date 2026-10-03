class ParticipantGroup < ApplicationRecord
  include SoftDeletable

  belongs_to :group
  has_many :members, class_name: "ParticipantGroupMember"
  has_many :participants, through: :members
  # A group in use is part of expenses' history; deleting it would silently change balances.
  # Shares of deleted expenses don't count.
  has_many :expense_shares, -> { joins(:expense) }, dependent: :restrict_with_error

  normalizes :name, with: ->(n) { n.strip.squeeze(" ") }

  validates :name, presence: true, length: { maximum: 50 },
                   uniqueness: { scope: :group_id, case_sensitive: false, conditions: -> { where(deleted_at: nil) }, message: "is already used in this MoneyPot" }
end
