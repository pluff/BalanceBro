class Participant < ApplicationRecord
  include SoftDeletable

  NAME_MAX = 20

  belongs_to :group
  belongs_to :user, optional: true

  has_many :paid_expenses, class_name: "Expense", foreign_key: :paid_by_id, inverse_of: :paid_by,
                           dependent: :restrict_with_error
  has_many :expense_shares, -> { joins(:expense) }, dependent: :restrict_with_error
  has_many :participant_group_members
  has_many :participant_groups, through: :participant_group_members
  has_many :sent_settlements, class_name: "Settlement", foreign_key: :from_participant_id,
                              inverse_of: :from_participant, dependent: :restrict_with_error
  has_many :received_settlements, class_name: "Settlement", foreign_key: :to_participant_id,
                                  inverse_of: :to_participant, dependent: :restrict_with_error

  normalizes :name, with: ->(n) { n.strip.squeeze(" ") }
  normalizes :short_name, with: ->(n) { n.to_s.gsub(/\s/, "").upcase.first(3) }

  # Shown on the avatar of people without a Google picture.
  before_validation { self.short_name = default_short_name if short_name.blank? }

  validates :name, presence: true, length: { maximum: NAME_MAX },
                   uniqueness: { scope: :group_id, case_sensitive: false, conditions: -> { where(deleted_at: nil) }, message: "is already used in this MoneyPot" }

  validates :short_name, presence: true, length: { maximum: 3 }

  before_create { self.position = (group.participants.maximum(:position) || 0) + 1 }
  before_destroy :keep_owner
  before_destroy :keep_used_groups_nonempty

  private

  # Several words: their initials (up to 3). One word: its first three letters.
  def default_short_name
    words = name.to_s.split
    words.size > 1 ? words.map { |w| w[0] }.join : name.to_s
  end

  def keep_owner
    return unless user_id.present? && user_id == group.owner_id
    errors.add(:base, "owner cannot be removed")
    throw :abort
  end

  # Groups used in expenses need someone left to split between.
  def keep_used_groups_nonempty
    return unless participant_groups.any? { |pg| pg.expense_shares.exists? && !pg.participants.where.not(id: id).exists? }
    errors.add(:base, "last member of a group used in expenses")
    throw :abort
  end
end
