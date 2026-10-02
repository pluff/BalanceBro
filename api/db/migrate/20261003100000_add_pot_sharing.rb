# A pot can be shared through a long secret link (groups.share_token). Whoever opens it becomes a
# member (group_memberships): can read, add expenses and create groups of people, nothing destructive.
class AddPotSharing < ActiveRecord::Migration[8.1]
  def change
    add_column :groups, :share_token, :string
    add_index :groups, :share_token, unique: true

    create_table :group_memberships do |t|
      t.references :group, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.timestamps
      t.index %i[group_id user_id], unique: true
    end
  end
end
