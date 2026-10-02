# Append-only history of everything done in a pot. No foreign keys on purpose: the trail must outlive
# the rows it describes (deleted people, expenses, accounts).
class CreateAuditLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :audit_logs do |t|
      t.bigint :group_id, null: false
      t.bigint :actor_id
      t.string :actor_name
      t.string :action, null: false
      t.string :subject_type
      t.bigint :subject_id
      t.jsonb :details, null: false, default: {}
      t.string :ip
      t.datetime :created_at, null: false
      t.index %i[group_id created_at]
      t.index :actor_id
      t.index %i[subject_type subject_id]
    end
  end
end
