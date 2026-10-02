class Settlement < ApplicationRecord
  belongs_to :group
  belongs_to :from_participant, class_name: "Participant", inverse_of: :sent_settlements
  belongs_to :to_participant, class_name: "Participant", inverse_of: :received_settlements

  normalizes :description, with: ->(d) { d.to_s.strip.presence }
  validates :description, length: { maximum: 255 }
  validates :amount_cents, numericality: { only_integer: true, greater_than: 0 }
  validate :different_people
  validate :people_belong_to_group

  private

  def different_people
    errors.add(:to_participant, "must differ from payer") if from_participant_id == to_participant_id
  end

  def people_belong_to_group
    ids = [from_participant_id, to_participant_id].compact.uniq
    errors.add(:base, "participants must belong to this MoneyPot") if Participant.where(id: ids, group_id: group_id).count != ids.size
  end
end
