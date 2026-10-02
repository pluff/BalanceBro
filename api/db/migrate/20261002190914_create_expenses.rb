class CreateExpenses < ActiveRecord::Migration[8.1]
  def change
    create_table :expenses do |t|
      t.references :group, null: false, foreign_key: true
      t.references :paid_by, null: false, foreign_key: { to_table: :users }
      t.string :description, null: false
      t.bigint :amount_cents, null: false
      t.date :spent_on, null: false

      t.timestamps
    end
  end
end
