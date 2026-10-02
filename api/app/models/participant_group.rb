class ParticipantGroup < ApplicationRecord
  belongs_to :group
  has_many :members, class_name: "ParticipantGroupMember", dependent: :destroy
  has_many :participants, through: :members
  # A group in use is part of expenses' history; deleting it would silently change balances.
  has_many :expense_shares, dependent: :restrict_with_error

  normalizes :name, with: ->(n) { n.strip.squeeze(" ") }

  validates :name, presence: true, length: { maximum: 50 },
                   uniqueness: { scope: :group_id, case_sensitive: false, message: "is already used in this MoneyPot" }
end
