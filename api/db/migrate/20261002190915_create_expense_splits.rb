class CreateExpenseSplits < ActiveRecord::Migration[8.1]
  def change
    create_table :expense_splits do |t|
      t.references :expense, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.bigint :amount_cents, null: false

      t.timestamps
    end
  end
end
