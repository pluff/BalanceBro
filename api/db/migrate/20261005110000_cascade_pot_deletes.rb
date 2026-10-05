# Purging a pot is one DELETE on `groups`; the database removes everything that belongs to it.
class CascadePotDeletes < ActiveRecord::Migration[8.1]
  POT_CHILDREN = %i[expenses settlements participant_groups participants group_memberships].freeze

  def up
    POT_CHILDREN.each { |t| recascade t, :groups, :group_id, cascade: true }
    execute "DELETE FROM audit_logs WHERE group_id NOT IN (SELECT id FROM groups)"
    add_foreign_key :audit_logs, :groups, on_delete: :cascade
    recascade :expense_shares, :expenses, :expense_id, cascade: true
    recascade :participant_group_members, :participant_groups, :participant_group_id, cascade: true
  end

  def down
    remove_foreign_key :audit_logs, :groups
    POT_CHILDREN.each { |t| recascade t, :groups, :group_id, cascade: false }
    recascade :expense_shares, :expenses, :expense_id, cascade: false
    recascade :participant_group_members, :participant_groups, :participant_group_id, cascade: false
  end

  private

  def recascade(table, parent, column, cascade:)
    remove_foreign_key table, parent, column: column
    add_foreign_key table, parent, column: column, **(cascade ? { on_delete: :cascade } : {})
  end
end
