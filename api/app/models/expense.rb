class Expense < ApplicationRecord
  include SoftDeletable

  belongs_to :group
  belongs_to :paid_by, class_name: "Participant", inverse_of: :paid_expenses
  has_many :shares, class_name: "ExpenseShare" # kept with a deleted expense; removed by Group#purge!

  validates :description, presence: true
  validates :amount_cents, numericality: { only_integer: true, greater_than: 0 }
  validate :shares_belong_to_group
  validate :has_recipients

  # Participant ids sharing this expense: direct picks plus current members of picked groups, in the pot's
  # display order (`order` = the pot's participant ids) so the extra cents of an uneven split go to the first.
  def recipient_ids(order = group.participants.map(&:id))
    shares.flat_map(&:participant_ids).uniq.sort_by { |id| order.index(id) || order.size }
  end

  # { participant_id => cents }, always summing to amount_cents. Computed on every read, never stored.
  def split_amounts(order = group.participants.map(&:id))
    ids = recipient_ids(order)
    return {} if ids.empty?
    base, rem = amount_cents.divmod(ids.size)
    ids.each_with_index.to_h { |id, i| [id, base + (i < rem ? 1 : 0)] }
  end

  private

  def shares_belong_to_group
    pids = shares.filter_map(&:participant_id)
    gids = shares.filter_map(&:participant_group_id)
    ids = [paid_by_id, *pids].compact.uniq
    errors.add(:base, "participants must belong to this MoneyPot") if Participant.where(id: ids, group_id: group_id).count != ids.size
    errors.add(:base, "groups must belong to this MoneyPot") if ParticipantGroup.where(id: gids.uniq, group_id: group_id).count != gids.uniq.size
  end

  def has_recipients
    errors.add(:shares, "must include at least one person") if shares.empty? || recipient_ids.empty?
  end
end
