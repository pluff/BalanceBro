# One row per thing someone did in a pot ("expense.create", "participant.rename", "share.join", ...).
# Append-only; `details` carries what changed (before/after for edits, a full snapshot for deletes).
class AuditLog < ApplicationRecord
  belongs_to :actor, class_name: "User", optional: true

  validates :group_id, :action, presence: true

  SOURCES = %w[ui mcp].freeze

  validates :source, inclusion: { in: SOURCES }

  PER_PAGE = 50
  FIELDS = %i[id actor_id actor_name action subject_type subject_id details ip source created_at].freeze

  # One page of a pot's log, newest first. `before` is a log id (cursor); `next_before` is nil on the last page.
  def self.page_for(group, before: nil, per: PER_PAGE)
    scope = where(group_id: group.id).order(id: :desc)
    scope = scope.where(id: ...before.to_i) if before.present?
    rows = scope.limit(per + 1).to_a
    more = rows.size > per
    rows = rows.first(per)
    { logs: rows.as_json(only: FIELDS), next_before: (rows.last.id if more) }
  end

  def readonly? = !new_record?
end
