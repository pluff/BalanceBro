# One row per thing someone did in a pot ("expense.create", "participant.rename", "share.join", ...).
# Append-only; `details` carries what changed (before/after for edits, a full snapshot for deletes).
class AuditLog < ApplicationRecord
  belongs_to :actor, class_name: "User", optional: true

  validates :group_id, :action, presence: true

  def readonly? = !new_record?
end
