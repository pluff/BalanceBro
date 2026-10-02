# Named sets of participants ("Flatmates") so an expense can be split with several people in one click.
class CreateParticipantGroups < ActiveRecord::Migration[8.1]
  def change
    create_table :participant_groups do |t|
      t.references :group, null: false, foreign_key: true
      t.string :name, null: false
      t.timestamps
    end
    add_index :participant_groups, "group_id, lower(name)", unique: true, name: "index_participant_groups_on_group_and_lower_name"

    create_table :participant_group_members do |t|
      t.references :participant_group, null: false, foreign_key: true
      t.references :participant, null: false, foreign_key: true
      t.timestamps
    end
    add_index :participant_group_members, %i[participant_group_id participant_id], unique: true,
              name: "index_participant_group_members_uniqueness"
  end
end
