class Participant < ApplicationRecord
  belongs_to :group
  belongs_to :user, optional: true

  has_many :paid_expenses, class_name: "Expense", foreign_key: :paid_by_id, inverse_of: :paid_by,
                           dependent: :restrict_with_error
  has_many :expense_shares, dependent: :restrict_with_error
  has_many :participant_group_members, dependent: :destroy
  has_many :sent_settlements, class_name: "Settlement", foreign_key: :from_participant_id,
                              inverse_of: :from_participant, dependent: :restrict_with_error
  has_many :received_settlements, class_name: "Settlement", foreign_key: :to_participant_id,
                                  inverse_of: :to_participant, dependent: :restrict_with_error

  normalizes :name, with: ->(n) { n.strip.squeeze(" ") }

  validates :name, presence: true, length: { maximum: 50 },
                   uniqueness: { scope: :group_id, case_sensitive: false, message: "is already used in this MoneyPot" }

  before_create { self.position = (group.participants.maximum(:position) || 0) + 1 }
  before_destroy :keep_owner

  private

  def keep_owner
    return if destroyed_by_association # whole pot is being deleted
    return unless user_id.present? && user_id == group.owner_id
    errors.add(:base, "owner cannot be removed")
    throw :abort
  end
end
