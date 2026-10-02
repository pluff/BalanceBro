# An expense now stores *who it is split between* (participants and/or participant groups), not fixed
# amounts. Amounts are computed on read, so editing a group re-balances every expense that uses it.
# Existing rows become plain per-participant shares (they were all even splits).
class SplitExpensesByReference < ActiveRecord::Migration[8.1]
  def up
    rename_table :expense_splits, :expense_shares
    remove_column :expense_shares, :amount_cents
    change_column_null :expense_shares, :participant_id, true
    add_reference :expense_shares, :participant_group, foreign_key: true
    add_check_constraint :expense_shares, "(participant_id IS NULL) <> (participant_group_id IS NULL)",
                         name: "expense_shares_exactly_one_target"
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
