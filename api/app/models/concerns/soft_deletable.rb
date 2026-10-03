# Rows are never removed by `destroy`: they get a `deleted_at` stamp and drop out of every query (default scope).
# `destroy` still runs the model's destroy callbacks, so guards like `restrict_with_error` keep working.
# Use `Model.deleted` to see them, `restore!` to bring one back; `Group#purge!` is the only real delete.
module SoftDeletable
  extend ActiveSupport::Concern

  included do
    default_scope { where(deleted_at: nil) }
    scope :deleted, -> { unscope(where: :deleted_at).where.not(deleted_at: nil) }
  end

  def destroy
    return false unless run_callbacks(:destroy) { update_columns(deleted_at: Time.current) && true }
    self
  end

  def restore! = update_columns(deleted_at: nil)

  def deleted? = deleted_at.present?
end
