class ParticipantGroupMember < ApplicationRecord
  belongs_to :participant_group
  belongs_to :participant

  validates :participant_id, uniqueness: { scope: :participant_group_id }

  # Expenses split with a group need someone left to split between.
  before_destroy :keep_used_group_nonempty

  private

  def keep_used_group_nonempty
    return unless participant_group.expense_shares.exists?
    return if participant_group.participants.where.not(id: participant_id).exists?
    errors.add(:base, "last member of a group used in expenses")
    throw :abort
  end
end
