# One "split between" entry of an expense: either a single participant or a whole participant group.
class ExpenseShare < ApplicationRecord
  belongs_to :expense
  belongs_to :participant, optional: true
  belongs_to :participant_group, optional: true

  validate :exactly_one_target

  # Participant ids this entry stands for, resolved at read time.
  def participant_ids = participant_id ? [participant_id] : participant_group.participants.map(&:id)

  private

  def exactly_one_target
    errors.add(:base, "needs a participant or a group") if participant_id.nil? == participant_group_id.nil?
  end
end
