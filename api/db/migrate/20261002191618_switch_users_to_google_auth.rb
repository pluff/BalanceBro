class SwitchUsersToGoogleAuth < ActiveRecord::Migration[8.1]
  def change
    remove_column :users, :password_digest, :string, null: false
    add_column :users, :google_sub, :string
    add_column :users, :avatar_url, :string
    add_index :users, :google_sub, unique: true
  end
end
