class CreateOauth < ActiveRecord::Migration[8.1]
  def change
    create_table :oauth_clients do |t|
      t.string :client_id, null: false
      t.string :name, null: false
      t.jsonb :redirect_uris, null: false, default: []
      t.timestamps
      t.index :client_id, unique: true
    end

    create_table :oauth_codes do |t|
      t.references :oauth_client, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :code_digest, null: false
      t.string :redirect_uri, null: false
      t.string :code_challenge, null: false
      t.datetime :expires_at, null: false
      t.timestamps
      t.index :code_digest, unique: true
    end

    create_table :oauth_tokens do |t|
      t.references :oauth_client, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :access_digest, null: false
      t.string :refresh_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :refresh_expires_at, null: false
      t.timestamps
      t.index :access_digest, unique: true
      t.index :refresh_digest, unique: true
    end
  end
end
