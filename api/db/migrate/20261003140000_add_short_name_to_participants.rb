class AddShortNameToParticipants < ActiveRecord::Migration[8.1]
  def up
    add_column :participants, :short_name, :string
    execute "UPDATE participants SET short_name = upper(left(regexp_replace(name, '\\s', '', 'g'), 3))"
    change_column_null :participants, :short_name, false
  end

  def down
    remove_column :participants, :short_name
  end
end
