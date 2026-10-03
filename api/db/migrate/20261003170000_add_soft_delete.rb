# Deleting hides a row (deleted_at) instead of removing it. Names only have to be unique among live rows,
# so a deleted person or group of people doesn't block reusing its name.
class AddSoftDelete < ActiveRecord::Migration[8.1]
  TABLES = %i[groups participants participant_groups expenses settlements].freeze

  def change
    TABLES.each { |t| add_column t, :deleted_at, :datetime }
    add_index :groups, %i[owner_id deleted_at]

    remove_index :participants, name: "index_participants_on_group_and_lower_name"
    add_index :participants, "group_id, lower((name)::text)", unique: true, where: "deleted_at IS NULL",
                                                               name: "index_participants_on_group_and_lower_name"
    remove_index :participant_groups, name: "index_participant_groups_on_group_and_lower_name"
    add_index :participant_groups, "group_id, lower((name)::text)", unique: true, where: "deleted_at IS NULL",
                                                                     name: "index_participant_groups_on_group_and_lower_name"
  end
end
