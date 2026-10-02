# Pots are owned by one signed-in user; the people inside them are Participants
# (plain names, optionally linked to a user). Money rows now point at participants.
# Fails loudly on non-empty tables (null: false columns), pre-release only.
class IntroduceParticipants < ActiveRecord::Migration[8.1]
  def up
    drop_table :memberships
    add_reference :groups, :owner, null: false, foreign_key: { to_table: :users }

    create_table :participants do |t|
      t.references :group, null: false, foreign_key: true
      t.string :name, null: false
      t.references :user, foreign_key: true
      t.timestamps
    end
    add_index :participants, "group_id, lower(name)", unique: true, name: "index_participants_on_group_and_lower_name"

    remove_reference :expenses, :paid_by, foreign_key: { to_table: :users }
    add_reference :expenses, :paid_by, null: false, foreign_key: { to_table: :participants }

    remove_reference :expense_splits, :user, foreign_key: true
    add_reference :expense_splits, :participant, null: false, foreign_key: true

    remove_reference :settlements, :from_user, foreign_key: { to_table: :users }
    remove_reference :settlements, :to_user, foreign_key: { to_table: :users }
    add_reference :settlements, :from_participant, null: false, foreign_key: { to_table: :participants }
    add_reference :settlements, :to_participant, null: false, foreign_key: { to_table: :participants }
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
