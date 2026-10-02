class AddPositionToParticipants < ActiveRecord::Migration[8.1]
  def up
    add_column :participants, :position, :integer, null: false, default: 0
    execute <<~SQL
      UPDATE participants p SET position = r.rn
      FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY id) AS rn FROM participants) r
      WHERE p.id = r.id
    SQL
    add_index :participants, %i[group_id position]
  end

  def down
    remove_column :participants, :position
  end
end
