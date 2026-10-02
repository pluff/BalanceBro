class CreateGroups < ActiveRecord::Migration[8.1]
  def change
    create_table :groups do |t|
      t.string :name, null: false
      t.string :currency, null: false, default: "USD"

      t.timestamps
    end
  end
end
